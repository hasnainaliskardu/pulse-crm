-- 002_activity_log.sql — auto-log every mutation on core tables
-- (service-role mutations also logged; RLS insert policy allows authenticated inserts)

create or replace function public.log_action(
  p_member uuid,
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_detail jsonb default null
)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.activity_log(member_id, action, entity, entity_id, detail)
  values (p_member, p_action, p_entity, p_entity_id, coalesce(p_detail, '{}'::jsonb));
$$;

-- LEADS: log insert/update/delete from client or server code (explicit calls in actions),
-- plus a safety trigger for direct table edits made outside the app.

create or replace function public.leads_audit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if (tg_op = 'INSERT') then
    insert into public.activity_log(member_id, action, entity, entity_id, detail)
    values (coalesce(actor, new.created_by), 'CREATE', 'LEAD', new.id::text,
      jsonb_build_object('business_name', new.business_name, 'city', new.city, 'source', new.source::text, 'status', new.status::text));
    return new;
  elsif (tg_op = 'UPDATE') then
    if (old.status <> new.status) then
      insert into public.activity_log(member_id, action, entity, entity_id, detail)
      values (coalesce(actor, new.assigned_to), 'STATUS_CHANGE', 'LEAD', new.id::text,
        jsonb_build_object('from', old.status::text, 'to', new.status::text, 'business_name', new.business_name));
    end if;
    insert into public.activity_log(member_id, action, entity, entity_id, detail)
    values (coalesce(actor, new.assigned_to), 'UPDATE', 'LEAD', new.id::text,
      jsonb_build_object('business_name', new.business_name,
        'changed', (select jsonb_object_agg(key, value) from jsonb_each_text(to_jsonb(new)) where (to_jsonb(old) ->> key) is distinct from (to_jsonb(new) ->> key))));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.activity_log(member_id, action, entity, entity_id, detail)
    values (actor, 'DELETE', 'LEAD', old.id::text,
      jsonb_build_object('business_name', old.business_name, 'city', old.city));
    return old;
  end if;
  return null;
end;
$$;

create trigger leads_audit_trg
  after insert or update or delete on public.leads
  for each row execute function public.leads_audit();

-- Points/status side-effects on lead status changes
create or replace function public.on_lead_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.assigned_by);
begin
  if (old.status <> new.status) then
    -- mark research complete: RESEARCHING -> READY
    if (old.status = 'RESEARCHING' and new.status = 'READY') then
      update public.members set points = points + 2 where id = coalesce(auth.uid(), new.assigned_to);
      insert into public.daily_stats(member_id, date, leads_researched)
        values (coalesce(auth.uid(), new.assigned_to), current_date, 1)
        on conflict (member_id, date)
        do update set leads_researched = daily_stats.leads_researched + 1;
    end if;

    -- positive reply
    if (new.reply_type = 'POSITIVE' and old.reply_type <> 'POSITIVE') then
      update public.members set points = points + 10 where id = coalesce(auth.uid(), new.assigned_to);
      insert into public.daily_stats(member_id, date, positive_replies)
        values (coalesce(auth.uid(), new.assigned_to), current_date, 1)
        on conflict (member_id, date)
        do update set positive_replies = daily_stats.positive_replies + 1;
    end if;

    -- call booked
    if (new.status = 'CALL_BOOKED' and old.status <> 'CALL_BOOKED') then
      update public.members set points = points + 20 where id = coalesce(auth.uid(), new.assigned_to);
      insert into public.daily_stats(member_id, date, calls_booked)
        values (coalesce(auth.uid(), new.assigned_to), current_date, 1)
        on conflict (member_id, date)
        do update set calls_booked = daily_stats.calls_booked + 1;
    end if;

    -- won
    if (new.status = 'WON' and old.status <> 'WON') then
      update public.members set points = points + 100 where id = coalesce(auth.uid(), new.assigned_to);
      insert into public.daily_stats(member_id, date, clients_closed)
        values (coalesce(auth.uid(), new.assigned_to), current_date, 1)
        on conflict (member_id, date)
        do update set clients_closed = daily_stats.clients_closed + 1;
    end if;

    update public.leads set last_activity_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

create trigger lead_status_points_trg
  before update on public.leads
  for each row execute function public.on_lead_status_change();

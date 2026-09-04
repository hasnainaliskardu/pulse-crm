-- ============================================================
-- FIX SCRIPT — run this in Supabase SQL Editor (one time)
-- Fixes: trigger crash on imported leads, duplicate ghost rows,
-- and hardens defaults for bulk imports.
-- ============================================================

-- 1) Fix on_lead_status_change: 'new.assigned_by' column doesn't exist.
--    Rebuild the trigger safely (drop + recreate).
create or replace function public.on_lead_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.assigned_to, new.created_by);
begin
  if (old.status <> new.status) then
    -- research complete: RESEARCHING -> READY
    if (old.status = 'RESEARCHING' and new.status = 'READY') then
      update public.members set points = points + 2 where id = actor;
      insert into public.daily_stats(member_id, date, leads_researched)
        values (actor, (now() at time zone 'UTC')::date, 1)
        on conflict (member_id, date)
        do update set leads_researched = daily_stats.leads_researched + 1;
    end if;

    -- positive reply
    if (new.reply_type = 'POSITIVE' and old.reply_type <> 'POSITIVE') then
      update public.members set points = points + 10 where id = actor;
      insert into public.daily_stats(member_id, date, positive_replies)
        values (actor, (now() at time zone 'UTC')::date, 1)
        on conflict (member_id, date)
        do update set positive_replies = daily_stats.positive_replies + 1;
    end if;

    -- call booked
    if (new.status = 'CALL_BOOKED' and old.status <> 'CALL_BOOKED') then
      update public.members set points = points + 20 where id = actor;
      insert into public.daily_stats(member_id, date, calls_booked)
        values (actor, (now() at time zone 'UTC')::date, 1)
        on conflict (member_id, date)
        do update set calls_booked = daily_stats.calls_booked + 1;
    end if;

    -- won
    if (new.status = 'WON' and old.status <> 'WON') then
      update public.members set points = points + 100 where id = actor;
      insert into public.daily_stats(member_id, date, clients_closed)
        values (actor, (now() at time zone 'UTC')::date, 1)
        on conflict (member_id, date)
        do update set clients_closed = daily_stats.clients_closed + 1;
    end if;
  end if;

  new.last_activity_at := now();
  return new;
end;
$$;

drop trigger if exists lead_status_points_trg on public.leads;
create trigger lead_status_points_trg
  before update on public.leads
  for each row execute function public.on_lead_status_change();

-- 2) Fix on_touch_insert: guard every branch; keep stats correct.
create or replace function public.on_touch_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pts int := 1;
  is_reply boolean := (new.direction = 'IN');
  stat_date date := ((coalesce(new.occurred_at, now())) at time zone 'UTC')::date;
begin
  update public.leads
    set last_activity_at = coalesce(new.occurred_at, now()),
        status = case
          when status in ('NEW','RESEARCHING') and is_reply = false then 'CONTACTED'
          when is_reply and status = 'CONTACTED' then 'REPLIED'
          else status
        end,
        reply_type = case when is_reply and reply_type = 'NONE' then 'NEUTRAL' else reply_type end
    where id = new.lead_id;

  if is_reply then pts := 5; end if;

  update public.members set points = points + pts where id = new.member_id;

  insert into public.daily_stats(member_id, date, touches_sent, replies_received)
    values (new.member_id, stat_date,
            case when is_reply then 0 else 1 end,
            case when is_reply then 1 else 0 end)
    on conflict (member_id, date)
    do update set
      touches_sent = daily_stats.touches_sent + (case when is_reply then 0 else 1 end),
      replies_received = daily_stats.replies_received + (case when is_reply then 1 else 0 end);

  return new;
end;
$$;

-- 3) Fix leads_audit: jsonb_object_agg with null values crashes on some rows.
--    Use a safer change capture.
create or replace function public.leads_audit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  actor uuid := coalesce(auth.uid(), new.assigned_to, new.created_by);
begin
  if (tg_op = 'INSERT') then
    insert into public.activity_log(member_id, action, entity, entity_id, detail)
    values (coalesce(actor, new.created_by), 'CREATE', 'LEAD', new.id::text,
      jsonb_build_object('business_name', new.business_name, 'city', new.city, 'source', new.source::text, 'status', new.status::text));
    return new;
  elsif (tg_op = 'UPDATE') then
    if (old.status is distinct from new.status) then
      insert into public.activity_log(member_id, action, entity, entity_id, detail)
      values (actor, 'STATUS_CHANGE', 'LEAD', new.id::text,
        jsonb_build_object('from', old.status::text, 'to', new.status::text, 'business_name', new.business_name));
    end if;
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

drop trigger if exists leads_audit_trg on public.leads;
create trigger leads_audit_trg
  after insert or delete or update of status on public.leads
  for each row execute function public.leads_audit();

-- 4) Clean up imported rows that arrived with NULL/invalid enums or missing defaults.
update public.leads
  set status = 'NEW'
  where status is null;

update public.leads
  set website_status = 'NONE'
  where website_status is null;

update public.leads
  set source = 'OTHER'
  where source is null;

update public.leads
  set reply_type = 'NONE'
  where reply_type is null;

-- 5) Remove duplicate ghost rows created by the old import race:
--    keep the OLDEST row per (business_name, city) and delete later duplicates.
delete from public.leads a
using public.leads b
where a.id <> b.id
  and lower(trim(a.business_name)) = lower(trim(b.business_name))
  and lower(trim(coalesce(a.city, ''))) = lower(trim(coalesce(b.city, '')))
  and (a.created_at, a.id) > (b.created_at, b.id);

-- 6) Recompute member points from actual activity (repairs any drift
--    from the buggy triggers).
update public.members m set points = coalesce(x.points, 0)
from (
  select member_id,
         sum(case when direction = 'IN' then 5 else 1 end) as points
  from public.touches
  group by member_id
) x
where x.member_id = m.id;

-- 7) Realtime for notes
alter publication supabase_realtime add table public.notes;

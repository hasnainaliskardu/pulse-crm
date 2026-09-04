-- Pulse CRM — Supabase migration (run in SQL Editor or via supabase db push)
-- 001_schema.sql

create extension if not exists "pgcrypto";

-- ============ MEMBERS ============
create type member_role as enum ('FOUNDER', 'MEMBER', 'ADMIN');

create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  position text not null default 'Researcher',
  role member_role not null default 'MEMBER',
  is_active boolean not null default true,
  daily_research_target int not null default 40,
  daily_touch_target int not null default 45,
  points int not null default 0,
  created_at timestamptz not null default now()
);

-- ============ LEADS ============
create type lead_source as enum ('GOOGLE_MAPS','HOUZZ','YELP','BBB','SUNBIZ','PERMIT','FACEBOOK','INSTAGRAM','LINKEDIN','OTHER');
create type website_status as enum ('NONE','BROKEN','POOR_SEO','GOOD');
create type lead_status as enum ('NEW','RESEARCHING','READY','CONTACTED','REPLIED','INTERESTED','NOT_INTERESTED','CALL_BOOKED','PROPOSAL','WON','LOST','DORMANT');
create type reply_type as enum ('NONE','NEUTRAL','POSITIVE','NEGATIVE');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  city text,
  state text,
  niche text,
  source lead_source not null default 'OTHER',
  website_url text,
  website_status website_status not null default 'NONE',
  seo_score int,
  owner_name text,
  owner_email text,
  owner_phone text,
  instagram text,
  facebook text,
  linkedin text,
  assigned_to uuid references public.members(id),
  status lead_status not null default 'NEW',
  reply_type reply_type not null default 'NONE',
  monthly_value int,
  notes text,
  last_activity_at timestamptz not null default now(),
  created_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_assigned_idx on public.leads(assigned_to);
create index leads_status_idx on public.leads(status);
create index leads_last_activity_idx on public.leads(last_activity_at desc);
create index leads_name_city_idx on public.leads(lower(business_name), lower(city));

-- ============ TOUCHES ============
create type touch_channel as enum ('EMAIL','IG_DM','WHATSAPP','CALL','LINKEDIN','FACEBOOK');
create type touch_direction as enum ('OUT','IN');

create table public.touches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  member_id uuid not null references public.members(id),
  channel touch_channel not null,
  direction touch_direction not null,
  message_summary text not null,
  message_full text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index touches_lead_idx on public.touches(lead_id);
create index touches_member_time_idx on public.touches(member_id, occurred_at desc);

-- ============ DAILY STATS ============
create table public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  date date not null,
  leads_researched int not null default 0,
  touches_sent int not null default 0,
  replies_received int not null default 0,
  positive_replies int not null default 0,
  calls_booked int not null default 0,
  clients_closed int not null default 0,
  unique(member_id, date)
);

create index daily_stats_date_idx on public.daily_stats(date);

-- ============ TARGETS ============
create type target_period as enum ('DAILY','WEEKLY','MONTHLY');

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  period target_period not null default 'DAILY',
  metric text not null,
  value int not null default 0,
  unique(member_id, period, metric)
);

-- ============ CLIENTS ============
create type client_status as enum ('ACTIVE','CHURNED');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  closed_by uuid references public.members(id),
  monthly_revenue int not null default 0,
  started_at date not null default current_date,
  status client_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now()
);

-- ============ ACTIVITY LOG ============
create table public.activity_log (
  id bigint generated always as identity primary key,
  member_id uuid references public.members(id),
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_time_idx on public.activity_log(created_at desc);
create index activity_log_member_idx on public.activity_log(member_id);

-- ============ SETTINGS ============
create table public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.settings(key, value) values ('sheets_webhook_url', '')
  on conflict (key) do nothing;

-- ============ HELPER: is founder ============
create or replace function public.is_founder()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.id = auth.uid() and m.role in ('FOUNDER','ADMIN')
  );
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- ============ RLS ============
alter table public.members enable row level security;
alter table public.leads enable row level security;
alter table public.touches enable row level security;
alter table public.daily_stats enable row level security;
alter table public.targets enable row level security;
alter table public.clients enable row level security;
alter table public.activity_log enable row level security;
alter table public.settings enable row level security;

-- MEMBERS: founder sees all; members see active member list (for assignment dropdown/leaderboard)
create policy "members_select" on public.members
  for select using (
    public.is_founder()
    or (id = auth.uid())
    or is_active = true
  );

create policy "members_update_self" on public.members
  for update using (id = auth.uid() and is_active = true)
  with check (id = auth.uid());

-- LEADS: founder all; members only their assigned leads (and leads they created)
create policy "leads_select" on public.leads
  for select using (
    public.is_founder()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  );

create policy "leads_insert_member" on public.leads
  for insert with check (
    public.is_founder()
    or (assigned_to = auth.uid() or assigned_to is null)
  );

create policy "leads_update_member" on public.leads
  for update using (
    public.is_founder()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  )
  with check (
    public.is_founder()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
    or assigned_to is null
  );

-- members cannot delete; founder deletes via service role (bypasses RLS)
create policy "leads_delete" on public.leads
  for delete using (public.is_founder());

-- TOUCHES: founder all; members own touches + touches on their leads
create policy "touches_select" on public.touches
  for select using (
    public.is_founder()
    or member_id = auth.uid()
    or exists (
      select 1 from public.leads l
      where l.id = lead_id and (l.assigned_to = auth.uid() or l.created_by = auth.uid())
    )
  );

create policy "touches_insert" on public.touches
  for insert with check (
    public.is_founder() or member_id = auth.uid()
  );

create policy "touches_update" on public.touches
  for update using (public.is_founder() or member_id = auth.uid());

-- DAILY_STATS: founder all; members own
create policy "stats_select" on public.daily_stats
  for select using (public.is_founder() or member_id = auth.uid());

create policy "stats_insert" on public.daily_stats
  for insert with check (public.is_founder() or member_id = auth.uid());

create policy "stats_update" on public.daily_stats
  for update using (public.is_founder() or member_id = auth.uid());

-- TARGETS: founder all; members read own (and team-level targets where member_id is null)
create policy "targets_select" on public.targets
  for select using (public.is_founder() or member_id = auth.uid() or member_id is null);

create policy "targets_write" on public.targets
  for insert with check (public.is_founder());

create policy "targets_update" on public.targets
  for update using (public.is_founder());

create policy "targets_delete" on public.targets
  for delete using (public.is_founder());

-- CLIENTS: founder only
create policy "clients_all" on public.clients
  for all using (public.is_founder()) with check (public.is_founder());

-- ACTIVITY LOG: read for founder; insert allowed for authenticated; no update/delete ever
create policy "log_select" on public.activity_log
  for select using (public.is_founder() or member_id = auth.uid());

create policy "log_insert" on public.activity_log
  for insert with check (auth.uid() is not null);

-- SETTINGS: founder read/write; webhook URL server-side only
create policy "settings_founder" on public.settings
  for all using (public.is_founder()) with check (public.is_founder());

-- ============ TRIGGERS: updated_at ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ============ TRIGGER: points + daily_stats on touch insert ============
create or replace function public.on_touch_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  pts int := 1;
  is_reply boolean := (new.direction = 'IN');
  stat_date date := (new.occurred_at at time zone 'UTC')::date;
begin
  update public.leads
    set last_activity_at = new.occurred_at,
        status = case
          when status in ('NEW','RESEARCHING') then 'CONTACTED'
          when is_reply and status = 'CONTACTED' then 'REPLIED'
          else status
        end,
        reply_type = case when is_reply then 'NEUTRAL' else reply_type end
    where id = new.lead_id;

  if is_reply then
    pts := 5;
  end if;

  update public.members set points = points + pts where id = new.member_id;

  insert into public.daily_stats(member_id, date, touches_sent, replies_received)
    values (new.member_id, stat_date, case when is_reply then 0 else 1 end, case when is_reply then 1 else 0 end)
    on conflict (member_id, date)
    do update set
      touches_sent = daily_stats.touches_sent + (case when is_reply then 0 else 1 end),
      replies_received = daily_stats.replies_received + (case when is_reply then 1 else 0 end);

  return new;
end;
$$;

create trigger touch_insert_stats
  after insert on public.touches
  for each row execute function public.on_touch_insert();

-- ============ REALTIME ============
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.touches;
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.daily_stats;

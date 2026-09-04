-- ============================================================
-- PULSE CRM V2 — RESTRUCTURE MIGRATION
-- Run once in Supabase SQL Editor.
-- Adds: workspaces, call outcomes, meetings, attendance,
-- salaries, currency/commission settings, lead visibility control.
-- All additive — existing data and functionality preserved.
-- ============================================================

-- ============ 1. WORKSPACES & MEMBER FIELDS ============
alter table public.members add column if not exists workspaces text[] not null default '{INTL}';
alter table public.members add column if not exists joining_date date;
alter table public.members add column if not exists salary_monthly int not null default 0;

-- founders + partners get both workspaces
update public.members set workspaces = '{INTL,CALLS}' where role in ('FOUNDER','ADMIN');
update public.members set workspaces = '{INTL,CALLS}' where position in ('Partner','CRO','COO');

-- ============ 2. LEAD FIELDS ============
alter table public.leads add column if not exists workspace text not null default 'INTL';
alter table public.leads add column if not exists is_visible_to_assignee boolean not null default true;
alter table public.leads add column if not exists assigned_at timestamptz;

create index if not exists leads_workspace_idx on public.leads(workspace);

-- ============ 3. CALL OUTCOMES on touches ============
alter table public.touches add column if not exists outcome text;
create index if not exists touches_outcome_idx on public.touches(outcome);

-- ============ 4. MEETINGS ============
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  member_id uuid references public.members(id),
  title text not null default 'Meeting',
  scheduled_at timestamptz not null,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists meetings_scheduled_idx on public.meetings(scheduled_at);
create index if not exists meetings_lead_idx on public.meetings(lead_id);

alter table public.meetings enable row level security;

create policy "meetings_select" on public.meetings
  for select using (
    public.is_founder()
    or member_id = auth.uid()
    or exists (select 1 from public.leads l where l.id = lead_id and (l.assigned_to = auth.uid() or l.created_by = auth.uid()))
  );

create policy "meetings_insert" on public.meetings
  for insert with check (auth.uid() is not null);

create policy "meetings_update" on public.meetings
  for update using (public.is_founder() or member_id = auth.uid());

-- ============ 5. ATTENDANCE ============
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  date date not null,
  status text not null check (status in ('PRESENT','ABSENT','LEAVE','HALF_DAY')),
  note text,
  created_at timestamptz not null default now(),
  unique(member_id, date)
);

create index if not exists attendance_date_idx on public.attendance(date);

alter table public.attendance enable row level security;

create policy "attendance_select" on public.attendance
  for select using (public.is_founder() or member_id = auth.uid());

create policy "attendance_write" on public.attendance
  for insert with check (public.is_founder() or member_id = auth.uid());

create policy "attendance_update" on public.attendance
  for update using (public.is_founder() or member_id = auth.uid());

-- ============ 6. SALARIES ============
create table if not exists public.salaries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  month date not null,
  base_amount int not null default 0,
  commission_amount int not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique(member_id, month)
);

alter table public.salaries enable row level security;

create policy "salaries_founder" on public.salaries
  for all using (public.is_founder()) with check (public.is_founder());

-- ============ 7. SETTINGS DEFAULTS ============
insert into public.settings(key, value) values
  ('currency', 'USD'),
  ('usd_to_pkr', '280'),
  ('usdt_per_usd', '1'),
  ('team_pct', '30'),
  ('reserve_pct', '20'),
  ('delivery_pct', '40'),
  ('sales_pct', '60')
on conflict (key) do nothing;

-- ============ 8. RLS POLICY UPDATES ============

-- Members see assigned leads ONLY if founder has not restricted them (monthly blur control)
drop policy if exists "leads_select" on public.leads;
create policy "leads_select" on public.leads
  for select using (
    public.is_founder()
    or (assigned_to = auth.uid() and is_visible_to_assignee = true)
    or created_by = auth.uid()
  );

-- Shared-PC support: any authenticated member may log a call under another member's name
-- (the app records who actually operated it in activity_log)
drop policy if exists "touches_insert" on public.touches;
create policy "touches_insert" on public.touches
  for insert with check (auth.uid() is not null);

-- ============ 9. REALTIME ============
alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.touches;

-- ============ 10. SEED ATTENDANCE FOR TODAY (optional demo) ============
-- (not seeded; founders mark from the UI)

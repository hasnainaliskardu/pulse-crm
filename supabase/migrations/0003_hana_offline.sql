-- 003_hana_offline.sql — tasks, notes, files, custom fields, workflow rules, sync state

-- TASKS
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date,
  assigned_to uuid references public.members(id),
  lead_id uuid references public.leads(id) on delete cascade,
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  done boolean not null default false,
  created_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_due_idx on public.tasks(due_date);
create index tasks_assigned_idx on public.tasks(assigned_to);

alter table public.tasks enable row level security;

create policy "tasks_select" on public.tasks
  for select using (
    public.is_founder()
    or assigned_to = auth.uid()
    or created_by = auth.uid()
  );

create policy "tasks_insert" on public.tasks
  for insert with check (auth.uid() is not null);

create policy "tasks_update" on public.tasks
  for update using (public.is_founder() or assigned_to = auth.uid() or created_by = auth.uid());

create policy "tasks_delete" on public.tasks
  for delete using (public.is_founder() or created_by = auth.uid());

alter publication supabase_realtime add table public.tasks;

-- NOTES
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid references public.members(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index notes_lead_idx on public.notes(lead_id);

alter table public.notes enable row level security;

create policy "notes_select" on public.notes
  for select using (
    public.is_founder()
    or exists (select 1 from public.leads l where l.id = lead_id and (l.assigned_to = auth.uid() or l.created_by = auth.uid()))
    or author_id = auth.uid()
  );

create policy "notes_insert" on public.notes
  for insert with check (auth.uid() is not null);

alter publication supabase_realtime add table public.notes;

-- FILES (metadata; blobs in Supabase Storage "lead-files")
create table public.files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  uploaded_by uuid references public.members(id),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes int,
  created_at timestamptz not null default now()
);

create index files_lead_idx on public.files(lead_id);

alter table public.files enable row level security;

create policy "files_select" on public.files
  for select using (
    public.is_founder()
    or exists (select 1 from public.leads l where l.id = lead_id and (l.assigned_to = auth.uid() or l.created_by = auth.uid()))
    or uploaded_by = auth.uid()
  );

create policy "files_insert" on public.files
  for insert with check (auth.uid() is not null);

create policy "files_delete" on public.files
  for delete using (public.is_founder() or uploaded_by = auth.uid());

-- storage bucket
insert into storage.buckets (id, name, public)
values ('lead-files', 'lead-files', false)
on conflict (id) do nothing;

-- storage RLS-ish policies (via storage policies)
create policy "lead_files_read" on storage.objects
  for select using (bucket_id = 'lead-files' and auth.uid() is not null);

create policy "lead_files_write" on storage.objects
  for insert with check (bucket_id = 'lead-files' and auth.uid() is not null);

-- CUSTOM FIELDS
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('LEAD','CLIENT')),
  key text not null,
  label text not null,
  type text not null check (type in ('TEXT','NUMBER','SELECT','DATE')),
  options text[] default '{}',
  created_at timestamptz not null default now(),
  unique(entity, key)
);

alter table public.custom_fields enable row level security;

create policy "custom_fields_select" on public.custom_fields
  for select using (auth.uid() is not null);

create policy "custom_fields_write" on public.custom_fields
  for all using (public.is_founder()) with check (public.is_founder());

create table public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  entity_id uuid not null,
  value text,
  updated_at timestamptz not null default now(),
  unique(field_id, entity_id)
);

alter table public.custom_field_values enable row level security;

create policy "cfv_select" on public.custom_field_values
  for select using (
    public.is_founder()
    or exists (
      select 1 from public.leads l
      where l.id = entity_id and (l.assigned_to = auth.uid() or l.created_by = auth.uid())
    )
  );

create policy "cfv_write" on public.custom_field_values
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- WORKFLOW RULES
create table public.workflow_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default true,
  trigger_entity text not null default 'LEAD',
  trigger_event text not null default 'STATUS_CHANGE', -- STATUS_CHANGE | CREATE
  trigger_value text, -- e.g. status value
  action_type text not null check (action_type in ('CREATE_TASK','CREATE_CLIENT','SET_FIELD','WEBHOOK')),
  action_config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.workflow_rules enable row level security;

create policy "rules_select" on public.workflow_rules
  for select using (auth.uid() is not null);

create policy "rules_write" on public.workflow_rules
  for all using (public.is_founder()) with check (public.is_founder());

-- OUTBOX CONFLICTS (audit of merged conflicts)
create table public.outbox_conflicts (
  id bigint generated always as identity primary key,
  member_id uuid references public.members(id),
  table_name text not null,
  record_id text,
  client_version jsonb,
  server_version jsonb,
  merged_version jsonb,
  created_at timestamptz not null default now()
);

alter table public.outbox_conflicts enable row level security;

create policy "conflicts_founder" on public.outbox_conflicts
  for select using (public.is_founder());

-- SYNC STATE (per device/user last cursor)
create table public.sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id),
  device text,
  last_cursor bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, device)
);

alter table public.sync_state enable row level security;

create policy "sync_state_self" on public.sync_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tasks/notes triggers for updated_at
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

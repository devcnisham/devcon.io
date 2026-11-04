-- Additive, idempotent local bootstrap. Run with npm run files:setup.
-- All writes go through checked app endpoints or the private conversion worker.
create table if not exists workspace_files (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
 name text not null check(length(name) between 1 and 160), kind text not null check(kind in ('document','presentation','spreadsheet')),
 current_revision_id uuid, original_path text, original_name text, warnings jsonb not null default '[]',
 created_by uuid not null references users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists file_revisions (
 id uuid primary key default gen_random_uuid(), file_id uuid not null references workspace_files(id) on delete cascade,
 parent_id uuid references file_revisions(id), content jsonb not null,
 source text not null check(source in ('manual','ai','import','restore')), conflict boolean not null default false,
 created_by uuid not null references users(id), created_at timestamptz not null default now(), unique(file_id,id)
);
do $$begin
 if not exists(select 1 from pg_constraint where conname='workspace_files_current_revision_fk')then
 alter table workspace_files add constraint workspace_files_current_revision_fk foreign key(id,current_revision_id) references file_revisions(file_id,id) deferrable initially deferred;
 end if;
end$$;
create table if not exists file_messages (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
 file_id uuid references workspace_files(id) on delete set null, role text not null check(role in ('user','assistant')), content text not null check(length(content)<=20000),
 created_by uuid not null references users(id), created_at timestamptz not null default now()
);
create table if not exists file_jobs (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id) on delete cascade,
 file_id uuid references workspace_files(id) on delete cascade, revision_id uuid references file_revisions(id),
 kind text not null check(kind in ('generate','import','export')), status text not null default 'queued' check(status in ('queued','running','succeeded','failed')),
 progress integer not null default 0 check(progress between 0 and 100), payload jsonb not null default '{}', result jsonb not null default '{}', metrics jsonb not null default '{}',
 error text, attempts integer not null default 0, created_by uuid not null references users(id), created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz
);
create index if not exists workspace_files_project_idx on workspace_files(project_id,updated_at desc) where deleted_at is null;
create index if not exists file_revisions_file_idx on file_revisions(file_id,created_at desc);
create index if not exists file_messages_project_idx on file_messages(project_id,created_at);
create index if not exists file_jobs_queue_idx on file_jobs(kind,status,created_at);
alter table workspace_files enable row level security;
alter table file_revisions enable row level security;
alter table file_messages enable row level security;
alter table file_jobs enable row level security;
revoke all on workspace_files,file_revisions,file_messages,file_jobs from anon,authenticated;
grant select on workspace_files,file_revisions,file_messages,file_jobs to authenticated;
drop policy if exists files_member_read on workspace_files;
create policy files_member_read on workspace_files for select to authenticated using (deleted_at is null and exists(select 1 from projects p join workspaces w on w.id=p.workspace_id where p.id=project_id and p.deleted_at is null and w.deleted_at is null and is_workspace_member(p.workspace_id,auth.uid())));
drop policy if exists revisions_member_read on file_revisions;
create policy revisions_member_read on file_revisions for select to authenticated using (exists(select 1 from workspace_files f where f.id=file_id));
drop policy if exists messages_member_read on file_messages;
create policy messages_member_read on file_messages for select to authenticated using (exists(select 1 from projects p join workspaces w on w.id=p.workspace_id where p.id=project_id and p.deleted_at is null and w.deleted_at is null and is_workspace_member(p.workspace_id,auth.uid())));
-- Job payloads may contain user text; clients consume the authorized API projection only.
revoke select on file_jobs from authenticated;
-- No direct Storage policies are added. App and worker use the server key only
-- after permission checks; clients receive five-minute scoped signed URLs.
insert into storage.buckets (id,name,public,file_size_limit) values ('project-files','project-files',false,20971520)
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

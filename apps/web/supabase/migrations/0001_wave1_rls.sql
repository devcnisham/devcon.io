-- Wave 1 RLS. Applied by scripts/db-setup.mjs AFTER drizzle migrations
-- create the tables, so these policies always find their targets.
--
-- Membership checks run through a SECURITY DEFINER helper. Policies that
-- subquery workspace_members directly recurse (RLS applies to policy
-- subqueries), which PostgreSQL rejects with "infinite recursion detected".

create or replace function public.is_workspace_member(ws uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws and user_id = uid
  );
$$;

alter table users enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_activities enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_integrations enable row level security;

drop policy if exists "users_self_read" on users;
create policy "users_self_read" on users for select
  using (auth.uid() = id);

drop policy if exists "workspaces_member_read" on workspaces;
create policy "workspaces_member_read" on workspaces for select
  using (is_workspace_member(id, auth.uid()));

drop policy if exists "workspace_members_read" on workspace_members;
create policy "workspace_members_read" on workspace_members for select
  using (is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "workspace_activities_member_read" on workspace_activities;
create policy "workspace_activities_member_read" on workspace_activities for select
  using (is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "projects_member_read" on projects;
create policy "projects_member_read" on projects for select
  using (is_workspace_member(workspace_id, auth.uid()));

drop policy if exists "project_members_read" on project_members;
create policy "project_members_read" on project_members for select
  using (
    is_workspace_member(
      (select workspace_id from projects where projects.id = project_members.project_id),
      auth.uid()
    )
  );

drop policy if exists "project_integrations_read" on project_integrations;
create policy "project_integrations_read" on project_integrations for select
  using (
    is_workspace_member(
      (select workspace_id from projects where projects.id = project_integrations.project_id),
      auth.uid()
    )
  );

-- Writes: the app performs permission checks in server actions (the
-- authoritative enforcement point, from workspace/lib/permissions.ts) and
-- writes via the service_role connection. Client anon writes are denied.

-- Grants: Postgres checks table ACLs before RLS evaluates, so without these
-- the policies above are unreachable. Row filters still apply to both roles.
grant select on users to anon, authenticated;
grant select on workspaces to anon, authenticated;
grant select on workspace_members to anon, authenticated;
grant select on projects to anon, authenticated;
grant select on project_members to anon, authenticated;
grant select on project_integrations to anon, authenticated;
grant select on workspace_activities to anon, authenticated;

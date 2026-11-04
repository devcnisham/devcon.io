-- AMENDED after the Task 3 review found infinite recursion: policies must
-- never subquery workspace_members directly (RLS applies to policy
-- subqueries). All membership checks go through the SECURITY DEFINER
-- helper `is_workspace_member` created in 0001_wave1_rls.sql.

alter table codebases enable row level security;
alter table codebase_scans enable row level security;
alter table detected_technologies enable row level security;
alter table detected_features enable row level security;

-- Same membership rule as projects: a workspace member may read everything
-- owned by a project in that workspace.
drop policy if exists "codebases_member_read" on codebases;
create policy "codebases_member_read" on codebases for select
  using (
    is_workspace_member(
      (select workspace_id from projects where projects.id = codebases.project_id),
      auth.uid()
    )
  );

drop policy if exists "codebase_scans_member_read" on codebase_scans;
create policy "codebase_scans_member_read" on codebase_scans for select
  using (
    is_workspace_member(
      (select projects.workspace_id from codebases
       join projects on projects.id = codebases.project_id
       where codebases.id = codebase_scans.codebase_id),
      auth.uid()
    )
  );

drop policy if exists "detected_technologies_member_read" on detected_technologies;
create policy "detected_technologies_member_read" on detected_technologies for select
  using (
    is_workspace_member(
      (select projects.workspace_id from codebases
       join projects on projects.id = codebases.project_id
       where codebases.id = detected_technologies.codebase_id),
      auth.uid()
    )
  );

drop policy if exists "detected_features_member_read" on detected_features;
create policy "detected_features_member_read" on detected_features for select
  using (
    is_workspace_member(
      (select projects.workspace_id from codebases
       join projects on projects.id = codebases.project_id
       where codebases.id = detected_features.codebase_id),
      auth.uid()
    )
  );

-- The anon/authenticated roles must hold SELECT for the policies above to be
-- reachable. Supabase's local default ACLs do not grant new public-schema
-- tables to anon (verified during Task 4 — BUG-018), so state the grants
-- explicitly. Idempotent: re-running db:setup is safe.
grant select on codebases to anon, authenticated;
grant select on codebase_scans to anon, authenticated;
grant select on detected_technologies to anon, authenticated;
grant select on detected_features to anon, authenticated;

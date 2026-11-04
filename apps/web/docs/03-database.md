# 03 — Database

PostgreSQL on Supabase, accessed through Drizzle.

## Principle

**Grow the schema in waves, not all at once.** Never create a later wave's
tables before the earlier waves are built and working.

## Wave 1 — Foundation

| Table                  | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `users`                | account identity                        |
| `workspaces`           | top-level container a user works inside |
| `workspace_members`    | user ↔ workspace membership             |
| `projects`             | a project inside a workspace            |
| `project_members`      | user ↔ project membership               |
| `project_integrations` | connected external services per project |

## Wave 2 — Codebase

`codebases` · `codebase_scans` · `detected_technologies` · `detected_features`

Backs the import → detect stack → understand project links of the MVP chain.

## Wave 3 — Roadmap

`roadmaps` · `phases` · `milestones` · `features` · `tasks` · `task_dependencies`

Backs generate roadmap → guide developer.

## Wave 4 — Documentation

`documentation_sources` · `documentation_links`

## Wave 5 — Testing & Deployment

`tests` · `test_runs` · `deployments` · `deployment_events`

## Wave 6 — Later

`releases` · `incidents` · `health_checks` · `ai_conversations` · `ai_actions` ·
`audit_logs`

Mostly post-MVP; see [Roadmap](04-roadmap.md).

## Conventions

To be fixed when Wave 1 is implemented: primary key type, timestamp columns,
soft deletes, and Row Level Security policy shape. Nothing is decided yet — do
not assume.

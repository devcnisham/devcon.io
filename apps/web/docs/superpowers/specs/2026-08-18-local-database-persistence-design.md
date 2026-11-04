# Design: Local Database + Persistence (steps 02, 04–06, 1.1)

Date: 2026-08-18
Status: approved by project owner

## Problem

Nothing persists. Workspace create/rename/delete, the project wizard, and the
codebase import ("canvas") all report that they cannot save. Route guards run
but have no session source. The fix is the database layer the docs already
planned, built locally first, swapped to Supabase cloud later.

## Decisions (owner-approved 2026-08-18)

- **Database path:** Supabase local dev stack now (`supabase` CLI + Docker),
  Supabase cloud later. Cloud swap = three env vars, no code change.
- **Sessions (D1):** Supabase-managed via `@supabase/ssr`.
- **Schema workflow:** Drizzle migrations (`drizzle-kit generate` + `migrate`).
- **PK type (D5):** `uuid` everywhere.
- **Unverified users (D3):** hard gate — no sign-in until email verified.
- **Scope:** wave 1 + wave 2 tables only (docs/03-database.md). No wave 3+.

## Architecture

New feature `src/features/database/` (fits existing feature convention):

```
src/features/database/
  index.ts          # barrel (client-safe)
  server.ts         # server-only exports: client, migrate, db
  schema.ts         # Drizzle table definitions, wave 1 + wave 2
  relations.ts      # Drizzle relations
  migrate.ts        # runs migrations at startup / via script
drizzle/
  migrations/       # generated SQL
supabase/
  config.toml       # local stack config
  migrations/       # RLS policies as Supabase SQL migrations
```

`server.ts` imports `server-only`; any client import fails the build
(project convention).

## Schema

### Wave 1 — foundation

| Table | Columns (beyond id uuid PK + created_at/updated_at) |
| --- | --- |
| `users` | email, email_verified_at (nullable), display_name |
| `workspaces` | name, slug (unique), deleted_at (soft delete) |
| `workspace_members` | workspace_id FK, user_id FK, role |
| `projects` | workspace_id FK, name, slug, description, deleted_at |
| `project_members` | project_id FK, user_id FK, role |
| `project_integrations` | project_id FK, kind, config jsonb, connected_at |

Conventions fixed here (docs/03-database.md left them open): `uuid` PK,
`created_at`/`updated_at` timestamps on every table, soft delete via
`deleted_at` on owner-owned tables (`workspaces`, `projects`).

### Wave 2 — codebase (canvas)

| Table | Purpose |
| --- | --- |
| `codebases` | project_id FK, root_path, file_count, total_bytes |
| `codebase_scans` | codebase_id FK, scanned_at, entries jsonb, skipped jsonb, errors jsonb |
| `detected_technologies` | codebase_id FK, name, category, confidence, evidence jsonb |
| `detected_features` | codebase_id FK, name, confidence, evidence jsonb |

`codebase_scans` stores the index as JSONB — the scan types
(`IndexedFile`, `SkippedFile`, `DetectionReport`) serialize as-is.

### RLS

Every table gets RLS policies: owner + members read/write per membership
tables. Supabase `service_role` bypasses RLS (server-only, per docs/blocker.md
2.1 warning). Policies live in `supabase/migrations/*.sql`.

## Auth wiring

- `setSessionProvider()` in `src/features/auth/server/session.ts` gets a real
  provider: reads session via `@supabase/ssr` (`createServerClient`), maps to
  `AuthSession` type.
- Server actions in `src/features/auth/actions/` replace `placeholder.ts`:
  signup, login, logout, reset-password, verify-email.
- Login action wires `RateLimitStore` + `BruteForceGuard` (built, tested,
  currently uncalled).
- CSRF token issued on form GET, checked on POST.
- Hard gate: `requireSession` checks `email_verified_at`; unverified users get
  redirected to `/verify-email`.
- `NEXT_PUBLIC_AUTH_ENABLED` can then be set for real.

## Workspace + projects persistence

Server actions per flow (each returns a typed result, UI states already exist):

- Workspace: `createWorkspace` (slug auto-derive logic already built),
  `renameWorkspace`, `deleteWorkspace` (soft).
- Project: `createProject` (wizard final step), project settings read/write.
- Permission model (`lib/permissions.ts`) becomes the enforcement point inside
  every action; same rules mirrored in RLS.
- Activity events: actions insert event rows (kind enum already in
  `workspace/types.ts`); feed reads them.

## Canvas persistence

- On scan completion, import page saves: codebase row + scan row +
  detection rows.
- Import screen loads latest scan and renders saved breakdown (components
  already exist: `detection-summary`, `language-breakdown`, etc.).
- Rescan writes a new `codebase_scans` row; incremental comparison reads the
  previous snapshot.

## Error handling

- Server actions return `{ ok: true, data } | { ok: false, error }` — never
  throw to the UI.
- DB errors logged server-side, generic message to user.
- Unique-violation on slug: retry with suffixed slug (slug logic tested
  already).

## Testing

- Test-first (project convention): action logic against a fake DB adapter.
- Drizzle migrations themselves verified by running them against local stack
  in a script (`scripts/` — also a known gap in docs/blocker.md).
- Playwright e2e remains open (B8 part) — out of scope here.
- Gates: `typecheck`, `lint`, `test`, `build` all green.

## Out of scope

- Wave 3+ tables (roadmap, docs, testing, deployment).
- Supabase cloud project creation (owner task).
- Email provider switch (D2: Supabase sender for now, per docs).
- OAuth providers (D4: GitHub later, build-order step 15).
- Playwright e2e.

## Trackers

Per CLAUDE.md: `docs/phase.md`, `docs/06-status.md`, `docs/blocker.md`
updated as each sub-step completes; B1/B2/B5 move to Resolved only when the
local stack actually runs migrations and a flow persists end to end.

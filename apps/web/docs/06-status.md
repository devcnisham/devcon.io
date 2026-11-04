# 06 — Status

_Last updated: 2026-08-19_

Live record of what is actually built. Update this whenever a step advances.

Phase 0 is **Production Foundation — build the platform itself**, and its
result is _a user can create and manage a project_. That result is **met on
the local stack** (2026-08-18/19): auth issues real sessions, workspaces and
projects persist, codebase scans save and load back into the import screen,
and the activity feed reads events (final review round). What remains
unbuilt: a created project does not appear in any list, and the rescan-diff
against the saved snapshot is not wired. A cloud Supabase project, CI, and a
deploy are still needed before it holds in production. See [phase.md](phase.md).

## Build order progress

| #   | Step                        | Status         |
| --- | --------------------------- | -------------- |
| 01  | Set up architecture         | 🟡 partial     |
| 02  | Set up database             | ✅ local       | (cloud Supabase pending — blocker.md)
| 03  | Set up authentication       | 🟡 partial     | (local stack live; D–G deferred)
| 04  | Build workspace             | 🟡 partial     | (create/rename/delete persist; feed reads events; members/billing deferred)
| 05  | Build project creation      | 🟡 partial     | (wizard + settings persist; list read path deferred)
| 06  | Build project dashboard     | ⬜ not started |
| 07  | Build local project import  | ✅ local       | (scans save; import screen loads the saved scan back)
| 08  | Build codebase scanner      | ⬜ not started |
| 09  | Build framework detection   | ⬜ not started |
| 10  | Build technology detection  | ⬜ not started |
| 11  | Build project intelligence  | ⬜ not started |
| 12  | Build roadmap engine        | ⬜ not started |
| 13  | Build task/step system      | ⬜ not started |
| 14  | Build documentation mapping | ⬜ not started |
| 15  | Build GitHub integration    | ⬜ not started |
| 16  | Build testing               | ⬜ not started |
| 17  | Build CI/CD                 | ⬜ not started |
| 18  | Build Supabase integration  | ⬜ not started |
| 19  | Build Vercel integration    | ⬜ not started |
| 20  | Build preview               | ⬜ not started |
| 21  | Build QA                    | ⬜ not started |
| 22  | Build production readiness  | ⬜ not started |
| 23  | Build deployment            | ⬜ not started |
| 24  | Build monitoring            | ⬜ not started |
| 25  | Build project health        | ⬜ not started |
| 26  | Test the entire journey     | ⬜ not started |
| 27  | Launch MVP                  | ⬜ not started |

## Step 01 — detail

**Done**

- Next.js 16 (App Router) + React 19 + TypeScript, `src/` layout, `@/*` alias
- Tailwind CSS v4
- shadcn/ui — all 61 components in `src/components/ui/`, Base UI variant,
  `base-nova` style, neutral base color, lucide icons
- Dark mode via next-themes; `Providers` wraps theme + tooltip + toast
- App shell: `src/components/layout/app-shell.tsx`, `app-sidebar.tsx`,
  `app-topbar.tsx`, `theme-toggle.tsx`
- Routes: `(marketing)/` landing, `(auth)/login`, `(auth)/signup`, `dashboard/`,
  `projects/`, `settings/`, `api/health/` — all placeholders
- `src/features/` convention + `_template/` + README
- `src/config/site.ts`, `src/config/nav.ts`, `src/types/index.ts`
- `src/lib/env.ts` (validated env access), `src/lib/utils.ts`
- Tooling: ESLint, Prettier + tailwind plugin, `typecheck` / `format` scripts
- `next.config.ts` — Turbopack root pinned
- This documentation

**Not done**

- `features/*` domain folders (only `_template/` exists)
- `lib/{database,auth,api,security,logging,errors}/`
- Top-level `tests/` (scripts/ exists — see Step 02)
- Git remote / GitHub repository
- GitHub Actions workflow (CI is wanted from day one)
- Playwright, Supabase client — not installed

## Step 02 — detail (database foundation)

Delivered 2026-08-18 against the live local Supabase stack (OrbStack +
`supabase` CLI).

- Dependencies: `drizzle-orm` + `postgres` (runtime), `drizzle-kit` + `dotenv`
  (dev). `npm audit`: **0 vulnerabilities** (scoped esbuild override for the
  `@esbuild-kit` chain — bug.md BUG-014).
- `src/features/database/server.ts` — the single Drizzle client, exported as
  `db`. Server-only (`import "server-only"`), so a client import fails the
  build. Reads `DATABASE_URL` via `@/lib/env`.
- `src/features/database/schema.ts` — placeholder, grown in waves (wave 1 in
  Task 3). `src/features/database/index.ts` — client-safe barrel.
- `drizzle.config.ts` — `out: ./drizzle/migrations`, dialect postgresql.
  Verified with `npx drizzle-kit check` ("Everything's fine").
- `scripts/db-smoke.mjs` + `npm run db:smoke` — the "database exists" gate.
  RED tested first: wrong database name → `PostgresError`, dead port →
  `ECONNREFUSED` (exit 1 both). GREEN: prints `[{"ok":1}]`.

**Wave 1 schema + migration + RLS landed 2026-08-18 (Task 3 of the
local-database-persistence plan).**

- `src/features/database/schema.ts` — six tables (`users`, `workspaces`,
  `workspace_members`, `projects`, `project_members`, `project_integrations`)
  with UUID PKs, cascading FKs, unique indexes (email lower, slug, member
  pairs, project/kind), soft-delete `deleted_at` on workspaces and projects
  only, and relations.
- `drizzle/migrations/0000_tranquil_weapon_omega.sql` — generated by
  `npx drizzle-kit generate`, applied via `npm run db:setup`.
- `supabase/migrations/0001_wave1_rls.sql` — row level security on all six
  tables with member-scoped SELECT policies; writes stay server-side via the
  service_role connection. Applied in order by `db:setup` after migrations.
- `scripts/db-setup.mjs` / `scripts/db-tables.mjs` + `npm run db:setup` /
  `npm run db:tables`. `db:tables` lists exactly the six wave 1 tables.
- `drizzle.config.ts` now loads `.env.local` explicitly (bug.md BUG-016) and
  fails loudly when `DATABASE_URL` is missing. The Drizzle client in
  `server.ts` is cached on `globalThis` so dev HMR does not leak a connection
  pool per reload.

**Wave 2 schema + RLS landed 2026-08-18 (Task 4 of the
local-database-persistence plan).**

- `src/features/database/schema.ts` — four more tables (`codebases`,
  `codebase_scans`, `detected_technologies`, `detected_features`) with UUID
  PKs, cascading FKs to `projects`/`codebases`, unique indexes (one codebase
  per project; one technology/feature per codebase), JSONB `evidence`
  defaults `[]`, and `codebasesRelations` (`one project`, `many` scans /
  technologies / features).
- `drizzle/migrations/0001_salty_ben_grimm.sql` — generated by
  `npx drizzle-kit generate`, applied via `npm run db:setup`.
- `supabase/migrations/0002_wave2_rls.sql` — RLS on all four tables with
  member-read policies through the `is_workspace_member` helper (same shape
  as wave 1), plus explicit SELECT grants to anon/authenticated
  (bug.md BUG-018).
- `npm run db:tables` lists all **10** tables. Anon verification: member JWT
  claims see the fixture rows, an outsider sees none, no recursion errors.

## Step 03 — detail (phase 0.1, frontend)

**Done — UI layer**

- `src/features/auth/` with `components/`, `lib/`, `types.ts`, `index.ts`
- Screens: `/login`, `/signup`, `/forgot-password`, `/reset-password`,
  `/verify-email` — all under the `(auth)` route group
- Zod schemas in `lib/schemas.ts` — email, password rules, confirm-match,
  terms acceptance; shared by every form
- Forms via react-hook-form + `zodResolver`: inline field errors, form-level
  error banner, disabled inputs while submitting, pending button labels
- States: loading (`(auth)/loading.tsx` skeleton), error boundary
  (`(auth)/error.tsx`), success states for forgot-password and reset-password,
  invalid/expired-link state for reset-password
- `PasswordField` show/hide toggle, `PasswordStrength` meter, `AuthAlert`
  banners, `SubmitButton` with spinner
- `VerifyEmailCard` with resend + 60s cooldown
- `LogoutButton` in the sidebar footer
- `RequireAuth` / `RequireGuest` — **presentational only**, session passed in as
  a prop; not a security boundary

**Not done — deferred to the backend phase**

- No auth client. Every form calls `lib/placeholder.ts`, which waits ~900ms and
  resolves. Submitting `error@devstep.test` throws, which is the only way to
  reach the error state before a backend exists — delete that file when the real
  client lands.
- No session: nothing is stored, read, or verified anywhere.
- No route protection. `/dashboard`, `/projects`, `/settings` are open, and the
  auth screens are reachable while "signed in". `RequireAuth`/`RequireGuest`
  render states but enforce nothing.
- No email delivery, no tokens, no verification, no password reset.
- No OAuth or GitHub login.

## Step 03 — security primitives (phase 0.1.2 item S)

Delivered 2026-08-13, test-driven — test written and watched fail before every
module. **70 tests for these six modules**, all passing.

| Module                                    | Purpose                                 |
| ----------------------------------------- | --------------------------------------- |
| `src/features/auth/lib/password.ts`       | argon2id hashing, verify, needs-rehash  |
| `src/features/auth/lib/csrf.ts`           | Double-submit token + origin validation |
| `src/features/auth/lib/rate-limit.ts`     | Fixed-window limiter, pluggable store   |
| `src/features/auth/lib/brute-force.ts`    | Progressive login lockout               |
| `src/features/auth/lib/session-policy.ts` | Idle (7d) + absolute (30d) expiry       |
| `src/features/auth/lib/cookies.ts`        | `__Host-` cookie flags                  |

Exported from `@/features/auth/server` — **never** the client barrel.
`password.ts` imports `server-only`, so a client import fails the build rather
than shipping argon2 to the browser.

**Nothing calls these yet.** There is no session, user record, or server action
to apply them to. They are primitives waiting for items A–G.

Vitest is now installed (`npm test`), clearing blocker B8.

## Step 03 — route guards (phase 0.1.3)

Delivered 2026-08-13. Two enforcement layers, **inert by default**.

| File                                               | Role                                         |
| -------------------------------------------------- | -------------------------------------------- |
| `src/features/auth/lib/route-policy.ts`            | Pure policy shared by both layers — 16 tests |
| `src/features/auth/lib/auth-enabled.ts`            | The switch: `NEXT_PUBLIC_AUTH_ENABLED`       |
| `src/middleware.ts`                                | Edge pass — cookie presence only             |
| `src/features/auth/server/session.ts`              | Node pass — validates the session            |
| `src/app/{dashboard,projects,settings}/layout.tsx` | Call `requireSession`                        |
| `src/app/(auth)/layout.tsx`                        | Calls `requireGuest`                         |

**Why inert.** Enforcing before a login flow exists would redirect every
protected route to a page that cannot issue a session. Set
`NEXT_PUBLIC_AUTH_ENABLED=true` when the backend lands.

Verified in both states: with the switch off every route returns 200; with it
on, `/dashboard`, `/projects`, `/settings` redirect to `/login?next=…` with the
query preserved, while `/login`, `/signup`, `/verify-email`, and `/` stay open.

**Still missing:** a session provider. `setSessionProvider()` is the seam.

## Step 03 — session provider (phase 0.1.2 B, part of Task 5)

Delivered 2026-08-18, test-driven. The provider seam in `server/session.ts` is
now filled — `getSession()` can resolve real Supabase sessions.

| File                                                 | Role                                               |
| ---------------------------------------------------- | -------------------------------------------------- |
| `src/features/auth/server/session-provider.ts`       | Maps a Supabase session → `AuthSession` (D3 gate: unverified users → `null`), 2 tests |
| `src/lib/server/supabase.ts`                         | One Supabase server client per request (cookie-aware) |
| `src/lib/server/init.ts`                             | `registerAuthSessionProvider()` — cross-feature boot wiring |
| `src/app/layout.tsx`                                 | Calls `registerAuthSessionProvider()` once per request |

The provider contract's `token` argument is satisfied by Supabase's own
session cookie — `getSession()` reads it directly. `NEXT_PUBLIC_AUTH_ENABLED`
is now `true` in `.env.example` and `.env.local` (Task 11, 2026-08-19), so the
guards are live: `/dashboard`, `/projects`, `/settings` redirect signed-out
visitors to `/login?next=…`, and the auth screens redirect signed-in users.
Proven live by the Task 11 smoke test.

## Step 03 — signup + login server actions (phase 0.1.2, Task 6)

Delivered 2026-08-18, test-driven — 4 new tests, watched fail before the
factory existed. The login and signup forms now submit to real server actions
instead of the placeholder.

| File                                                  | Role                                                      |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `src/features/auth/lib/actions.ts`                    | `"use server"` module: `loginAction`, `signupAction`, `issueCsrfToken`, and the tested `createAuthActions` factory (4 tests) |
| `src/features/auth/lib/actions.test.ts`               | Fake-deps tests: success, CSRF failure, lockout, failure recording |
| `src/app/(auth)/login/page.tsx`                       | Issues the CSRF token and hands it to the form            |
| `src/app/(auth)/signup/page.tsx`                      | Same for signup                                          |
| `src/features/auth/components/login-form.tsx`         | Calls `loginAction`, surfaces `result.message` on failure |
| `src/features/auth/components/signup-form.tsx`        | Calls `signupAction`; success state: "Check your email to verify your account." |

The login action chains, in order: schema parse → CSRF (double-submit token +
origin check) → brute-force lockout check → rate-limit consume → Supabase
`signInWithPassword` → failure recording → session-marker cookie. The signup
action chains: schema parse → CSRF checks → Supabase `signUp` with
`emailRedirectTo: {NEXT_PUBLIC_APP_URL}/verify-email`. Limits: 5 login
attempts/minute/email; 5 failures before a lockout that doubles from 60s up
to a 1h cap.

Two deliberate deviations from the plan, both forced by the real framework
shapes:

- **CSRF cookie write.** Next 16 forbids writing cookies during Server
  Component rendering, so the page issues the token and the form writes the
  cookie copy via `issueCsrfToken` (a server action) on mount. Next's own
  origin check on server-action POSTs keeps that callable only from our pages.
- **Origin check gating.** `isTrustedOrigin` fails closed on an empty allowed
  origin, so the origin check only engages once `NEXT_PUBLIC_APP_URL` is
  configured; the token check is always on.

`AUTH_ENABLED` stays unset (Task 11 flips it) — the actions are the auth
client itself and work regardless.

## Step 04 — logout, forgot/reset password, verify-email actions (phase 0.1.2, Task 7)

Delivered 2026-08-18, test-driven — 3 new tests in `actions.test.ts`, watched
fail (factory methods missing) before they existed. The last four placeholder
submits are gone: every auth form now calls a real server action.

| File                                                  | Role                                                      |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `src/features/auth/lib/actions.ts`                    | Factory gains `logout`, `forgotPassword`, `resetPassword`, `resendVerification` (9 tests) plus the bound `logoutAction`, `forgotPasswordAction`, `resetPasswordAction`, `resendVerificationAction` |
| `src/features/auth/components/logout-button.tsx`      | Calls `logoutAction`, then `router.push("/login")`        |
| `src/features/auth/components/forgot-password-form.tsx` | Submits to `forgotPasswordAction`; success shows the action's account-neutral message |
| `src/features/auth/components/reset-password-form.tsx`  | Submits to `resetPasswordAction`; errors surfaced, success state kept |
| `src/features/auth/components/verify-email-card.tsx`    | Resend button calls `resendVerificationAction`; 60s cooldown kept |
| `src/app/(auth)/{forgot-password,reset-password,verify-email}/page.tsx` | Each issues `createCsrfToken()` and passes it down, same as login/signup |

Key properties: `forgotPassword` returns the same success message whether or
not the account exists (no existence leak); `logout` clears both
`SESSION_COOKIE` and `CSRF_COOKIE` via `clearedCookieOptions`; all three new
guarded actions run the same CSRF double-submit + origin check as login/signup,
and each new page's form writes its CSRF cookie copy on mount via
`issueCsrfToken` (Next 16 forbids cookie writes during render — same pattern
as Task 6). Email delivery runs on the Supabase local sender — the D2 path;
production sender is blocker B3.

Two deviations from the plan brief, both forced by the code it was written
against:

- **Test code.** The brief's three tests were un-awaited
  (`createAuthActions(...)` is async, so the destructured methods are
  undefined) and asserted `"devstep-session"`, but the real constant is
  `"__Host-devstep_session"`. Fixed: awaited factory calls, assertion against
  the imported `SESSION_COOKIE`.
- **`AuthActionResult` widened.** The brief's components must show a success
  `message` that the Task 6 union `{ ok: true } | { ok: false; message }`
  cannot express. The `ok: true` member now carries `message?: string` —
  backwards-compatible (plain successes still `{ ok: true }`).

## Step 04 — workspace persistence (phase 0.3, Task 8)

Create, rename, and delete now persist to the local Supabase stack.

- `src/features/workspace/server/workspace-service.ts` — `WorkspaceDb` seam,
  `createWorkspaceService(db)` returning create/rename/delete. Permission
  gates: create makes the caller `owner`; rename needs `workspace:update`;
  delete needs `workspace:delete` (owner-only). Slug uniqueness via
  `uniqueSlug`; each operation writes an activity event.
- `src/lib/server/stores/workspace-store.ts` — Drizzle implementation of the
  seam (app glue; `workspaceService` singleton). Soft delete sets
  `deleted_at`; slug listing excludes deleted workspaces
  (`isNull(workspaces.deletedAt)`).
- `src/features/workspace/lib/actions.ts` (`"use server"`) — thin glue:
  session check → zod parse → service. Components call the actions directly.
- `workspace_activities` table (id, workspace_id FK cascade, kind,
  actor_name, summary, occurred_at, timestamps) in wave 1 schema; RLS policy
  `workspace_activities_member_read` via `is_workspace_member` in
  `0001_wave1_rls.sql`; migration `drizzle/migrations/0002_*.sql`; `db:setup`
  re-run and verified (8 columns, policy live, RLS enabled).
- Forms wired: create (success banner + form reset), rename (success banner,
  dirty state reset), delete (submitting state, error/success banners); the
  settings page passes a placeholder `workspaceId` until workspaces resolve
  from the session. `"workspace.deleted"` added to `ActivityKind` + feed icon.

The actions return "You must be signed in." only when genuinely signed out —
`getSession()` resolves real Supabase sessions since Task 11 flipped
`AUTH_ENABLED` (2026-08-19).

Deviations from the plan brief, all forced by the code it was written against:

- **`insertEvent` carries `workspaceId`.** The brief's row type and store
  `values(row)` cannot compile — `workspace_activities.workspace_id` is NOT
  NULL, and the service knows which workspace it just wrote. Added
  `workspaceId` to the `WorkspaceDb.insertEvent` row and to all three call
  sites; the fake db in the test records only `{ kind, summary }` so the
  brief's assertions hold.
- **`and(eq, eq)` in `findMembership`.** The brief's `eq(a) && eq(b)` silently
  drops the first condition — drizzle `SQL` objects are always truthy — so the
  lookup would match any workspace the user belongs to.
- **`isNull(workspaces.deletedAt)`** per the binding note (not
  `eq(..., null as never)`).
- **Delete-event assertion** fixed to `workspace.deleted` and added to the
  `ActivityKind` union, per the binding notes.

Final review round (2026-08-19):

- **Feed read path.** `WorkspaceDb.findWorkspaceEvents(workspaceId)` returns
  the workspace's newest 50 events (newest first), wired through
  `loadWorkspaceActivityAction` (session-checked, try/catch) to the
  `ActivityFeed` component, which degrades to its empty state on failure.
  `/activity` resolves the user's workspace server-side via
  `findWorkspacesForUser` (the wizard pattern) and passes its id in.
  Integration-tested against the real stack (newest-first + empty-workspace
  cases).

## Task 9 — Project persistence (wizard save + settings)

Task 9 of 11: the wizard's final step now saves, and the settings page reads
and writes a real project. Mirrors the Task 8 workspace pattern.

- `src/features/project/server/project-service.ts` — persistence seam
  (`ProjectDb`, `ProjectActionResult`), `createProjectService(db)` with
  `createProject` (membership gate `project:create`, slug derived via
  `uniqueSlug`), `updateProjectSettings` (existence + soft-delete guards
  first, then `project:update`), and `getProjectSettings` (guards, then
  `project:read`; returns the real settings shape — the brief's `data: null`
  placeholder was replaced because the settings page needs real data).
- `src/lib/server/stores/project-store.ts` — Drizzle implementation (app
  glue): `listProjectSlugs` deliberately reads **every** row (deleted slugs
  stay reserved — the unique index covers soft-deleted rows, the BUG-019
  defect class), `findProject` maps nullable DB columns, and
  `findCurrentProject(userId)` resolves "the current project" (latest
  non-deleted project in a workspace the user belongs to) for the settings
  page. Exports `projectService`.
- `src/features/project/lib/actions.ts` (`"use server"`) — thin glue: session
  check → zod parse (the create path validates too, like workspace actions) →
  service, wrapped in try/catch (`"Something went wrong. Try again."`) with
  `revalidatePath` after every mutation.
- `src/lib/server/stores/workspace-store.ts` — added `findWorkspacesForUser`
  (live workspaces, oldest first); the wizard resolves its workspace there.
- Wizard: `/projects/new` resolves the workspace server-side (honest
  "Create a workspace first" empty state when none exists); the final step
  calls `createProjectAction`, surfaces `result.message` on failure, and shows
  a success state linking to `/projects`. Visibility/status default to
  `private`/`active` in the draft, so no mapping was needed.
- Settings: form takes a `projectId`, calls `updateProjectSettingsAction`,
  shows error/success banners; the page loads real defaults through
  `findCurrentProject` + `getProjectSettings`, or a "No project selected"
  empty state (project resolution is partial — route-level selection is
  Task 11). The stack is collected in the wizard but not persisted (no
  `project_technologies` column yet).

Deviations from the plan brief, all forced by the code it was written against:

- **The wizard does not carry `workspaceId`.** The brief assumed it did. The
  server page now resolves the user's first workspace
  (`findWorkspacesForUser`) and passes it as a prop; a no-workspace user sees
  a create-workspace-first empty state.
- **`memberCan` casts `role as WorkspaceRole`** (from
  `@/features/workspace/lib/permissions`), not the brief's `as never`.
- **Soft-delete guards on update/read** ("Project already deleted.") and
  **`getProjectSettings` returns real data** — the brief's `data: null`
  placeholder is replaced, tested, and used by the settings page.
- **`updateProject` takes a narrow `ProjectSettingsPatch`** instead of the
  brief's `Record<string, string>` so stray keys cannot become columns.
- **The brief's `type: "web"` test values are illustrative** — the real
  `PROJECT_TYPES` enum members (`"website"`, `"web-app"`, …) are used, and the
  service test's settings assertion types against `ProjectType`.
- **`createProjectAction` validates with `projectSettingsSchema`** too
  (mirroring `createWorkspaceAction`), not just the update action.

## Task 10 — Canvas persistence (save/load codebase scans)

Task 10 of 11: an import now saves. The scan result (indexed, skipped, errors)
and the analysis (frameworks, features, architecture, languages, runtimes,
toolchain, dependencies, snapshot) persist to the wave 2 tables, and the
"not saved yet" placeholder on the import screen is a real save button.

- `src/features/codebase/server/codebase-service.ts` — persistence seam
  (`CodebaseDb`, `CodebaseActionResult`), `createCodebaseService(db)` with
  `saveAnalysis` (project existence + soft-delete guards first — clean
  "Project not found." / "Project already deleted." messages matching the
  project service; creates the `codebases` row on first import, reuses it on
  rescan; inserts the scan snapshot; replaces the codebase's detected
  technologies and features) and `loadLatest`. Detection confidence (0..1 in
  the engine) is stored as a 0..100 integer — the raw float would silently
  round to 1 in the integer column (BUG-020).
- `src/lib/server/stores/codebase-store.ts` — Drizzle implementation (app
  glue): `findProject` delegates to the project store for the save guard,
  `replaceTechnologies`/`replaceFeatures` delete then insert (the detected
  rows are a snapshot of the latest analysis, so a rescan can drop a
  technology the project no longer uses), `findLatestScan` orders by
  `scannedAt desc` scoped to the project's own codebase. Exports
  `codebaseService`.
- `src/features/codebase/lib/actions.ts` (`"use server"`) — thin glue:
  session check → service, wrapped in try/catch ("Something went wrong. Try
  again.") with `revalidatePath("/projects/import")` after a save.
- Import screen: `ImportProject` takes a `projectId` prop, gains a "Save
  index" button when a scan is done, and replaces the "not saved yet"
  paragraph with an honest saved-state line ("Index saved." / failure
  message). The page resolves the current project server-side via
  `findCurrentProject` and shows a "Create a project first" empty state when
  none exists.

Deviations from the plan brief, all forced by the code it was written against:

- **`CodebaseDb.findProject`** was added to the seam so `saveAnalysis` can
  enforce the existence + soft-delete guards the review lessons demanded; the
  brief's service code skipped them.
- **Confidence is mapped to 0..100 integers** (`Math.round(confidence * 100)`)
  because the engine's `Detection.confidence` is 0..1 and the wave 2 columns
  are integers — the brief's literal pass-through would destroy the value.
- **The fixture's `confidence: 100`** (a 0..100-scaled value in the brief's
  test) was replaced with a real 0..1 value and the test asserts the mapped
  0..100 integer, pinning the mapping against the real engine.
- **`rootPath` is the folder name** (`handle?.name ?? "local folder"`) — a
  browser cannot expose a real filesystem path, so the honest substitute is
  the name of the picked directory.

Fix round 1 (2026-08-19):

- **Save-state race fixed (BUG-021).** A rescan completing during a save could
  show the new unsaved scan under "Index saved." The save is now bound to the
  scan it started on via a scan token; on resolution, a moved-on token leaves
  the state idle instead of "saved". Rescan is disabled while saving, and Save
  is disabled once saved (no duplicate identical scan rows). The binding is a
  pure, unit-tested function (`codebase/lib/save-state.ts`).
- **`findLatestScan` ignores soft-deleted projects** — joins `projects` and
  filters `isNull(projects.deletedAt)`, proven by a new discriminating
  integration test (failed against the unfiltered store, passes against the
  real one).
- **BUG-020 wording corrected** — the 0..100 confidence column round-trips
  within 0.5%, not losslessly (0.875 → 88 → 0.88).

Fix round 2 (final whole-branch review, 2026-08-19):

- **Permission gates in the canvas service.** `saveAnalysis`/`loadLatest` now
  resolve the project's workspace and the caller's membership
  (`findProjectWorkspace` + `findWorkspaceMembership`) and enforce
  `project:update` / `project:read` via `can(role, …)` — denied →
  "You do not have permission to do that.", unknown project → "Project not
  found.". The codebase store reuses the project store's membership lookup.
- **Rescan refreshes the codebase row.** Saving a new scan over an existing
  codebase updates `fileCount`/`totalBytes` instead of leaving the row stale.
- **Import screen loads the saved scan.** On mount,
  `loadLatestImportAction(projectId)` runs and renders
  "Saved scan from <date> — N file(s) indexed." (file count from the
  analysis summary, falling back to entry count).

## Task 11 — auth flag, guards live, final gates (2026-08-19)

The closing task of the local-database-persistence plan.

- `NEXT_PUBLIC_AUTH_ENABLED=true` added to `.env.example` (with the
  "route protection + session validation" comment) and set in `.env.local`.
  The route guards and session validation are now live — the middleware
  redirects signed-out visitors, the layout guards validate the session.
- `createProject` gained a workspace-level guard (Task 9 review finding):
  after the membership check, `ProjectDb.findWorkspace` is consulted — a
  missing workspace denies with "Workspace not found.", a soft-deleted one
  with "Workspace already deleted." (a membership row survives a soft
  delete, so membership alone was not enough). 2 service tests added.
- The codebase-store integration test's soft-delete case is now
  self-contained: it seeds its own project/codebase/scan instead of
  mutating the shared project B, so the file is order-independent (Task 10
  review finding). Cleanup rides the workspace cascade in `afterAll`.
- `LogoutButton` wrapper checked at its only placement (sidebar footer):
  the `flex flex-col gap-2` div sits inside the footer's flex column and
  the button is `w-full` — verified fine, no visual change.
- Smoke test against the live stack (dev server + GoTrue): signup, token
  grant, `/api/health`, `/login` — all passed (details in the task report).

## Test coverage

605 tests, all passing. Every one covers pure logic — there is no test of a UI
component, and no end-to-end test.

| Feature     | Tests | What is covered                                                                                        |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------ |
| `auth`      | 100   | Password hashing, CSRF, rate limiting, brute-force lockout, session expiry, cookie flags, route policy, session mapping, signup/login/logout/reset/verify actions (incl. email-not-confirmed nudge, resendVerification error hygiene) |
| `codebase`  | 65    | `.gitignore` matching, binary and large-file classification, the scanner, the codebase service (workspace permission gates, codebase creation, rescan + count refresh, technology/feature replacement, loadLatest), the save-state token binding |
| `project`   | 52    | Wizard step machine, technology catalogue, project service (create/update/read, permission + soft-delete guards + workspace-existence guard) |
| `dashboard` | 35    | Progress, health scoring, next-action ranking                                                          |
| `workspace` | 37    | Role capabilities, slug derivation, workspace service                                                   |

Integration tests against the real local stack (skipped when the connection
is refused — `ECONNREFUSED` probe at collection time, vitest 4.1 has no
runtime skip): the workspace and project stores each have a discriminating
soft-deleted-slug-reservation test — proven to fail against a store that
filters `isNull(deletedAt)`, pass against the real one. The codebase store's
`findLatestScan` test is the same class: it failed against an ascending-order
store and passes against the real one, proven both ways. Fix round 1 added a
second discriminator: soft-deleting a project must hide its scans — it failed
against a store without the `isNull(projects.deletedAt)` filter and passes
against the real one. Task 11 made the soft-delete case self-contained (its
own seeded project) so the file is order-independent. Final review round
added: `findWorkspaceEvents` newest-first + empty-workspace cases, and the
auth-users-sync test (insert into `auth.users`, poll for the trigger's mirror
row, delete both).

**Not covered:** every React component, every route, and the browser scan
adapters. Those have been verified by driving Chrome manually, which is not the
same as a test that runs in CI. Playwright is the gap — see
[blocker.md](blocker.md).

## Verification gates

All currently passing (final review fix round, 2026-08-19):

```
npm run typecheck   → 0
npm run lint        → 0
npm run build       → 0
npm test            → 605 passed
```

Browser console verified in Chrome across every route built so far — **zero
errors, zero warnings** on each. A 404 page logs the expected failed-resource
line and nothing else.

Auth screens exercised, not just loaded: validation errors render, pending
states show, the error banner triggers, the password toggle flips the input
type, and the terms checkbox toggles by label click.

The Task 11 smoke test exercised the live loop against the local stack (dev
server + GoTrue): signup, password token grant, `/api/health` 200, `/login`
200 — details in `.superpowers/sdd/task-11-report.md`.

Defects found and fixed are logged in [bug.md](bug.md) — 21 logged, all
fixed; no new defects surfaced by Task 11.

## Open items

- No git remote / GitHub repository yet — everything lives on the
  `feat/mvp-foundation` branch.
- No GitHub Actions workflow yet, though CI is wanted from day one.
- Playwright not installed — no end-to-end test exists.
- Auth UI has no tests; only the security primitives and server actions are
  covered.
- `src/features/auth/lib/placeholder.ts` is unused since Task 7 but still
  present — deletion tracked in blocker.md.
- Projects-list read path and route-level project selection are remaining
  work (planned for Task 11 but not in its final scope).

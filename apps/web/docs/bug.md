# Bug Log

Every defect found in this project: what broke, why, how it was caught, and what
stops it recurring. **Updated as bugs are found and fixed** — a bug is only
moved to Fixed once a gate proves it.

| Legend | Meaning                         |
| ------ | ------------------------------- |
| 🔥     | security impact                 |
| 🔴     | breaks the build or a user flow |
| 🟠     | wrong behaviour, contained      |
| 🟡     | noise — warnings, DX friction   |
| ✅     | fixed and verified              |
| 🔓     | open                            |

---

## Open

| #   | Severity | Summary | Where |
| --- | -------- | ------- | ----- |
| —   |          | _None._ |       |

Known limitations that are **not** bugs — they are unbuilt work — live in
[blocker.md](blocker.md). The two worth repeating here because they look like
working features:

- `RequireAuth` / `RequireGuest` render the right states but **enforce
  nothing**. Session arrives as a prop; there is no check. Not a security
  boundary.
- `MemoryRateLimitStore` is per-process. On serverless or multiple instances
  the effective rate limit multiplies by the instance count.

---

## Fixed

| #       | Severity | Summary                                                            | Found by                  | Date       |
| ------- | -------- | ------------------------------------------------------------------ | ------------------------- | ---------- |
| BUG-001 | 🟡       | 4 console errors on `/` — Base UI `Button` rendered as a link      | Browser console capture   | 2026-08-13 |
| BUG-002 | 🔥       | Brute-force failure counts wiped by store pruning                  | Test written first        | 2026-08-13 |
| BUG-003 | 🔥🔴     | argon2 pulled into the client bundle, build failed                 | `npm run build`           | 2026-08-13 |
| BUG-004 | 🔴       | Stale generated route types broke `typecheck` after route changes  | `npm run typecheck`       | 2026-08-13 |
| BUG-005 | 🟠       | Tracker hook missed brand-new files — git collapses untracked dirs | Hook test in scratch repo | 2026-08-13 |
| BUG-006 | 🟡       | React Compiler warnings from `watch()` in react-hook-form          | `npm run lint`            | 2026-08-13 |
| BUG-007 | 🟡       | `server-only` threw during tests                                   | `npm test`                | 2026-08-13 |
| BUG-008 | 🟡       | `const enum` import failed under `isolatedModules`                 | `npm run typecheck`       | 2026-08-13 |
| BUG-013 | 🟡       | Smoke script read `.env`, not `.env.local` — never saw `DATABASE_URL` | `node scripts/db-smoke.mjs` | 2026-08-18 |
| BUG-014 | 🟡       | `npm audit`: 4 moderate — `drizzle-kit` → `@esbuild-kit` → esbuild 0.18.20 | `npm audit`          | 2026-08-18 |
| BUG-015 | 🟡       | `supabase start`'s generated `supabase/.temp/` bundle failed lint (154 errors) | `npm run lint`    | 2026-08-18 |
| BUG-016 | 🟡       | `drizzle.config.ts` + setup scripts would not see `DATABASE_URL` (dotenv loads `.env` only) | Task 2 review + `drizzle-kit generate` | 2026-08-18 |
| BUG-017 | 🔴       | RLS policies recursed — "infinite recursion detected" for any anon query on wave 1 tables | Review execution check (ran policies as anon) | 2026-08-18 |
| BUG-018 | ✅       | Wave 2 tables unreadable by anon/authenticated — RLS enabled but no SELECT grants (Supabase local default ACLs do not cover new public tables) | Anon-role verification (Task 4) | 2026-08-18 |
| BUG-019 | ✅       | Delete a workspace then recreate it with the same name → unhandled 500 on the slug unique index | Task 8 review | 2026-08-18 |
| BUG-020 | 🟠       | Detected confidence 0..1 inserted raw into an integer column would silently round (0.73 → 1) | Code inspection while writing the scan-save mapping | 2026-08-19 |
| BUG-021 | 🟠       | Save-state race: a rescan completing during a save could show the new unsaved scan under "Index saved." | Fix-round review of Task 10 (component state logic) | 2026-08-19 |
| BUG-022 | 🔴       | Nothing synced `auth.users` → `public.users`, so the first workspace create by a real (GoTrue) user failed with an FK violation on `workspace_members.user_id` | Final whole-branch review (full-tree grep for the sync seam) | 2026-08-19 |

---

### BUG-001 — Button rendered as a link lost native button semantics 🟡

**Symptom.** Four identical console errors on `/`, none on any other route.

```
Base UI: A component that acts as a button expected a native <button> because
the `nativeButton` prop is true.
```

**Root cause.** Base UI's `Button` defaults `nativeButton` to true. Rendering a
`<Link>` (an `<a>`) through the `render` prop strips native button semantics —
an accessibility problem, not only console noise. Four instances: two in
`(marketing)/layout.tsx`, two in `(marketing)/page.tsx`.

**Fix.** `nativeButton={false}` on all four. Correct semantics — they are links.

**Verified.** All 6 routes re-checked in Chrome: 0 errors, 0 warnings.

**Prevention.** Any `<Button render={<Link …/>}>` needs `nativeButton={false}`.

---

### BUG-002 — Brute-force protection was silently defeatable 🔥

**Symptom.** None. Nothing failed, nothing warned. The guard would simply not
have locked anyone out.

**Root cause.** `BruteForceGuard` reused the rate limiter's `{count, expiresAt}`
shape, storing the lockout deadline in `expiresAt`. An unlocked record has no
lockout deadline, so `expiresAt` was `0` — and `MemoryRateLimitStore.prune()`
deletes anything whose `expiresAt` has passed. Any prune wiped every
accumulated failure count. An attacker would face five separate "first
attempts" instead of a lockout, forever.

**Fix.** Retention and lockout are now separate fields. `expiresAt` is the
retention deadline (`now + maxLockoutMs`); the real lockout deadline is carried
in `lockedUntil`.

**Caught by.** Writing the test before the code. The failing test:

```ts
it("keeps failure counts when the store is pruned", async () => {
  for (let i = 0; i < 4; i++) await guard.recordFailure("u");
  await store.prune(now);
  await guard.recordFailure("u");
  expect((await guard.check("u")).locked).toBe(true); // was false
});
```

**Prevention.** That test is permanent. Note the shape: a security control that
fails **open** produces no error — only a test that asserts the control
actually engages will catch it.

---

### BUG-003 — Password hashing was being bundled for the browser 🔥🔴

**Symptom.** `npm run build` failed:

```
Module not found: ./node_modules/@node-rs/argon2/browser.js
Client Component Browser: ./src/features/auth/lib/password.ts
```

**Root cause.** The security modules were exported from
`src/features/auth/index.ts`. That barrel is imported by client components
(`(auth)/error.tsx`), so everything it re-exports gets bundled for the browser —
including argon2. The build failure was the lucky outcome; a pure-JS hashing
library would have shipped silently instead.

**Fix.** Split the surface. Server-only code moved to
`src/features/auth/server.ts`, and `password.ts` imports `server-only`, which
turns a mistaken client import into a build error.

**Verified.** `build → 0`, and no `argon2` string in `.next/static/`.

**Prevention.** Recorded as a project convention in
[02-architecture.md](02-architecture.md) and enforced by `server-only`.

---

### BUG-004 — Stale generated route types 🔴

**Symptom.** `typecheck` failed after route changes, pointing at files that had
been deleted.

```
.next/types/validator.ts: Cannot find module '../../src/app/(app)/layout.js'
```

**Root cause.** Next generates route types into `.next/types/`. Deleting or
moving a route leaves the old entry until a full build regenerates it. The dev
server does not rewrite `validator.ts` on its own.

**Fix.** `rm -rf .next && npm run build`.

**Prevention.** After adding, moving, or deleting routes, do a clean rebuild
before trusting `typecheck`.

---

### BUG-005 — Tracker hook could not see brand-new files 🟠

**Symptom.** The Stop hook blocked a turn where the trackers _had_ been
updated — because both were new, untracked files.

**Root cause.** `git status --porcelain` collapses untracked directories to a
single entry (`?? docs/`), so the per-file pattern never matched.

**Fix.** `git status --porcelain -uall`, which lists untracked files
individually.

**Caught by.** Testing the hook against six scenarios in a throwaway repo
before wiring it up, rather than trusting it to work.

---

### BUG-006 — React Compiler bailed out of two components 🟡

**Symptom.** Two lint warnings:

```
React Hook Form's `useForm()` API returns a `watch()` function which cannot be
memoized safely. Compilation Skipped: Use of incompatible library.
```

**Root cause.** `watch()` returns a new function identity each render, so the
React Compiler skips memoizing the whole component — a silent performance loss
in `signup-form.tsx` and `reset-password-form.tsx`.

**Fix.** Replaced `watch("field")` with `useWatch({ control, name })`, which the
compiler can handle.

**Prevention.** Prefer `useWatch` over `watch` in this codebase.

---

### BUG-007 — `server-only` broke the test run 🟡

**Symptom.** `npm test` failed at import: _"This module cannot be imported from
a Client Component module."_

**Root cause.** The `server-only` package throws unless the bundler selects its
`react-server` export condition. Vitest runs plain Node, so every server module
threw on import. Setting `resolve.conditions` did not help — the package
resolved through its default entry regardless.

**Fix.** Aliased `server-only` to a no-op stub in `vitest.config.ts`. The real
guarantee is enforced by `next build`, which is where the client/server
boundary actually exists.

---

### BUG-008 — `const enum` import failed under `isolatedModules` 🟡

**Symptom.** `typecheck` failed:

```
TS2748: Cannot access ambient const enums when 'isolatedModules' is enabled.
```

**Root cause.** `@node-rs/argon2` exports `Algorithm` as an ambient const enum.
Next sets `isolatedModules`, which forbids importing one.

**Fix.** Use the literal value `2` with a comment. The `needsRehash` regex pins
the algorithm name (`$argon2id$`) independently, so a drift cannot pass
unnoticed.

**Verified.** Hash output still begins `$argon2id$v=19$m=19456`.

---

### BUG-009 — The middleware guard layer never ran 🔥🔴

**Symptom.** With enforcement on, protected routes _did_ redirect — so it
looked correct. But `/projects?filter=active` redirected to
`/login?next=%2Fprojects`, dropping the query, and `/projects/abc?tab=x` was
not redirected at all.

**Root cause.** `middleware.ts` sat at the repository root. This project uses a
`src/` directory, where Next requires `src/middleware.ts`. The file was simply
never loaded. Every redirect observed was coming from the _layout_ guard, whose
`requireSession("/projects")` argument is a hardcoded literal — which is
exactly why the query string disappeared.

The dropped query was the tell. Without it the layer would have looked healthy
while providing no protection at all: any protected path with no `layout.tsx`
guard (a new section, an API route) would have been wide open.

**Fix.** Moved to `src/middleware.ts`.

**Verified.** `/projects?filter=active` → `/login?next=%2Fprojects%3Ffilter%3Dactive`,
and `/projects/abc?tab=x` → `/login?next=%2Fprojects%2Fabc%3Ftab%3Dx` — a path
with no page of its own, so only middleware could have caught it.

**Prevention.** A guard proven only by "it redirected" is not proven. Test a
path that _only_ that layer can catch — here, a nested route with no page.

---

### BUG-010 — Session lookup failed closed too eagerly 🟠

**Symptom.** Turning on `NEXT_PUBLIC_AUTH_ENABLED` would have thrown a 500 on
`/login` and `/signup` — the pages needed to sign in.

**Root cause.** `getSession()` threw "no session provider registered" before
checking whether a session cookie existed at all. Absence of a cookie is a
definitive "no session" and needs no provider to answer, but `requireGuest()`
on the auth screens hit the throw first.

**Fix.** Read the cookie first; return null when absent. Throw only when a
cookie _is_ present and nothing can validate it — which is the case that must
never be treated as valid.

**Caught by.** Reasoning through the enabled path before shipping, rather than
only testing the disabled default.

---

### BUG-011 — Continue button lied to assistive technology 🟠

**Symptom.** Playwright refused to click the wizard's Continue button:
_"element is not enabled"_.

**Root cause.** The button carried `aria-disabled={!canAdvance(...)}` while
remaining genuinely clickable. Screen readers announce such a control as
unavailable, so a blind user would believe the wizard was stuck — while a
sighted user could click it and get a helpful explanation of what was missing.

**Fix.** Removed `aria-disabled`. The button is genuinely enabled; clicking
runs the step's rule and surfaces the exact reason in an alert, which is
announced. A disabled button gives no reason at all, which is why it was not
made truly disabled either.

**Caught by.** Driving the real UI. No unit test would have found this —
`canAdvance` was correct and fully tested; the defect was in how its result was
presented.

---

### BUG-012 — Rescan button would not have appeared 🟠

**Symptom.** Lint failed: _"Cannot access refs during render."_

**Root cause.** The picked directory handle was stored in a `useRef`, and
`canRescan` read `handleRef.current` during render. Refs do not trigger a
re-render, so after picking a folder the Rescan button would not have appeared
until some unrelated state change happened to re-render the component — and
reading a ref during render is unsafe under concurrent rendering regardless.

**Fix.** The handle drives what renders, so it became `useState`. The abort
controller stayed a ref: it is never read during render.

**Caught by.** Lint, before the feature was ever exercised. The React Compiler
rules caught a real behavioural bug, not a style preference.

---

### BUG-013 — Smoke script could not see `DATABASE_URL` 🟡

**Symptom.** `node scripts/db-smoke.mjs` failed with
`PostgresError: database "nishhaamm" does not exist` even though
`DATABASE_URL` was set in `.env.local`.

**Root cause.** The script started with `import "dotenv/config"`, which loads
only `.env`. This project keeps its real values in `.env.local` (Task 1), so
`DATABASE_URL` never reached `postgres()` — which then fell back to
`postgres@localhost:5432/nishhaamm` (the OS username as database name).

**Fix.** Load the file explicitly in the script:
`dotenv.config({ path: ".env.local" })`.

**Caught by.** Running the smoke script — the RED run failed, but for a
misleading reason; the root cause was only visible after the green run still
failed with the username as database name. A gate that fails for the wrong
reason teaches nothing.

**Stops it recurring.** Comment in the script explains why `.env.local` is
loaded explicitly. `npm run db:smoke` is the gate that proves the connection.

---

### BUG-014 — Drizzle install pulled in a vulnerable esbuild 🟡

**Symptom.** `npm audit` reported 4 moderate vulnerabilities after installing
`drizzle-kit`.

**Root cause.** `drizzle-kit` → `@esbuild-kit/esm-loader` →
`@esbuild-kit/core-utils` pins `esbuild@~0.18.20`, which carries
GHSA-67mh-4wv8-2f99 (the esbuild dev-server advisory). npm's suggested
"fix" was a breaking downgrade to `drizzle-kit@0.18.1`, which would have
invalidated the `defineConfig({ dialect })` shape used by the plan.

**Fix.** Scoped override in `package.json`:
`"overrides": { "@esbuild-kit/core-utils": { "esbuild": "^0.25.0" } }`.
`npm audit` → 0 vulnerabilities; `npx drizzle-kit check` still loads the
config and reports "Everything's fine".

**Caught by.** `npm audit` (the brief's step 1 expected 0 vulnerabilities).

**Stops it recurring.** `npm audit` is the gate. The override is scoped to the
one package that pinned the old esbuild; drizzle-kit, tsx, and vite already
use patched versions.

---

### BUG-015 — Generated Supabase files failed lint 🟡

**Symptom.** `npm run lint` reported 154 errors in
`supabase/.temp/start-secrets/supabase_edge_runtime_007/main/index.ts` — a
single-line minified bundle generated by `supabase start` — plus 34 warnings.

**Root cause.** ESLint scans the whole tree; `eslint.config.mjs` ignored only
`.next/**`, `out/**`, `build/**`, and `next-env.d.ts`. The `supabase/.temp/`
directory is generated on every `supabase start` and is already gitignored by
`supabase/.gitignore`, but was never ignored by ESLint.

**Fix.** Added `supabase/.temp/**` to `globalIgnores` in
`eslint.config.mjs` — it is generated, never committed, and never hand-edited.

**Caught by.** `npm run lint` (the brief's step 6 gate).

**Stops it recurring.** The ignore entry is permanent. `supabase/.gitignore`
already covers git; this covers lint. Re-check `supabase/.temp` if the CLI
changes its output location.

---

### BUG-016 — `drizzle.config.ts` and setup scripts would not see `DATABASE_URL` 🟡

**Symptom.** Task 3's brief shipped `import "dotenv/config"` in
`drizzle.config.ts` and in the new `scripts/db-setup.mjs` /
`scripts/db-tables.mjs`. Because dotenv loads only `.env` and this project
keeps its values in `.env.local` (the BUG-013 pattern), `DATABASE_URL` was
`undefined` at migration and script runtime.

The fail-open shape is what made it dangerous: `dbCredentials: { url:
process.env.DATABASE_URL! }` silently targeted the default database instead of
failing — a wrong-DB migration instead of an error. The same undefined URL in
`scripts/db-tables.mjs` would have printed tables from the wrong database and
looked like success.

**Root cause.** Same as BUG-013: the default `dotenv/config` entry point never
reads `.env.local`, and the brief's `!` assertion converted "missing" into
"use a fallback" rather than "fail".

**Fix.** `drizzle.config.ts` now loads the file explicitly and fails loudly:
`config({ path: ".env.local" })` with `dbCredentials: { url:
process.env.DATABASE_URL ?? "" }` — an empty URL is rejected by the driver
instead of silently pointing at a default. Both new scripts use
`dotenv.config({ path: ".env.local" })` like `db-smoke.mjs`.

**Caught by.** Task 2 review finding (the `!` silent-fallback shape was
flagged before any code ran) plus verification during Task 3 while writing
the setup scripts — `npx drizzle-kit generate` confirms the fix works by
reporting "injected env (6) from .env.local".

**Stops it recurring.** `npm run db:setup` and `npm run db:tables` are now the
gates that exercise the loaded URL end to end against the local stack; the
`?? ""` pattern keeps the failure loud. Any new script that touches the
database must load `.env.local` explicitly.

---

### BUG-017 — RLS policies recursed: "infinite recursion detected" 🔴

**Symptom.** Any non-bypass-role query against the wave 1 tables failed at plan
time:

```
SET ROLE anon; SELECT count(*) FROM workspace_members  → infinite recursion detected
SET ROLE anon; SELECT count(*) FROM projects           → same
```

Only `users_self_read` (the one policy with no subquery) worked.

**Root cause.** Every member-check policy subqueries `workspace_members`
directly. RLS applies to policy subqueries too, so the subquery's own policy
fired on itself, forever. PostgreSQL rejects the plan for any role that does
not bypass RLS — which is every role except the table owner/superuser, i.e.
every real client role. The policies existed and `rowsecurity = true` was set,
but nothing short of executing a query as a non-bypass role could see it.

**Fix.** Membership checks run through a `SECURITY DEFINER` helper,
`public.is_workspace_member(ws, uid)`, which queries `workspace_members` with
the definer's privileges (the superuser owner bypasses RLS, so no recursion).
All five member-check policies now call the helper; `users_self_read` is
unchanged. Policies are now `drop policy if exists` + `create`, so the file
re-runs cleanly — which also fixes `db:setup` idempotency (the Task 3 report's
"not idempotent" concern).

**Caught by.** The review's execution check — running the policies as the anon
role instead of only checking catalog presence. Task 3 had verified RLS at the
`pg_catalog` level (`rowsecurity = true`, all six policies listed), which
cannot see this defect.

**Stops it recurring.** RLS is verified by executing as a non-bypass role
(`SET ROLE anon` + counts on all six tables), not by catalog inspection. The
fix round re-ran that check: all six tables return `count 0` with no error
under anon, and a JWT-claim positive test sees exactly the member's rows (own
user, member workspace, member rows, member's projects — and hides a
non-member workspace).

### BUG-018 — Wave 2 tables unreachable by anon/authenticated: no SELECT grants 🟠

**Symptom.** The Task 4 anon-role verification failed on the first run, before
any RLS policy could evaluate:

```
SET ROLE anon; SELECT count(*) FROM codebases
  → PostgresError: permission denied for table codebases
```

**Root cause.** `codebases`, `codebase_scans`, `detected_technologies` and
`detected_features` carried only owner privileges. RLS was enabled and
policies existed, but PostgreSQL checks the ACL *before* RLS: with no `SELECT`
grant the anon and authenticated roles cannot read the tables at all, so the
policies could never run. Supabase's local default ACLs do not grant new
public-schema tables to anon/authenticated (probed with a throwaway table
created as `postgres`: it got no anon grant). The wave 1 tables are readable
by anon only because Task 3 granted SELECT ad hoc on the live stack — that
grant was never committed to a migration.

**Fix.** `0002_wave2_rls.sql` now ends with `grant select on <table> to anon,
authenticated` for all four wave 2 tables. Grants are idempotent, so
`db:setup` still re-runs cleanly. Re-ran the anon verification: a member's
JWT claims see the fixture row in each table, an outsider sees zero rows, no
recursion errors.

**Caught by.** The Task 3 pattern of executing as a non-bypass role instead of
checking catalog presence.

**Stops it recurring.** RLS verification executes real anon queries against
the live stack on every wave, and every RLS migration states its grants
explicitly instead of relying on default ACLs.

**Resolved 2026-08-18 — grants normalized across 0001/0002.** `0001_wave1_rls.sql`
now ends with the same `grant select ... to anon, authenticated` block as
`0002`, covering `users`, `workspaces`, `workspace_members`, `projects`,
`project_members`, `project_integrations`. A fresh `supabase db reset
--no-seed` + `db:setup` reproduces the grants: `db:tables` lists all 10
tables, and anon-role counts return 0 with no permission errors on every
table. Grants are idempotent, so re-running `db:setup` stays clean.

---

## How bugs get found here

Ranked by what has actually worked so far:

1. **Writing the test first** — the only thing that caught BUG-002, which
   produced no error of any kind.
2. **Exercising the feature end to end, not just the default path** — caught
   BUG-009 and BUG-010. Both looked fine under the default configuration.
3. **The build** — caught BUG-003 and BUG-004 outright.
4. **Browser console capture** — caught BUG-001, invisible to every other gate.
5. **Lint** — caught BUG-006 and BUG-008.
6. **Testing tooling before trusting it** — caught BUG-005.
7. **Executing security controls as the least-privileged role** — caught
   BUG-017. RLS policies that never run are indistinguishable from working
   ones when you only inspect the catalog.

A security control that fails open is the dangerous shape: no error, no
warning, no failing build, and often a _plausible-looking_ success. BUG-002 and
BUG-009 were both this shape — one silently reset a lockout counter, the other
was a guard layer that never loaded while a second layer masked its absence.

Unit tests did not catch BUG-009: `decideRoute` was correct and fully tested.
The defect was in wiring, which only running the thing reveals.

### BUG-019 — Delete-then-recreate of a workspace name crashed with a 500 🔴

**Symptom.** Create "Acme", delete it, then create "Acme" again — the second
create threw an unhandled unique-violation 500 in the natural delete-then-
recreate flow.

**Root cause.** `listWorkspaceSlugs` filtered to live workspaces only
(`isNull(deleted_at)`), so a soft-deleted slug looked free and was chosen for
the new row — but the `workspaces_slug_unique` unique index covers deleted
rows too. The insert hit the unique index and the exception surfaced as a
raw 500.

**Fix.** `listWorkspaceSlugs` no longer filters: deleted slugs stay reserved,
and recreation suffixes (`acme` → `acme-2`) instead of crashing. Trade-off
documented in the store: freeing deleted slugs safely would need a partial
unique index, and reserving is the simplest safe option. Covered by a service
test seeding a soft-deleted row and asserting the new slug is suffixed.

**Caught by.** Task 8 review.

**Stops it recurring.** Slug-uniqueness decisions must consider soft-deleted
rows — the store now derives uniqueness from the full slug set, matching the
unique index exactly, and the new test pins the delete-then-recreate flow.

---

### BUG-020 — Detection confidence silently rounded to 1 in the integer column 🟠

**Symptom.** The wave 2 `detected_technologies` / `detected_features` tables
store `confidence` as an integer, but the detection engine's
`Detection.confidence` is 0..1 (`score()` caps at 1, e.g. 0.73). Inserting the
raw value into an integer column would silently round — 0.73 → 1, 0.3 → 0 —
destroying the score that detection is built around. Not caught at runtime:
Postgres rounds instead of erroring, so the write would have "succeeded".

**Root cause.** The scan-save mapping in Task 10 copied the brief's
pass-through of `f.confidence` without checking the column type against the
engine's scale.

**Fix.** `codebase-service.ts` stores `Math.round(confidence * 100)` — a 0..100
integer that round-trips the score within 0.5% (0.875 → 88 → 0.88), the best
the integer confidence column allows — with a comment naming this defect
class.

**Caught by.** Inspection while writing the mapping (the brief itself warned
to verify the real shapes; the column-type check caught the scale mismatch).

**Stops it recurring.** The service test seeds a real 0..1 confidence (0.73)
and asserts the stored value is exactly 73, pinning the mapping against the
engine's scale — a raw pass-through fails the test.

---

### BUG-021 — Save-state race: a rescan could show the new scan as "Index saved." 🟠

**Symptom.** On the import screen, while a save is in flight
(`saveState.status === "saving"`) the Rescan button stayed enabled. If the
rescan completed before the in-flight save resolved, the save's resolution set
`status: "saved"` unconditionally — so the UI showed "Index saved." under the
NEW scan, which had never been saved. The save action's result is about the
scan it started on, but the state update applied it to whatever scan was
current when it resolved.

**Root cause.** `handleSave` captured the scan from its render-time closure but
resolved the state update without checking whether the current scan was still
the one being saved. Nothing bound the result to its subject.

**Fix.** Scan-token binding. `runScan` increments `scanTokenRef` on every
completed scan; `handleSave` captures the token at save start and, when the
action resolves, `resolveSaveResult(tokenAtSave, scanTokenRef.current, result)`
only reports saved/error if the token is unchanged — otherwise it leaves the
state idle (the new scan is unsaved). Belt and braces: Rescan is disabled while
`saveState.status === "saving"`, and Save is disabled while "saving" or
"saved" (prevents duplicate identical scan rows).

**Caught by.** Fix-round review of Task 10 — read of the component's save/scan
interleaving; no component test harness exists, so the state logic was
extracted into a pure function and pinned there instead.

**Stops it recurring.** `resolveSaveResult` in
`src/features/codebase/lib/save-state.ts` is unit-tested (including the
token-mismatch case), and the buttons' disabled states make the race
unreachable from the UI.

---

### BUG-022 — GoTrue signups never reached public.users; first workspace create dead for real users 🔴

**Symptom.** A user who signed up through GoTrue (the real signup path) could
not create a workspace: the create flow reported "Something went wrong" — the
server action's catch-all for an FK violation. Signups made directly into
`public.users` (the pre-Task-11 smoke path) worked, which is why the gap
survived every earlier gate.

**Root cause.** Nothing ever inserted into `public.users`. Supabase GoTrue
writes `auth.users` on signup, and `workspace_members.user_id` has an FK to
`public.users(id)` — so the first `insertMembership` blew up with
`foreign key violation ... user_id` and the action caught it as a generic
error. The two tables were assumed to be one.

**Fix.** Canonical Supabase sync trigger
(`supabase/migrations/0003_auth_users_sync.sql`): `on_auth_user_created`
`after insert on auth.users` runs `handle_new_user()` (SECURITY DEFINER,
`search_path = public`), mirroring id/email/display_name/email_verified_at
into `public.users` with `on conflict (id) do update`.

**Caught by.** Final whole-branch review — a full-tree grep for the
`auth.users` → `public.users` sync seam found none. Confirmed end to end with a
GoTrue signup smoke (mirror row appears; workspace create + membership +
`findWorkspacesForUser` all succeed for the real user).

**Stops it recurring.** The integration test
`src/lib/server/stores/auth-users-sync.integration.test.ts` inserts straight
into `auth.users` (simulating GoTrue) and asserts the mirror row lands —
nothing can delete the trigger without failing it. The smoke script that
exercises the persistence layer (signup → trigger → workspace create → read
back) is the new minimum for "persistence works", per the review lesson below.

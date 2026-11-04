# Blockers & External Connections

Everything that stops work, and everything that needs connecting to an outside
service. Defects are logged separately in [bug.md](bug.md). **Updated as blockers appear and clear** — a blocker leaves this file
only when it is actually resolved.

| Legend | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| 🔴     | blocking now — work cannot start                         |
| 🟠     | blocking soon — needed for the next step or two          |
| 🔵     | needed later — not urgent, listed so it is not forgotten |
| ✅     | resolved                                                 |

---

## 1. Open blockers

| #   | Blocker                          | Severity | Blocks                   | Needed from you                                                  |
| --- | -------------------------------- | -------- | ------------------------ | ---------------------------------------------------------------- |
| B1  | No Supabase project              | ✅ (local) | — (local)               | **Resolved 2026-08-18:** local stack running (OrbStack + `supabase` CLI). Local persistence landed Tasks 8–11. The **cloud** project is still owner's task — see the 🔵 row below |
| B1c | Supabase **cloud** project       | 🔵       | Deploy + real users      | Create a project, hand over URL + keys before deploy (pre-cloud checklist: see the RLS hardening note in Remaining work → Workspace) |
| B3  | Email provider not chosen        | 🟠       | 0.1.2 D, E               | Decision — Supabase built-in sender or Resend                    |
| B4  | Unverified-user policy undecided | 🟠       | 0.1.2 D, G               | Decision — hard gate before first login, or reduced access       |
| B6  | No git remote / GitHub repo      | 🟠       | CI, deployment           | Create repo, or approve `gh repo create`                         |
| B7  | OAuth providers not chosen       | 🔵       | 0.1.2 F                  | Decision — which providers, and the linking policy               |
| B8  | No test runner installed         | 🔵       | Step 10 of every feature | Approval to install Vitest + Playwright                          |

---

## 2. External services to connect

Each row is a real account or credential that has to exist outside this repo.
Nothing here is set up yet.

### 2.1 Supabase — 🔵 needed at deploy (local stack replaces it for development)

Postgres, Auth, and Storage. The local stack (OrbStack + `supabase` CLI)
removed the development blocker 2026-08-18; the cloud project is needed only
for deploy and real users.

| What          | Detail                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| You create    | A Supabase project (region close to your users)                                                          |
| You hand over | Project URL · `anon` public key · `service_role` key                                                     |
| Goes in       | `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Packages      | `@supabase/supabase-js`, `@supabase/ssr` — both installed 2026-08-18 (Task 5)                            |
| Unblocks      | B1, B2, B5 — every backend item in 0.1.2                                                                 |

> The `service_role` key bypasses Row Level Security. It is server-only: never
> prefixed `NEXT_PUBLIC_`, never imported into a client component, never
> committed. `.env.local` is already gitignored.

### 2.2 Email delivery — 🟠 needed for 0.1.2 D and E

Verification links and password-reset links have to actually arrive.

| Option                   | Trade-off                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Supabase built-in sender | Zero setup, works immediately. Rate-limited and not for production volume.                            |
| Resend                   | Own domain, real deliverability, templates. Needs an account, an API key, and DNS records (SPF/DKIM). |

Suggested path: build against the Supabase sender, switch to Resend before
launch. Either way the sending code sits behind one module so the swap is local.

### 2.3 GitHub — 🟠 for CI, 🔵 for OAuth and the MVP chain

Three separate uses, easy to conflate:

| Use                       | What it needs                                                                           | When                            |
| ------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| Source control + CI       | A repository                                                                            | Now — CI is wanted from day one |
| GitHub login              | An OAuth App: client ID + secret, callback URL                                          | 0.1.2 F                         |
| MVP "connect GitHub" step | A GitHub App with repo scopes (reading user repos is a different grant from logging in) | Build-order step 15             |

### 2.4 Vercel — 🔵 needed at deployment

| What          | Detail                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| You create    | Vercel project linked to the GitHub repo                               |
| You hand over | Nothing locally; environment variables get set in the Vercel dashboard |
| Unblocks      | Preview deployments, production deploys, build-order steps 19–23       |

### 2.5 Sentry — 🔵 needed at monitoring

DSN, plus `@sentry/nextjs`. Unblocks build-order step 24. The `(auth)/error.tsx`
boundary currently `console.error`s — that call is the placeholder for Sentry.

### 2.6 Trigger.dev — 🔵 needed for background jobs

API key + project. Required once codebase scanning, repo sync, documentation
indexing, or AI analysis run as jobs rather than inline. Build-order step 08 and
beyond.

### 2.7 AI providers — 🔵 V2, not v1

OpenAI / Anthropic / Google keys, behind one provider-abstraction module. AI is
third in the V2 list — the structured project data has to exist first.

---

## 3. Remaining work, by area

Not blockers — known gaps that will need doing.

### Auth (phase 0.1)

- Sessions are real since Task 11: the provider is registered
  (`src/lib/server/init.ts`), the guards are live
  (`NEXT_PUBLIC_AUTH_ENABLED=true`), and signup/login/logout/reset/verify
  actions run against the local Supabase stack with CSRF + rate-limit +
  brute-force guards. What remains:
- Delete `src/features/auth/lib/placeholder.ts` — unused since Task 7 wired
  the last four forms to real actions
- Email delivery for reset links and verification emails runs on the Supabase
  local sender (the D2 path) — fine for development, not for production
  volume; pick the production sender before launch (B3)
- Rate limiter and brute-force guard are wired into the login action (Task 6);
  the in-memory store is per-process, shared across requests in one server
  instance — the serverless caveat is in the testing note below
- CSRF is live on the auth forms (Tasks 6–7): double-submit token + origin
  check; note the origin check needs `NEXT_PUBLIC_APP_URL` set to engage
- The client-side `RequireAuth` / `RequireGuest` components still enforce
  nothing; the server-side guards in `server/session.ts` are the real ones
- OAuth provider buttons on the login and signup screens
- Email verification and password reset screens work against the local sender;
  links land in Mailpit (port 54324). Local signups auto-confirm
  (`enable_confirmations = false`), so the verify-email screen is reached
  only via the resend/verification-link path

### Workspace (phase 0.3)

- Create, rename, and delete persist through server actions (Task 8), and the
  actions run with a real session since Task 11 flipped `AUTH_ENABLED`. The
  activity feed reads events back (final review round):
  `loadWorkspaceActivityAction` → `findWorkspaceEvents` (newest 50), and
  `/activity` resolves the user's workspace server-side. What remains:
- Members and billing deferred by the project owner
- RLS is read-only so far: server actions write via `service_role`, and the
  policies only grant member SELECT. **Pre-cloud hardening (dev-local for
  now, do NOT do yet):** `revoke execute on function is_workspace_member from
  public, anon` so the SECURITY DEFINER helper cannot be invoked directly by
  anon/authenticated clients; review and mirror write policies before real
  users exist.

### Project creation (phase 0.4)

- Wizard + settings persist through server actions (Task 9), and
  `createProject` guards missing/soft-deleted workspaces (Task 11). What
  remains:
- The projects-list read path is not built — `/projects` still renders its
  empty state, so a created project does not appear in a list anywhere
  (planned for Task 11 but not in its final scope)
- Route-level project selection is not built — `/settings/project` and
  `/projects/import` resolve "the current project" via `findCurrentProject`
  (latest non-deleted project) instead
- Repository _selection_ needs the GitHub integration; the step accepts a
  manually typed `owner/repo` for now

### Project dashboard (phase 0.5)

- Every panel renders its empty state; there is no data source for progress,
  health, features, integrations, deployments, issues, or recent changes
- Health shows no score at all without signals — deliberately, rather than
  inventing one

### GitHub import (phase 1.2)

- No OAuth App registered, so nothing can connect. The page says so rather than
  offering a dead button.
- Token exchange needs a client secret and a server session to hold the result
- The connection is not stored, so rescan against a saved ref is not possible
- Repository search filters the accessible list; GitHub's search endpoint is
  deliberately unused (stricter rate limit, cannot see all private repos)

### Dependency vulnerabilities (phase 1.7)

- **No vulnerability scanning at all.** The UI reports `not checked` and never
  "none found". Wiring an advisory source (OSV or the GitHub Advisory Database)
  needs a decision from the project owner: it sends dependency names to a third
  party, which is egress this codebase otherwise avoids.
- Deprecation detection is a curated list of well-known retirements, not an
  audit — stated in the UI.

### Scanner engine (phase 1.3.2)

- AST parsing deliberately deferred — a browser parser is a multi-megabyte
  dependency, and detection reaches "certain" without one
- The scan cache is per-process, and the import screen's rescan diff uses the
  in-memory snapshot only — the saved snapshot (Task 10) is written but not yet
  loaded for a rescan diff, so an incremental rescan still re-reads every file
  (it can _report_ what was unchanged, but not yet skip it)
- Detection covers 19 frameworks and 8 features; anything outside those lists
  is silently not reported

### Codebase import (phase 1.1)

- **Scans persist (Task 10) and load back (final review round).** The import
  screen shows "Saved scan from <date> — N file(s) indexed." on mount via
  `loadLatestImportAction`, and save/load are gated on the caller's workspace
  role. What remains: the saved snapshot is not used for a rescan diff — an
  incremental rescan still re-reads every file (it can _report_ what was
  unchanged, but not yet skip it)
- Rescan only works on Chromium (File System Access API). Other browsers give a
  snapshot via a directory input, so rescanning means picking the folder again
- Nested `.gitignore` files are not read; only the root one is
- Desktop-only capabilities (macOS/Windows folder access, file watching,
  real-time changes, background scanning) are deferred by the project owner and
  need the Tauri-vs-Electron decision first

### Project scaffolding

- `features/*` domain folders — only `_template/` exists
- `lib/{database,auth,api,security,logging,errors}/`
- Top-level `tests/` and `scripts/`
- GitHub Actions workflow: Push → Install → Lint → Type Check → Test → Build → Deploy

### Testing

- **Vitest installed; 605 tests** cover the security primitives, route policy,
  session mapping, auth actions, workspace permissions, slug rules, the
  project wizard machine, the technology catalogue, the project/codebase
  services (incl. workspace permission gates), the activity feed loader, the
  auth-users→users sync trigger, and the dashboard's progress, health, and
  next-action logic. `npm test`
- **Integration tests against the real local stack** — skipped gracefully
  when the connection is refused (collection-time `ECONNREFUSED` probe +
  `describe.skipIf`, vitest 4.1 removed runtime skip): discriminating
  soft-deleted-slug-reservation tests for the workspace and project stores,
  the codebase store's `findLatestScan` tests (newest scan of the project's
  own codebase; hidden for soft-deleted projects — now order-independent,
  Task 11), `findWorkspaceEvents` newest-first, and the auth-users-sync
  mirror test (insert into `auth.users` → poll for the `public.users` mirror
  row → delete both)
- Playwright still not installed — no end-to-end test exists
- No test covers the auth **UI** (forms, validation, states) — only the
  security modules and server actions are tested
- `MemoryRateLimitStore` is per-process. On serverless the effective rate limit
  multiplies by instance count. A shared Postgres or Redis store is required
  before this is load-bearing — the `RateLimitStore` interface exists for it.
- The login action's client key comes from the first `x-forwarded-for` hop,
  which a client can set when the app is reached directly (naked deployment).
  Bind the app behind a trusted proxy (Vercel, or a load balancer that strips
  the header) before cloud — the composite email+IP lockout key is only as
  strong as that hop.

### Housekeeping

- Work is committed on the `feat/mvp-foundation` branch; no git remote /
  GitHub repository exists yet (B6)
- `.env.example` documents the Supabase vars plus
  `NEXT_PUBLIC_AUTH_ENABLED=true` (Task 11); `.env.local` holds the local
  stack credentials and the flag. Docker runtime on this machine is OrbStack —
  the Supabase local stack requires it.
- `supabase/config.toml`: `enable_confirmations = false` (local signups
  auto-confirm), `minimum_password_length = 6`, `jwt_expiry = 3600` —
  review each before cloud.

---

## 4. Decisions waiting on you

| #   | Question                                                | Blocks  | My recommendation                                                                      |
| --- | ------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| D1  | Supabase-managed sessions, or our own `sessions` table? | B2      | Start Supabase-managed — far less code, and revoke-all can be added later              |
| D2  | Supabase email sender or Resend?                        | B3      | Supabase now, Resend before launch                                                     |
| D3  | Can unverified users sign in?                           | B4      | Hard gate — simpler to reason about, and matches the verify-email screen already built |
| D4  | Which OAuth providers?                                  | B7      | GitHub only at first — the MVP chain needs GitHub anyway                               |
| D5  | Primary key type: `uuid` or `bigserial`?                | 0.1.2 A | `uuid` — safe to expose in URLs, no enumeration                                        |

---

## Resolved

| #         | Blocker        | Resolved   | How                                                                                                                    |
| --------- | -------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| B8 (part) | No test runner | 2026-08-13 | Vitest installed and configured; `npm test` runs the suite (250 tests as of 2026-08-13). Playwright still outstanding. |
| B5        | ORM not installed | 2026-08-18 | `drizzle-orm` + `postgres` installed (runtime), `drizzle-kit` + `dotenv` (dev). `npm audit`: 0 vulnerabilities (esbuild override, see bug.md BUG-014). Smoke test proves the connection: `npm run db:smoke` → `[{"ok":1}]`. |
| B2        | Session strategy undecided | 2026-08-18 | Supabase-managed sessions (D1) — spec `docs/superpowers/specs/2026-08-18-local-database-persistence-design.md`; provider registered (Task 5), flag flipped (Task 11). |
| B1 (local) | No Supabase project | 2026-08-18 | Local stack running (OrbStack + `supabase` CLI): Postgres 54322, API/Auth 54321, Mailpit 54324. Local persistence landed Tasks 8–11. **Cloud project remains** — 🔵 row B1c. |

# DevCon source reconciliation

Inspected 2026-11-04. This is one intended product with three source surfaces, not three unrelated products. The source implementations have diverged enough that copying their trees together would break routing, identity, persistence, and deployment assumptions.

## Recommendation

Use `/Users/nishhaamm/Desktop/007` as the canonical web application for the approved file workspace and the 329-feature platform roadmap. Retain `/Users/nishhaamm/Documents/ChatGPT/devcon` as its marketing surface. Preserve the remote `v2` implementation as a source of reusable SHIP-spec, canvas, and local-companion functionality, then port those capabilities deliberately through adapters and tests.

This recommendation follows the requested PostgreSQL/private Supabase Storage design: `/007` already has those auth, schema, service, and permission foundations. The remote is stronger at inspecting and checking a project on the user's Mac, but its local JSON stores and operating-system capabilities are a separate execution environment. Both contain useful work that should survive consolidation.

No source was merged or overwritten for this comparison. The remote checkout and `/007` were inspected read-only. No `.env*`, signing-key, account-store, or other secret contents were read.

## Sources and current inventories

| Source | Snapshot inspected | Shape and useful work |
| --- | --- | --- |
| Remote clone `/private/tmp/devcon-remote` | Branch `v2`, commit `68f8daa5b45f506ab1ffa73fd175edcd50b2326a` (2026-08-12) | Next application rooted at `app/`, local project dashboard, accounts/profile/workspaces, SHIP parsing and sandboxed checking, canvas, host diagnostics, Finder picker, Git clone, connector descriptions, macOS CI |
| Local `/Users/nishhaamm/Desktop/007` | Branch `feat/mvp-foundation`, commit `9ebe4b2b1e3b0c3fcc58d25f77a360b7ef087df3` (2026-08-19), before this task's staged file additions | Next application under `src/`, Supabase-managed authentication, Drizzle/PostgreSQL persistence, workspace roles, project wizard/settings, browser codebase scanning with evidence/confidence, stored scans and activity feed, partial GitHub import |
| Landing `/Users/nishhaamm/Documents/ChatGPT/devcon` | Current buildless working tree | Immersive static landing page, interactive project-plan demo, new illustrative file-workspace showcase and honest local sample downloads |

### Remote modules

- `lib/auth/{password,session,users,validate}.ts`: local accounts, scrypt hashes, signed HMAC sessions and validation.
- `lib/{workspace,projects}.ts`: account-owned workspaces, active workspace, path-based projects and legacy-store migration.
- `lib/ship/{parse,check,sandbox,cache,search}.ts`: SHIP markdown parsing, evidence-bearing condition results, sandboxed command execution, cached results, and project search.
- `lib/{detect,canvas}.ts`: lightweight host-filesystem detection and per-project card positions.
- `lib/{clone,pick-folder,diagnostics,connectors}.ts`: Git clone, macOS folder dialog, host capability probes, and integration coverage descriptions.
- Ten `test/*.test.ts` suites. `HANDOFF.md` reports 174 tests and a green macOS CI snapshot; these historical claims were not rerun during reconciliation.
- `.github/workflows/gates.yml`: pnpm install, Biome lint, type checking, Node test runner, build, application-chunk budget, and tracked-secret checks.

### `/007` feature folders

Source-file counts include implementations and colocated tests, not completion claims:

| Feature folder | Files | Existing capability |
| --- | ---: | --- |
| `auth` | 37 | Auth forms/actions, Supabase session integration, guards, CSRF, rate limits, lockout and validation |
| `workspace` | 14 | Workspace creation/settings, nested owner/admin/member/viewer capabilities, activity model |
| `project` | 13 | Project creation wizard, type/stack choices, project settings and service seams |
| `codebase` | 41 | Browser folder import, scanning, ignore/classification, package/dependency analysis, language/framework/runtime/toolchain detection, inspection UI and saved scans |
| `dashboard` | 11 | Health, progress, next-action pure logic and components; full persisted dashboard remains incomplete |
| `database` | 4 | Drizzle schema and server-only PostgreSQL client |
| `integrations` | 9 | GitHub connection/picker UI, client/source/OAuth helpers and tests; not a complete integration rollout |

`src/lib/server/stores/` supplies the database adapters for workspaces, projects, and codebase scans, with integration tests. Eleven existing schema tables cover users, workspaces, workspace members, projects, project members, project integrations, workspace activity, codebases, scans, technologies, and features. Three Drizzle schema migrations and three Supabase RLS/auth-sync migrations exist. Local status docs report 605 passing tests as of their last update; this comparison did not rerun them.

Important incomplete baseline: `/projects` is an explicit empty-state placeholder rather than a query of persisted projects. Project creation exists, but the list read path remains unfinished. Do not infer a complete project library from the creation wizard or from remote's separate path-based dashboard.

## Compatibility and collisions

| Area | Remote `v2` | `/007` | Consolidation rule |
| --- | --- | --- | --- |
| Runtime | Next 16.3.0, React/ReactDOM 19.2.8 | Same versions | Shared runtime is helpful but does not make app trees interchangeable. |
| Routing | Root `app/`; `/` changes between landing and local project dashboard | `src/app/`; marketing `/`, separate `/dashboard` and `/projects` | Keep `/007` route tree; port individual views into project-scoped routes. Never leave both root `app/` and `src/app/` as competing apps. |
| Colliding routes | `/`, `/login`, `/signup`, `/settings` | Same routes | Keep canonical `/007` auth/settings semantics and port useful UI, not duplicate routes. |
| Remote-only routes | `/profile`, `/connectors`, `/console`, `/work`, `/work/workspace`, `/work/canvas` | No equivalent completed views | Map profile to canonical account settings; use project-scoped integrations/diagnostics/spec/canvas routes when implementing those modules. |
| Local-only routes | — | `/activity`, `/dashboard`, `/projects`, `/projects/new`, `/projects/import`, `/projects/import/github`, `/settings/project`, `/settings/workspace`, `/workspaces/new`, password recovery/verification routes | Preserve routes, navigation, and persistence behavior. |
| Identity | Accounts in `~/.devcon/users.json`; `devcon_session` HMAC cookie; signing key generated on host | Supabase Auth plus `public.users`, SSR cookies/session validation and route gates | Use Supabase identities for the canonical web app. Do not reuse, auto-link, or silently migrate local password hashes/sessions. |
| Workspace ownership | Account owner, JSON stores; no team role system | SQL workspace membership with owner/admin/member/viewer roles | Keep SQL membership checks at every read/write boundary. Remote UI is not an authorization layer for cloud files. |
| Project identity | Absolute resolved folder path, optional workspace ID, host-local active project file | UUID project ID, workspace FK, slug, settings; one codebase per project | Use UUID project IDs in web URLs/storage paths; store local paths only in an authorized local-companion mapping. |
| Storage | Machine-local JSON and filesystem reads under `~/.devcon` | PostgreSQL + proposed private Supabase object storage | Use SQL for shared metadata and immutable revisions; private object storage for uploaded originals/exports. Keep local execution state local. |
| Local imports | Server asks Finder or clones Git onto the server host | Browser handle/directory input, metadata scanning; never uploads full repositories | Retain browser import for web. Finder and absolute paths belong in a local companion running on the user's machine. |
| Command checking | macOS `sandbox-exec`, no network, scrubbed environment, project/toolchain allowlist | No completed command runner | Do not expose remote check commands as general cloud API execution. Keep the tested local sandbox separate from the document-conversion worker. |
| Detection | Small Node filesystem detector, framework/gap checks | Rich scanner abstraction with evidence/confidence and multiple ecosystems | Keep `/007` scanner; port unique SHIP/ignore/security signals into its evidence model. Do not run two competing stack detectors. |
| UI/bundle policy | Server-rendered views, one canvas client component; CI rejects page chunks | Many client components for forms/imports, shadcn/Base UI, planned rich editors | Rich file editors explicitly require client JS. Preserve lazy loading and measure cost; remote's zero-page-chunk gate cannot be copied unchanged. |
| Tooling | pnpm 10.25, Node-native TS tests, Biome, TS 5, `@/*` → root | npm lockfile, Vitest, ESLint/Prettier, TS 6, `@/*` → `src/` | Keep canonical app tooling now. Port tests/import paths deliberately; retain a distinct macOS test lane for companion sandbox tests. |
| Deployment | `v2` docs say never deployed; old public host can outlive deleted source branches | Local stack built, cloud rollout/CI/deploy incomplete in docs | Do not equate the old public host with either current checkout. Associate any future deployment with an exact repository, branch, commit and environment. |

## Porting sequence that preserves both implementations

1. **Finish the approved file-workspace increment in `/007`.** Keep file UI, APIs, migrations, worker, and feature flag together. Validate local tests and record external configuration separately. The landing demo stays explicitly illustrative until application acceptance checks pass.
2. **Establish one canonical repository history without a filesystem overwrite.** Import `/007` as an explicit reviewed commit on a new integration branch derived from the chosen repository; preserve `v2` history and source in its existing branch. Do not pretend the remote orphan and local implementation are a clean feature-branch merge. The current task has not performed or authorized a push/deployment.
3. **Close the project-list read gap.** Query canonical projects by authenticated workspace membership so users can reach persisted projects and `/projects/[projectId]/files` from one stable project library.
4. **Port pure SHIP capabilities first.** Move parser and search behavior behind feature-owned interfaces, adapt data into canonical project IDs, and carry the remote parser/search tests. Render parsed specs and evidence under a project-specific view. Keep `SHIP.md` as a project artifact; it is distinct from DevCon's global product build tracker.
5. **Port canvas interaction with canonical storage.** Reuse the board and position sanitizer; replace path-hashed `~/.devcon/canvas` persistence with a project-authorized adapter. Keep card content derived from the same scanner/spec data rather than storing a second copy of facts.
6. **Retain a local companion boundary.** Finder, clone, host diagnostics, SHIP checking and seatbelt execution stay local. When a future companion is connected to the web app, pair explicitly, map project IDs to permitted paths, and transfer only the requested results. Do not ship the host filesystem APIs to a hosted Next server.
7. **Unify status evidence rather than copy green ticks.** Map imported capabilities onto original tracker IDs with source and verification evidence. Run the canonical test/build/permissions gates before marking a feature complete. Reuse remote macOS CI security tests in their own lane instead of weakening them to pass on Linux.

## Preserved tracker and file-workspace extension

- `docs/build-tracker.html` is a byte-for-byte copy of the user attachment `Pasted text.txt`. No original feature text, numbering, totals, or progress defaults were changed.
- `docs/build-roadmap.json` extracts the same 329 features, with uninterrupted IDs 1–329, MVP IDs 1–160, and 29 displayed sections representing phase labels 0–26 with 6 split into 6a/6b/6c.
- The JSON adds a separate `FILES` extension with IDs `FILES-01`–`FILES-12`. These cover chat, editors, revisions, imports/exports, private storage, conversion jobs, acceptance checks, release controls, and the landing showcase. They do not increment or renumber the original 329, alter its MVP denominator, or claim existing roadmap features are complete.
- Related original features include AI assistant 215/221, file creation/modification 230/231, documentation generation 254–261, and file uploads 286. Relationships are references, not completion claims: generating a DOCX does not complete every documentation or coding-agent feature.
- Original tracker progress is browser/artifact-local state. It has not been treated as repository evidence or queried from the user's browser. The extraction preserves the supplied initial `todo` default, while the new extension remains `not_yet_verified` until checks pass.

## Verification and limits of this report

Inspected manifests, route files, named modules, schema/migrations, workflow configuration, and the remote/local handoff/status docs. Confirmed the tracker has exactly 329 consecutively numbered features and 12 separately named extension items. Compared the preserved attachment bytes with the copied HTML. No remote or local source mutation, dependency installation, auth migration, live account lookup, CI run, push, or deployment was performed for reconciliation.

## Repository consolidation layout

The implementation branch preserves GitHub v2 at the repository root, imports local007 into `apps/web`, and imports the landing site into `apps/landing`. Root TypeScript/Biome gates exclude these independent applications; new web/converter gates validate them separately. Their authentication stores remain separate. No remote feature was overwritten and no existing production deployment was changed.

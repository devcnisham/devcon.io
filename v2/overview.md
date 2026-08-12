# v2 — overview

> **Derivative. Not a source of truth.** `SHIP.md` decides what ships and what
> is cut; `v2/task.md` holds task status; `HANDOFF.md` holds session state;
> `v2/v2_features.md` is this same ground in prose, with how each part was
> verified. This one is the flat list.
>
> Six documents now describe v2's state and **three of them — this one,
> `v2/v2_features.md` and `README.md` — only restate the other three.**
> `CLAUDE.md` flags exactly this as how v0.1 started rotting: its README
> claimed 209 tests while the code said 252. If any of them disagree, `SHIP.md`
> wins and the rest are stale. **Consolidating them is task 20, and it is still
> your call.**
>
> Listed 2026-08-10.

## Everything, listed

### Routes

| Route | State |
|---|---|
| `/` | Landing when signed out; dashboard when signed in |
| `/login`, `/signup` | Sign in and create an account |
| `/profile` | Your account — name and password |
| `/settings` | Workspace — rename, switch, create. Was a redirect to `/console`. |
| `/connectors` | Integrations — coverage and what nothing covers yet |
| `/console` | What devcon is doing, and what this machine can do |
| `/work` | Redirects to `/work/workspace` |
| `/work/workspace` | The open project's `SHIP.md`, checked in the sandbox |
| `/work/canvas` | The open project as draggable cards |

### Modules

| Module | State |
|---|---|
| `lib/ship/parse.ts` | Reads `SHIP.md`. 34 tests. |
| `lib/auth/` | password · session · users · validate. 37 tests. |
| `lib/workspace.ts` | Workspaces, and the legacy-store migration. 11 tests. |
| `lib/projects.ts` | The project list, scoped to a workspace. Renamed from `lib/workspaces.ts`. |
| `app/landing.tsx`, `app/auth-shell.tsx` | Landing page and the auth forms |
| `lib/ship/check.ts` | Works. Sandboxed. Runs the open project's checks. 6 tests. |
| `lib/ship/sandbox.ts` | Works. macOS only, by design. 32 tests. |
| `app/work/workspace/page.tsx`, `spec-cards.tsx` | The open project's spec, checked |
| `app/work/canvas/page.tsx`, `board.tsx` | Draggable cards. 4.4 KB gzip of client JS. |
| `lib/canvas.ts` | Card positions per project. 12 tests. |
| `app/page.tsx`, `app/open.tsx`, `app/cards.tsx` | Dashboard — open, clone, stats, project cards |
| `lib/detect.ts` | Reads a project's stack and gaps from its files. 14 tests. |
| `app/connector-cards.tsx` | Integration rows and capability-coverage cards |
| `app/connectors/page.tsx` | Integrations, read from `package.json` |
| `app/console/page.tsx`, `app/console-cards.tsx` | The console — live values and host probes |
| `.github/workflows/gates.yml` | Seven gates, macOS, green |
| `lib/diagnostics.ts` | Probes the host — platform, node, sandbox, Finder dialog, git |
| `lib/workspaces.ts`, `lib/clone.ts`, `lib/pick-folder.ts` | Import, clone, Finder dialog |
| `test/clone.test.ts` | 11 assertions — URL injection, path validation, active project |
| `app/work/views.tsx` | Floating workspace/canvas switch |
| `test/sandbox.test.ts` | 32 assertions — attacks, plus git config from outside the repo |
| `test/check.test.ts` | 6 assertions — timeouts, verdicts, bounded concurrency |
| `test/cache.test.ts` | 6 assertions — TTL expiry, and an edit beating the clock |
| `test/search.test.ts` | 11 assertions — matching, AND terms, regex metacharacters |
| `test/canvas.test.ts` | 12 assertions — clamping, path hashing, round-trip |
| `test/detect.test.ts` | 14 assertions — stack, gaps, the uncovered `.env` |
| `test/parse.test.ts` | 34 assertions — the `\Z` regression, folding, checks, the real `SHIP.md` |
| `lib/ship/search.ts` | Filters a checked spec. 11 tests. |
| `CHANGELOG.md` | Every change, newest first. Append-only. |
| `lib/ship/cache.ts` | One check run shared by the views. 6 tests. |

### Gates — five locally, seven in CI, all green

| Command | What |
|---|---|
| `pnpm lint` | biome |
| `pnpm exec tsc --noEmit` | types |
| `pnpm test` | node's runner — attacks the sandbox for real |
| `pnpm build` | next build — also typechecks; **read the exit code** |
| `pnpm dev` | localhost:3000 |

### Features

| Feature | State |
|---|---|
| Read `SHIP.md` into a spec | done |
| Run done-when checks, four verdicts | done |
| Keep the tick and the verdict separate | done |
| Report drift — ticked boxes whose check disagrees | done |
| Confine checks: no network | done |
| Confine checks: filesystem to repo + toolchain | done |
| Confine checks: no `.git` writes | done |
| Confine checks: no `.env*` / `.vercel` at all | done |
| Confine checks: replaced environment, never inherited | done |
| Refuse to run where there is no sandbox | done |
| Bounded concurrency and a 120s budget, so a verdict does not move with machine load | done |
| Report a timeout as `error` with "not a failed condition — re-run" | done |
| Render the spec, checked, at `/work/workspace` | done — **now against the open project, not this repo** |
| Zero client JavaScript — 0 page chunks | done, **but 172.5 KB gzip of framework runtime loads anyway** |
| Canvas: drag, two-finger pan, shift-drag select, positions persisted | done — 4.4 KB gzip, measured |
| A way out of the work page | done |
| Home is the dashboard — projects, stats, open and clone | done |
| One check run shared between views, with its age always on screen | done |
| Works on a phone — page scrolls as one, nav pinned | done |
| Search the workspace — text, command, evidence and verdict | done |
| Detect a project's stack — framework, language, package manager | done |
| Report what a project is missing, derived from its files | done |
| Flag a `.env` not covered by `.gitignore` | done |
| Dashboard stats and project cards | done |
| Open a project from its card — the work page names it | done |
| Integrations: capability coverage, what nothing covers yet | done |
| Console: host probes, live check numbers, stated rules | done |
| One colour system — zero raw Tailwind colours in `app/` | done |
| Changelog, built from `git log` | done |
| Authentication — sign up, sign in, sign out, sessions | done, **local only** |
| User profile — display name, change password | done |
| Workspace — owns projects, one per account by default, several allowed | done |
| Settings page — rename, switch, create a workspace | done |
| Sharing a workspace with another person | not built — phase 26, and there is no server |
| Changing a password ends every other session | done, verified against a running server |
| Changing your email | not built — devcon cannot send a confirmation |
| Landing page | done |
| Password reset, email confirmation | not built — devcon cannot send mail |
| End-to-end tests | not built |
| Consent gate before running a stranger's checks | not built |
| MCP server + repo reader | not built |
| The critique pass — **the actual product** | not built |
| Cut rules | not built |
| CI — five gates, zero-chunk check, secret scan, on macOS | **done and green** |
| Zoom, undo, edges or snapping on the canvas | not built |

### Cut on purpose

| Cut | Why |
|---|---|
| A step catalog | 63 steps assumed the plan is knowable in advance. It is not. |
| Accounts, backend, sync | `SHIP.md` is in your repo. Git is the sync. **Accounts reversed on request 2026-08-12** — local only. Backend and sync still cut. |
| Telemetry | Nothing to measure until one person ships one thing. |
| A second agent to run the work | You already have one. |
| Anything copied from v0.1 | The archive is a record, not a parts bin. |
| A web app | **Reversed on request** — being built anyway. Entry kept, not deleted, so the reversal stays visible. |

### Defects

| Defect | State |
|---|---|
| A verdict changed with machine load — 20s budget, every check at once | **fixed**, task 28 |
| A check can destroy the repo's uncommitted working tree — writes cannot be denied | open |
| `SHIP.md` check #7 fails by construction — nests the sandbox | open |
| `SHIP.md` check #2 can never pass — needs the network | by decision |
| ~~`parse.ts` has no tests~~ | **fixed 2026-08-11**, 34 tests, task 13 |
| ~~A git config include outside the repo killed every git check~~ | **fixed 2026-08-11**, 8 tests, task 42 |
| `bullets()` swallows prose written between two bullets | open, asserted, task 41 |
| A cut with no `**bold**` name is dropped silently | open, asserted, task 41 |
| Six overlapping documents, three of them derivative | open, task 20 |

### Decisions waiting on you

| Decision |
|---|
| The 14rem workspace rail is a permanent commitment |
| `SHIP.md` vs the `v2/` docs — now six files |
| Whether the canvas needs zoom, edges or grouping — drag, pan and select are built |
| Whether 120s and four-at-a-time are the right numbers — the mechanism is fixed, these two are judgement calls made without you |
| `v2/product.md`, `v2/project.md` — headings only, awaiting your content |

### v0.1

Frozen at tag `v0.1-archive`, kept on `archive/v0.1`, still deployed at
<https://devcon-hazel.vercel.app>. Nothing deleted, nothing carried forward.

Proved: prompts work when an agent runs them — 2 of 63 cleared a two-agent bar,
checked by running the result.

Did not prove: **nobody has finished a project because of devcon.** Still true
of v2. There is no number for *"of N who started, M shipped."* Every row above
is plumbing until that number exists.

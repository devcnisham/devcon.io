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
> Listed 2026-08-09.

## Everything, listed

### Routes

| Route | State |
|---|---|
| `/` | The plan's shape — parsed, not checked |
| `/work` | Redirects to `/work/workspace` |
| `/work/workspace` | Empty — cleared on request, awaiting new contents |
| `/work/canvas` | Empty — cleared on request |

### Modules

| Module | State |
|---|---|
| `lib/ship/parse.ts` | Works. **No tests.** |
| `lib/ship/check.ts` | Works. Sandboxed. No caller right now. 6 tests. |
| `lib/ship/sandbox.ts` | Works. macOS only, by design. 20 tests. |
| `app/work/workspace/page.tsx` | Empty |
| `app/page.tsx`, `app/open.tsx` | Dashboard — open folder, clone, recent |
| `app/connectors/page.tsx` | Integrations, read from `package.json` |
| `app/settings/page.tsx` | What devcon is doing, read from the modules |
| `lib/workspaces.ts`, `lib/clone.ts`, `lib/pick-folder.ts` | Import, clone, Finder dialog |
| `test/clone.test.ts` | 8 assertions — URL injection, path validation |
| `app/work/views.tsx` | Floating workspace/canvas switch |
| `test/sandbox.test.ts` | 20 assertions, all attacks against the real sandbox |
| `test/check.test.ts` | 6 assertions — timeouts, verdicts, bounded concurrency |
| `test/cache.test.ts` | 6 assertions — TTL expiry, and an edit beating the clock |
| `test/search.test.ts` | 11 assertions — matching, AND terms, regex metacharacters |
| `lib/ship/search.ts` | Filters a checked spec. 11 tests. |
| `CHANGELOG.md` | Every change, newest first. Append-only. |
| `lib/ship/cache.ts` | One check run shared by the views. 6 tests. |

### Gates — five, all green

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
| Render the spec, checked, at `/work/workspace` | **removed** — cleared on request, in git at `45ae91e` |
| Zero client JavaScript — 0 page chunks | done |
| A way out of the work page | done |
| Home shows the plan's shape without running checks | done |
| One check run shared between views, with its age always on screen | done |
| Works on a phone — page scrolls as one, nav pinned | done |
| Search the workspace — text, command, evidence and verdict | **removed** with the workspace; `filterSpec` and its 11 tests remain |
| One colour system — zero raw Tailwind colours in `app/` | done |
| Changelog, built from `git log` | done |
| End-to-end tests | not built |
| Consent gate before running a stranger's checks | not built |
| MCP server + repo reader | not built |
| The critique pass — **the actual product** | not built |
| Cut rules | not built |
| CI | not built |
| Tests for `parse.ts` | not built |
| Anything at `/work/canvas` | no spec |

### Cut on purpose

| Cut | Why |
|---|---|
| A step catalog | 63 steps assumed the plan is knowable in advance. It is not. |
| Accounts, backend, sync | `SHIP.md` is in your repo. Git is the sync. |
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
| `parse.ts` has no tests | open |
| Six overlapping documents, three of them derivative | open, task 20 |

### Decisions waiting on you

| Decision |
|---|
| The 14rem workspace rail is a permanent commitment |
| `SHIP.md` vs the `v2/` docs — now six files |
| What `/work/canvas` is for |
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

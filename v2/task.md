# Task

Every task for v2 and where it stands. Updated 2026-08-09.

**Progress: 4 or 5 of 13 done-when conditions in `SHIP.md`, depending on
machine load.** It is still the only progress number that means anything here —
it is checked by running commands, not by ticking boxes — but as of 2026-08-09
it is not stable, and the instability is task 28. Measured twice within
minutes: 5 from the browser, 4 from the CLI, the difference being `tsc` and the
checker's fixed 20s timeout. Everything below is the work behind it.

Status keys: **done** · **doing** · **next** · **blocked** (waiting on a
decision) · **later**

---

## Foundation

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Freeze v0.1 — tag, branch, `ARCHIVE.md` | **done** | `v0.1-archive` at `f038349`, 123 files, on the remote. Still deployed. |
| 2 | Start `v2` from an empty tree | **done** | Orphan branch, root commit touched exactly 2 files. |
| 3 | `.gitignore` before anything can be staged | **done** | `.env.local` here holds a live Vercel OIDC token. Verified 0 secrets in any commit on any branch. |
| 4 | Scaffold — Next 16, Tailwind v4, biome | **done** | Chosen fresh, not inherited. Nothing copied from v0.1. |

## Surfaces

| # | Task | Status | Notes |
|---|---|---|---|
| 5 | Empty home page | **done** | `app/page.tsx` |
| 6 | Work page, full-bleed | **done** | Three washes over lifted navy + dot grid. Matches the reference. |
| 7 | Workspace + canvas as views inside work | **done** | `/work` → `/work/workspace`. Real routes, not a client toggle. |
| 8 | Floating segmented switch | **done** | Lives in each view — a layout cannot see which child renders without a client hook. |
| 9 | Zero client JS on every route | **done** | 0 page chunks. The concrete answer to v0.1's 173KB. |
| 10 | A way back from the work page | **blocked** | No header means browser-back is the only exit. The reference showed no control, so none was invented. **Needs your call.** |
| 11 | Decide the 14rem workspace rail | **blocked** | A permanent commitment with nothing in it. Cheap now, expensive later. |

## The spec format

| # | Task | Status | Notes |
|---|---|---|---|
| 12 | `SHIP.md` format — ships / not shipping / done-when | **done** | 8 cuts and 13 conditions recorded. |
| 13 | Parser (`lib/ship/parse.ts`) | **done** | Works. Rendered by `/work/workspace`. Still no tests. |
| 14 | Done-when checker (`lib/ship/check.ts`) | **done** | Works, sandboxed, and now visible at `/work/workspace` — every verdict there comes from running its command on request. Caught its author overclaiming on the first run, and again on the first render. |
| 15 | Hand-write specs for 2+ other real projects | **next** | The cheapest test of whether the bet holds. No code needed. |
| 16 | Name one decision each of them changed | **next** | If none, the format is not useful and tooling will not save it. |

## Known problems

| # | Task | Status | Notes |
|---|---|---|---|
| 17 | Checker executes arbitrary shell from markdown | **done, macOS only** | Confined by seatbelt (`lib/ship/sandbox.ts`): no network, no filesystem outside the repo and toolchain, no `.git`/`.env*`/`.vercel`, empty environment. 14 attacks verified blocked by running them. Residual: a check can still destroy the repo's uncommitted working tree — writes cannot be denied, `tsc` is `incremental`. Non-macOS refuses to run rather than running unconfined. |
| 18 | A check can sabotage the process running it | **done** | `pnpm build` fought the dev server over `.next`. Now `tsc --noEmit`. |
| 19 | A check can expire | **done** | Commit-count check went stale in four commits. Now asserts a permanent property of history. |
| 20 | `SHIP.md` vs `v2/` docs overlap | **blocked, worse** | Six documents describe v2's state — `SHIP.md`, this file, `HANDOFF.md`, `README.md`, `v2/overview.md`, `v2/v2_features.md` — and the last three only restate the first three. Each is marked derivative, which is a convention, not a mechanism. It already failed once inside a single session: `README.md` called the surfaces empty after the workspace shipped, and two files carried a stale progress number. Fold them back, or generate them from the checker. **Needs your call.** |
| 28 | A verdict changes with machine load | **open** | `check.ts` has a fixed 20s timeout. `tsc --noEmit` takes ~12s here at load average 32 and has measured over 20s, turning a pass into `error`. Same repo, 5 passes in the browser and 4 from the CLI minutes apart. A timeout is not an exit code. The fix is a decision — longer, none, a distinct `slow` verdict, or measure-then-retry. |
| 29 | `/work/canvas` has no specification | **blocked** | An empty route from the sketch that no document defines. An interactive node canvas would cost client JavaScript. **Needs your call.** |

## Not started

| # | Task | Status | Notes |
|---|---|---|---|
| 21 | Tests — any at all | **started** | `test/sandbox.test.ts` — 19 assertions, all attacks against the real sandbox. `pnpm test` (node's runner, no dependency added). Mutation-verified: reverting the profile's carve-out to the wildcard form turns 5 of them red, so they are load-bearing. Nothing else in `lib/ship/` is covered — `parse.ts` has none. |
| 22 | CI gates | **next** | v0.1 ended with four gates. v2 has none. |
| 23 | MCP server + repo reader | **later** | Blocked behind 15/16 — do not build tooling for a format that has not proved useful. |
| 24 | Critique pass | **later** | The actual product. Everything before it is plumbing. |
| 25 | Cut rules | **later** | Written fresh, not ported from v0.1's 21 anti-steps. |
| 26 | `v2/product.md`, `v2/project.md` | **blocked** | Awaiting your content. |
| 27 | Deploy v2 | **later** | `main` still serves v0.1. Do not replace what is live until v2 is better. |

---

## The order that matters

15 and 16 come before 23, 24 and 25. Hand-write the specs before building
anything to manage them — if a hand-written `SHIP.md` does not change a real
decision on a real project, the tooling will not rescue it, and finding that
out costs an afternoon now versus months later.

21 and 22 should land before the next feature, not after. v0.1 proved the
discipline works and that adding it late is how it gets skipped.

## The gap none of this closes

Nobody has finished a project because of devcon — v0.1 or v2. There is still no
number for *"of N who started, M shipped."* Every task above is an assertion
that it will help, and none of them is evidence.

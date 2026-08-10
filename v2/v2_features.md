# v2 — features

> **This file is derivative. It is not a source of truth.**
> `SHIP.md` decides what ships and what is cut. `v2/task.md` holds task status.
> `HANDOFF.md` holds session state. `v2/overview.md` is this same ground as a
> flat list. This file only describes what exists today and how it was checked.
>
> Six documents now describe v2's state and **three of them — this one,
> `v2/overview.md` and `README.md` — only restate the other three.** `CLAUDE.md`
> flags exactly this as how v0.1 started rotting: its README claimed 209 tests
> while the code said 252. If this file and `SHIP.md` ever disagree, `SHIP.md`
> is right and this one is stale.
>
> Written 2026-08-09. Every "verified by" line below names a command that was
> actually run, not a thing that was read.

## Built

### The spec reader — `lib/ship/parse.ts`

Reads `SHIP.md` into `{ name, shipping, deadline, cuts, conditions, assumptions }`.

Plain markdown, no custom syntax. The one convention is a `` `check: …` ``
line under a done-when item naming a shell command that must exit 0. That
matters: the file stays useful when this tool is not installed, and an agent
that has never heard of devcon can still read it.

**No tests.** The only module in `lib/ship/` without any.

### The done-when checker — `lib/ship/check.ts`

Runs each condition's command and returns a verdict with its evidence.

Four verdicts, deliberately not three: `pass`, `fail`, `human` (no command — a
person decides), and `error` (could not run at all). Collapsing `error` into
`fail` is how a broken check reads as a real failure.

`claimed` and `verdict` are kept apart and never merged. The tick is the
author's claim; the verdict is what happened. The gap between them is the only
thing this tool knows that you do not.

### The sandbox — `lib/ship/sandbox.ts`

`SHIP.md` lives in the repo, and the repo may not be yours. Checks run under
macOS seatbelt:

| | |
|---|---|
| Network | denied outright |
| Filesystem | repo + toolchain only |
| `.git` | no writes |
| `.env*`, `.vercel` | no reads, no writes |
| Environment | replaced, never inherited |

No attempt is made to decide whether a command is *safe* — unwinnable, and the
checks legitimately need a shell. What changed is what the shell can reach.

**Off macOS every check returns `error` with the reason** rather than running
unconfined. A sandbox that silently degrades reports the same green as a real
one.

*Verified by:* `pnpm test` — 20 assertions, each running a real command through
the real sandbox. Mutation-verified: reverting one line of the profile turns
five of them red.

### The workspace — `/work/workspace`

Renders this repo's `SHIP.md`, checked live. Rail holds the spec's identity and
a tally; the main column holds every condition with its tick, verdict, command,
timing and raw evidence, then the cuts and the assumptions.

Drift — ticked boxes whose command disagrees — gets the top of the page.

*Verified by:* loading it. It reported drift on its first render, and caught two
defects in its own source that reading the code had not.

### Zero client JavaScript

Every route is a server component. The build emits **0 page chunks**.

`/work/workspace` is `force-dynamic`, which is load-bearing rather than a
preference: without it Next prerenders the route and runs `pnpm exec tsc` from
inside `next build`.

*Verified by:* `pnpm build`, then
`find .next/static/chunks/app -name 'page-*.js'` → empty.

## Not built, deliberately

From `SHIP.md`'s cut list — the reasons matter more than the list:

- **A step catalog.** 63 pre-written steps assumed the plan is knowable in
  advance. It is not.
- **Accounts, backend, sync.** `SHIP.md` is in your repo, so git is the sync.
- **Telemetry.** Nothing to measure until one person ships one thing.
- **A second agent to run the work.** You already have one.
- **Anything copied from v0.1.** The archive is a record, not a parts bin.

"A web app" is also on that list and is being built anyway — deliberately, on
request. The entry is kept rather than deleted so the reversal stays visible.

## Specified but not built

| | Where |
|---|---|
| MCP server + repo reader | `v2/task.md` 23 |
| The critique pass — *the actual product* | `v2/task.md` 24 |
| Cut rules | `v2/task.md` 25 |
| CI | `v2/task.md` 22 |

Everything built so far is plumbing for the critique pass.

**The order matters and is easy to get wrong:** hand-write `SHIP.md` for two
real projects and name one decision each changed *before* building tooling to
manage them. If a hand-written spec changes no real decision, the tooling will
not rescue it — and that costs an afternoon to find out now rather than months.

## No spec at all

**`/work/canvas` is an empty route and nothing says what it is for.** It came
from the sketch; `SHIP.md`, `v2/task.md` and `HANDOFF.md` all mention it only as
a route that exists. v0.1 had a canvas of service nodes, but nothing is carried
forward, and an interactive node canvas would need client JavaScript — which
this repo spends only when something earns it.

This is a decision, not a task.

## Known defects

- ~~A verdict can change with machine load.~~ **Fixed.** The budget was 20s and
  every check ran at once; `pnpm exec tsc --noEmit` takes ~1.3s idle and over
  20s at a load average of 32, so the same repo read 5 passes then 4, minutes
  apart. Now 120s, four at a time, and a timeout reports `error` with "not a
  failed condition — re-run" rather than `fail`. *Verified by:* 5/2/6 with zero
  errors on three consecutive runs at the load that used to break it, plus
  `test/check.test.ts`, mutation-verified. The remaining judgement calls are
  the two numbers.
- **A check can still destroy the repo's uncommitted working tree.** Writes
  cannot be denied: `tsc` is `incremental`, so even `--noEmit` writes
  `tsconfig.tsbuildinfo`. History is protected; unstaged work is not. A consent
  gate is the next layer and is not built.
- **`SHIP.md` check #7 fails by construction.** `test -d test && pnpm test` runs
  the suite *inside* the sandbox, one level deeper, where it cannot create the
  bait it attacks with. `pnpm test` run directly is green.
- **`SHIP.md` check #2 can never pass.** `git ls-remote … origin` needs the
  network, which is denied unconditionally.
- **`parse.ts` has no tests.**

## The gap none of this closes

Nobody has finished a project because of devcon — v0.1 or v2. There is still no
number for *"of N who started, M shipped."* Every feature above is plumbing
until that number exists, and **be suspicious of any plan that answers it with
more features.**

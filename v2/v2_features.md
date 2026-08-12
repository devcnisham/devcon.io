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
> Written 2026-08-09, updated 2026-08-10. Every "verified by" line below names a command that was
> actually run, not a thing that was read.

## Built

### The spec reader — `lib/ship/parse.ts`

Reads `SHIP.md` into `{ name, shipping, deadline, cuts, conditions, assumptions }`.

Plain markdown, no custom syntax. The one convention is a `` `check: …` ``
line under a done-when item naming a shell command that must exit 0. That
matters: the file stays useful when this tool is not installed, and an agent
that has never heard of devcon can still read it.

*Verified by:* `test/parse.test.ts` — 34 assertions, added 2026-08-11, the last
module in `lib/` to get a suite. It parses the repo's real `SHIP.md` as well as
a fixture, because a fixture alone would have been written by the same hand
that wrote the parser. Mutation-verified four ways, all red: re-introducing the
`\Z` truncation 16, dropping the wrapped-line fold 8, leaving the check in the
prose 3, hardcoding `claimed` 1. Every section body in the fixture opens with a
word containing a `z` for exactly the first of those.

### Authentication — `lib/auth/`, `/login`, `/signup`

Feature 001 of `v2/feature-phase.md`, phase 0. Sign up, sign in, sign out, and
`/` as a landing page when signed out.

**Local, and meant to be replaced.** Accounts live in `~/.devcon/users.json`
and nothing is sent anywhere; the plan puts a real backend at phase 6. Pages
call `createUser` and `authenticate`, never JSON, so swapping the store is one
file rather than every form.

| | |
|---|---|
| Hashing | scrypt from `node:crypto`. No dependency, no native build. |
| Cost | N/r/p written into every hash, so it can be raised without invalidating existing passwords |
| Session | Signed token in an httpOnly cookie. Key at `~/.devcon/session.key`, 0600 |
| Store | `~/.devcon/users.json`, 0600 |
| Client JavaScript | None. Real forms posting to server actions |

**This reverses `SHIP.md`'s "Accounts, backend, sync" cut** — accounts only.
The entry is kept and annotated rather than deleted, like the web app.

*Verified by:* `test/auth.test.ts` — 27 assertions — and by driving the running
app. Signup created the account and landed on the dashboard, sign out returned
the landing page, a wrong password showed the error with the email preserved
and the password cleared, and the right one signed in. **`document.cookie` was
empty in the browser**, which is what proves the cookie is httpOnly; asserting
the option in a config object only proves the option was set. At 375px both
pages fit with no horizontal overflow and no trapped scroll box — measured, not
looked at, because that is the failure the work page already shipped once.

Known and stated rather than implied: **signing out does not revoke** a token
copied beforehand, there is no password reset and no email confirmation because
devcon cannot send mail, and the cookie is not `secure` because devcon serves
http on localhost. Tasks 44–46.

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

**git reads the repo's own config and no other.** An include the profile cannot
follow is fatal to git, not ignored — so a `~/.gitconfig` with an `includeIf`
made *every* git check exit 128 with "unable to access …: Operation not
permitted", which reads as a broken repo. `GIT_CONFIG_NOSYSTEM=1` and
`GIT_CONFIG_GLOBAL=/dev/null` close it, and `safe.directory` for the repo under
check is injected back to replace what the global config would have carried.
The profile was not widened: an include may name any path, and CI proved what
sits on the other end of one.

*Verified by:* `pnpm test` — 32 assertions, each running a real command through
the real sandbox. Mutation-verified: reverting one line of the profile turns
five of them red, and removing `GIT_CONFIG_GLOBAL` turns six. The suite
**refuses to run** where there is no sandbox rather than passing vacuously, and
asserts the generated profile never grants `/`, `/Users` or a home directory.
The git-config tests run against a scratch repo whose bait include is asserted
unreadable first, because this file has twice passed against bait that was not.

### The workspace — `/work/workspace`

Renders the **open project's** `SHIP.md`, checked live — not this repo's. That
is the whole reason the sandbox exists: the commands come out of a markdown
file in a folder someone else may have written.

Stat cards, then a card per condition with its tick, verdict, command, timing
and raw evidence, then cuts and assumptions. A filter matches text, command and
evidence. Drift — ticked boxes whose command disagrees — gets the top of the
page and is computed from the **whole** spec, so a search can never hide it.

A project with no `SHIP.md` gets its detected gaps instead, urgent first. That
is the Mode 1 student, not an error state.

*Verified by:* running it against two projects — this repo (5 passing, 2
failing, 6 yours, 13 cards, drift banner) and a bare Express folder with a
committed `.env` (seven gaps, the leak first). Drift survives three filter
queries including one that matches nothing.

### The dashboard — `/`

Open a folder through a **real Finder window** — the server asks macOS, because
the browser cannot: `showDirectoryPicker()` is Chromium-only and never exposes
an absolute path. Or clone a repo by URL, validated first, since `git clone`
accepts transports that execute commands.

Every project is then a card read from its own files: stack from the lockfile
and dependencies, gaps from what is absent. **A `.env` not covered by
`.gitignore` is flagged urgent and sorted first** — that gap is losing a key,
not being untidy, and the dangerous case is the one where an ignore file exists
so it all looks handled. Clicking a card opens that project.

*Verified by:* seeding two projects and reading the render — a bare Vite folder
reported `Vite · JavaScript` with the leak first and a red bar; this repo
reported `Next.js · TypeScript · pnpm`. Nine injection strings asserted
rejected by the clone validator.

### Integrations — `/connectors` · The console — `/console`

Integrations reports what this project has installed and, more usefully, **what
nothing covers yet** — read from its `package.json`, not from a list of things
every project ought to have. The console probes what this machine can actually
do: platform, node, the sandbox, the Finder dialog, git. Anything unavailable
says why instead of showing a tick.

### The canvas — `/work/canvas`

The open project's facts as cards you can drag, two-finger pan and shift-drag
to select. Positions persist per project under `~/.devcon/canvas/`; positions
only, so a gap you fix disappears next load rather than lingering.

*Verified by:* driving it — a card dropped at +180,+140 landed at exactly
`translate3d(220px, 180px)`, the wheel moved the board, shift-drag selected all
three cards, and a fresh server render returned the dropped positions from
disk.

**Cost 4.4 KB gzip**, measured by building with and without it. v2's only
client component.

### A way out of the work page

The work page had exactly two links, `workspace` and `canvas`, and both kept
you on it. You could click forever and never leave; browser-back was the only
exit. A `←` home link now sits in the floating switch rather than in a restored
app header, which would have cost the full-bleed surface.

*Verified by:* clicking. Every route already returned 200 and every anchor
already had a correct `href` — nothing was broken in any sense a log or a test
would have shown. There was simply nowhere to go.

### One shared check run — `lib/ship/cache.ts`

Both views show verdicts, and running every command once per view put a view
switch at roughly thirteen seconds each way. The last run is held for fifteen
seconds.

**Any edit to `SHIP.md` beats the clock** — content is compared before the TTL
is, because seeing yesterday's verdicts after an edit would be worse than any
slow render. The age is always printed on screen. A cached verdict that hides
when it was taken is precisely the unchecked claim this tool exists to catch.

*Verified by:* `test/cache.test.ts` — 6 assertions covering reuse inside the
TTL, expiry past it, and an edit invalidating immediately.

### It works on a phone

Below `lg` the work page scrolls as one document and the floating switch is
pinned. Before this it locked itself to the viewport at every width, so a phone
got two independent scroll boxes: the rail took half the screen and the
conditions list had 2832px of content trapped in the other 374px.

*Verified by:* measuring `scrollHeight` against `clientHeight` per element at
408px. **Never verified below 408px** — the preview pane will not go narrower,
so a true 375px phone is untested.

### One colour system

Every colour comes from `--color-pass`, `--color-fail`, `--color-cut`,
`--color-text`, `--color-muted` and `--color-line`. Zero raw Tailwind colours
remain in `app/`.

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

Everything built so far is plumbing for the critique pass.

**The order matters and is easy to get wrong:** hand-write `SHIP.md` for two
real projects and name one decision each changed *before* building tooling to
manage them. If a hand-written spec changes no real decision, the tooling will
not rescue it — and that costs an afternoon to find out now rather than months.

## CI

`.github/workflows/gates.yml` — the five gates plus a zero-page-chunk check and
a tracked-secret scan, on every push and pull request. **macOS**, because the
sandbox tests would pass without running anything on Linux.

*Verified by:* it going green. Six runs to get there, and every failure was a
real portability bug this laptop could not have produced — a hardcoded Xcode
path, the xcrun shim, a shallow clone with no tags, and pnpm in an unexpected
place. That is the entire argument for having it.

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
- **`bullets()` swallows prose written between two bullets.** Found by writing
  `parse.ts`'s tests on 2026-08-11. Folding a non-bullet line into the bullet
  above it is how a wrapped reason is recovered, and it cannot tell that line
  from a new paragraph — so prose between two bullets is appended to the one
  above as part of its reason. *Verified by:* `test/parse.test.ts`, which
  asserts the current behaviour rather than wishing for the other one, so a fix
  turns it red instead of passing quietly. This repo's `SHIP.md` puts its prose
  before the bullets and never trips it; a cloned repo's need not.
- **A cut with no `**bold**` name is dropped entirely**, rather than arriving
  with an empty reason. Same test file, same reason for leaving it.
- **`SHIP.md` check #2 stays failing by decision.** `git ls-remote … origin`
  needs the network; the sandbox denies it. The box stays ticked because the
  fact is true, and the check reports the disagreement rather than hiding it.
- **No end-to-end tests.** Unit and integration exist; nothing drives the app
  as a user. The last open item from the owner's daily checklist.
- **Mobile is unverified below 408px.** Fixed and measured at 408; the preview
  pane will not go narrower.

## The gap none of this closes

Nobody has finished a project because of devcon — v0.1 or v2. There is still no
number for *"of N who started, M shipped."* Every feature above is plumbing
until that number exists, and **be suspicious of any plan that answers it with
more features.**

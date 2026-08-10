# CLAUDE.md — devcon v2

Read this, then `HANDOFF.md`, then `v2/task.md`.

## What this is

A shipping critic that runs inside your coding agent, keeps one `SHIP.md` in
your repo, reads what you actually built, and tells you what to cut.

Branch `v2` is an **orphan** — it shares no history with v0.1. That is
deliberate.

## Gates

Five commands. All five pass right now; keep them passing.

```bash
pnpm lint              # biome
pnpm exec tsc --noEmit # types
pnpm test              # node --test — attacks the sandbox for real
pnpm build             # next build — ALSO typechecks
pnpm dev               # localhost:3000
```

**`pnpm build` prints "✓ Compiled successfully" before it typechecks.** That
line is the bundler, not the gate. Read the exit code — in v0.1 that mistake
hid 7 type errors.

Tests cover `lib/ship/sandbox.ts` and nothing else — `parse.ts` has none. There
is still no CI. Both are open tasks and should land before the next feature.

Every assertion in `test/sandbox.test.ts` runs a real command through the real
sandbox. **Do not add one that inspects the profile's text** — the profile that
leaked this repo's OIDC token read as correct.

## Rules

- **Nothing is copied from v0.1.** The archive is a record, not a parts bin. If
  v2 needs something from it, retype it with a fresh reason. v0.1's failure was
  not code quality — it was 20,000 well-tested lines nobody shipped a project
  with, and copying any of them forward carries the assumptions that produced
  that.
- **No secret ever enters the repo.** `.env.local` in this directory holds a
  live Vercel OIDC token. `.gitignore` was the first file committed for that
  reason. Verified: 0 occurrences of `.env`, `.env.local` or `.vercel/` in any
  commit on any branch.
- **Zero client JavaScript unless something earns it.** Every route is a server
  component; the build emits 0 page chunks. v0.1's landing page cost 173KB gzip
  to render a headline and one input. If a `"use client"` goes in, say what it
  bought.
- **State what isn't done.** Do not tick a box you have not run — the checker
  in `lib/ship/` caught its own author doing exactly that on its first run.
- **Verify by running, not reading.** Every real defect this session came from
  looking at the rendered page or the exit code. None came from reading code.

## Gotchas that already cost time

- **A wildcard deny does not override a specific allow in seatbelt.** In
  `lib/ship/sandbox.ts`, `(deny file-read* …)` after
  `(allow file-read-data (subpath …))` is a no-op in either order — the more
  specific operation wins. The carve-outs must name the same operation as the
  allow they have to beat. Written the obvious way, the profile leaked this
  repo's live OIDC token. **Verify that file by running attacks, never by
  reading it.**
- **`\Z` is not a JavaScript regex token.** It matches the literal letter `z`.
  In `lib/ship/parse.ts` it truncated every section at its first `z` — "frozen"
  became "fro" and 13 of 14 conditions vanished. It read as bad markdown.
- **A percentage height on a flex child does not resolve.** `h-full` collapses.
  Use `absolute inset-0`.
- **A dark gradient needs far more opacity than the value suggests.** The first
  wash pass looked right in CSS and rendered flat black.
- **A layout cannot see which child is rendering.** Marking an active tab from
  a layout needs `useSelectedLayoutSegment`, a client hook. The view tabs live
  in each view instead — that is what keeps the zero-JS property.
- **Deleting a route leaves stale generated types.** `.next/types/validator.ts`
  keeps importing the old page and fails the typecheck like a source error.
  `rm -rf .next`.
- **`biome.jsonc` lists its own excludes.** `vcs.useIgnoreFile` is deprecated in
  2.5.7; dropping it silently pulled v0.1's leftover CodeQL database into lint.
- **A fixed timeout makes a verdict depend on the machine, not the code.**
  `check.ts` allows a check 20s. `pnpm exec tsc --noEmit` takes ~1.3s on an idle
  machine and over 20s at a load average of 32 — so the same repo reported 5
  passing conditions and then 4, minutes apart, and the only variable was two
  VS Code helpers at 370% CPU. **A timeout is not an exit code.** Before
  blaming the sandbox for slowness, time the command unsandboxed and check
  `uptime` — four hypotheses died that way here.
- **`preview_stop` does not reap `next-server`.** Three processes kept port
  3000 after the tool reported the server stopped, and they skewed every
  timing taken afterwards. `lsof -ti:3000 | xargs kill -9`.

## Documents

| File | Holds | Authority |
|---|---|---|
| `SHIP.md` | What ships, what is cut and why, done-when conditions with runnable checks | **Wins every disagreement** |
| `v2/task.md` | Every task and its status | Task status |
| `HANDOFF.md` | Session state and open questions | Session state |
| `v2/overview.md` | Everything as a flat list | Derivative |
| `v2/v2_features.md` | The same ground in prose, with how each part was verified | Derivative |
| `README.md` | Public-facing summary | Derivative |
| `v2/product.md`, `v2/project.md` | Empty — awaiting the owner's content | — |

**Unresolved, and worse than it was.** Six documents describe v2's state and
**three of them are derivative restatements**. The authority column above
is a convention, not a mechanism — and a convention is exactly what failed in
v0.1, whose README claimed 209 tests while the code said 252 and nothing
noticed for weeks. Three of these already went stale within one session: the
README called the surfaces empty after the workspace shipped, and two files
carried a progress number that had been wrong for a day.

This needed deciding before they grew. They grew. It is task 20, and the honest
options are to fold the derivative three back into `SHIP.md` and `v2/task.md`,
or to generate them from the checker rather than typing them.

## v0.1

Frozen, not deleted. Still deployed at https://devcon-hazel.vercel.app.

```bash
git show v0.1-archive:HANDOFF.md   # the densest knowledge in the old repo
git show archive/v0.1:ARCHIVE.md   # what it proved and what it did not
```

What it proved: prompts work when an agent runs them — 2 of 63 cleared a
two-agent bar, checked by running the result. What it did not: **nobody has
finished a project because of it.** That gap is still open and v2 has not
touched it.

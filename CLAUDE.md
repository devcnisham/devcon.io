# CLAUDE.md — devcon v2

Read this, then `HANDOFF.md`, then `v2/task.md`.

## What this is

A shipping critic that runs inside your coding agent, keeps one `SHIP.md` in
your repo, reads what you actually built, and tells you what to cut.

Branch `v2` is an **orphan** — it shares no history with v0.1. That is
deliberate.

## Gates

Four commands. All four pass right now; keep them passing.

```bash
pnpm lint              # biome
pnpm exec tsc --noEmit # types
pnpm build             # next build — ALSO typechecks
pnpm dev               # localhost:3000
```

**`pnpm build` prints "✓ Compiled successfully" before it typechecks.** That
line is the bundler, not the gate. Read the exit code — in v0.1 that mistake
hid 7 type errors.

There are no tests and no CI yet. Both are open tasks and should land before
the next feature, not after.

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

## Documents

| File | Holds |
|---|---|
| `SHIP.md` | What ships, what is cut and why, done-when conditions with runnable checks |
| `HANDOFF.md` | Session state and open questions |
| `v2/task.md` | Every task and its status |
| `v2/product.md`, `v2/project.md` | Empty — awaiting the owner's content |

**Unresolved:** `SHIP.md` and the `v2/` docs overlap. Two sources of truth is
how v0.1 started rotting — its README claimed 209 tests while the code said
252. This needs deciding before either grows.

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

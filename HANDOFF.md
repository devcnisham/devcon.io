# devcon v2 — handoff

> Read this first, then `SHIP.md`. Written 2026-08-08 at the end of the session
> that froze v0.1 and started v2 from an empty tree.

**Branch: `v2`** (orphan — no v0.1 history). Four commits. Everything pushed.
**Gates all green: lint 0, tsc 0, build 0, and 0 client-side page chunks.**

```bash
pnpm install
pnpm dev        # localhost:3000
```

---

## What v2 is

A shipping critic that runs inside your coding agent, keeps one `SHIP.md` in
your repo, reads what you actually built, and tells you what to cut.

Four things decided in this session, all of them the user's calls:

1. Same problem as v0.1 — getting a thing shipped — but a new answer to it.
2. It lives in the agent, watches the repo, critiques rather than prescribes,
   and keeps a shared spec. All four together, not a choice between them.
3. Judged on personal use first, not a cohort.
4. **A web app is being built after all.** `SHIP.md`'s "not shipping" list still
   says no web app; that entry is kept rather than deleted so the reversal is
   visible instead of quietly rewritten.

---

## Where things stand

### Built and working

| Path | What |
|---|---|
| `app/page.tsx` | Empty home |
| `app/work/` | The work page — full-bleed surface, floating switch |
| `app/work/workspace/`, `app/work/canvas/` | Two empty views inside it |
| `app/work/views.tsx` | The floating segmented switch |
| `lib/ship/parse.ts` | Reads `SHIP.md` — works |
| `lib/ship/check.ts` | Runs the done-when checks — works, **wired to nothing** |

Page flow, from the sketch: `/` → `/work`, with workspace and canvas as two
views *inside* the work page rather than siblings of home. `/work` redirects to
`/work/workspace`.

### Waiting on you

`v2/task.md`, `v2/product.md` and `v2/project.md` exist with only a heading
each. You said you would specify what goes in them. Nothing was invented.

**Decide how these relate to `SHIP.md`**, which already holds what ships, what
is cut, and the done-when conditions. Either it folds into `v2/` or it stays as
the machine-checkable one — but two files claiming to be the source of truth is
how the last version started rotting.

---

## Open questions, in the order they will bite

1. **The work page is a dead end.** With the app header gone there is no way
   back to home except browser-back. The reference showed no such control, so
   this follows it rather than inventing one — but it needs an answer before
   anything real lives there.
2. **The checker is unsolved, not finished.** Running shell out of a markdown
   file means opening a cloned repo's `SHIP.md` executes whatever it says. And
   a check can sabotage the process running it — `pnpm build` from inside the
   dev server fought over `.next` and failed a build that was fine.
3. **The workspace rail is a 14rem commitment** with nothing in it. Cheap to
   change now, expensive once things live in it.
4. **No tests exist.** The one unticked mechanical box in `SHIP.md`. v0.1's
   discipline — every assertion mutation-verified — is worth rebuilding early
   rather than bolting on.
5. **No CI.** v0.1 ended with a four-gate workflow; v2 has none yet.

---

## Things that cost time, so they do not cost it twice

- **`\Z` is not a JavaScript regex token.** It matched the literal letter `z`,
  so `parse.ts` truncated every section at its first `z` — "frozen" became
  "fro" and thirteen of fourteen conditions vanished. It read as bad markdown,
  not a bad parser.
- **A percentage height on a flex child does not resolve.** `h-full` collapsed
  and pinned the canvas label to the top. Use `absolute inset-0`. v0.1 recorded
  this same gotcha, which is the only time so far the archive has paid off.
- **A dark gradient needs far more opacity than the value suggests.** The first
  wash pass looked correct in CSS and rendered as flat black.
- **A layout cannot see which child is rendering.** Marking the active view tab
  from `work/layout.tsx` would need `useSelectedLayoutSegment`, a client hook.
  The tabs live in each view instead — that is what keeps the zero-JS property.
- **Deleting a route leaves stale generated types.** `.next/types/validator.ts`
  kept importing `app/canvas/page.js` and failed the typecheck with what looked
  like a source error. `rm -rf .next`.
- **`biome.jsonc` lists its own excludes.** `vcs.useIgnoreFile` is deprecated in
  2.5.7, and dropping it silently pulled v0.1's leftover CodeQL database into
  the lint run.
- **`.env.local` in this directory holds a live Vercel OIDC token.** That is why
  `.gitignore` was the first file committed. Verified: no `.env*` or `.vercel`
  in any commit on any branch.

---

## v0.1, frozen

Not deleted. Still deployed and still reachable.

| Ref | At | What |
|---|---|---|
| `v0.1-archive` (tag) | `f038349` | The exact shipped tree, 123 files |
| `archive/v0.1` | — | That tree plus `ARCHIVE.md` |
| `main` | `f038349` | Still serving v0.1 |

Live: **https://devcon-hazel.vercel.app** — `/`, `/docs`, `/start`.

```bash
git show v0.1-archive:HANDOFF.md   # the densest knowledge in the old repo
git show archive/v0.1:ARCHIVE.md   # what it proved, what it did not
```

**The archive is a record, not a parts bin.** Nothing is copied forward. If v2
needs something from it, retype it with a fresh reason — v0.1's failure was not
code quality, it was 20,000 well-tested lines nobody shipped a project with.

What it proved: prompts work when an agent runs them — 2 of 63 clear the
two-agent bar, checked by running the result. What it did not: **nobody has
finished a project because of it.** That gap is still open, and v2 has not
touched it either.

---

## Deploy

`main` still deploys v0.1 to Vercel on merge. **`v2` is not deployed** and
should not be until it is worth replacing what is live. `NEXT_PUBLIC_SITE_URL`
was a v0.1 concern and does not exist in v2 yet.

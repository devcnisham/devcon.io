# devcon v2 — handoff

> Read `CLAUDE.md` first, then this, then `v2/task.md`. Written 2026-08-08 at
> the end of the session that froze v0.1 and started v2 from an empty tree.

**Branch: `v2`** (orphan — no v0.1 history). Everything committed and pushed;
working tree clean, nothing local-only.
**Gates all green: lint 0, tsc 0, build 0, and 0 client-side page chunks.**
**Progress: 6 of 13 done-when conditions in `SHIP.md`** — the only progress
number here that is produced by running commands rather than by self-report.

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

`v2/product.md` and `v2/project.md` exist with only a heading each. You said you
would specify what goes in them; nothing was invented. `v2/task.md` is written —
27 tasks with real status.

**Decide how these relate to `SHIP.md`**, which already holds what ships, what
is cut, and the done-when conditions. Either it folds into `v2/` or it stays as
the machine-checkable one — but two files claiming to be the source of truth is
how the last version started rotting: v0.1's README claimed 209 tests while the
code said 252, and nothing noticed for weeks.

### Three decisions blocked on you, not on work

Listed in full in `v2/task.md`; repeated here because they gate everything else.

1. **The work page has no way back to home.** Browser-back is the only exit.
2. **The 14rem workspace rail** is a permanent commitment with nothing in it.
3. **`SHIP.md` vs the `v2/` docs** — see above.

The fourth — the checker running arbitrary shell — is closed. See below.

### The ordering most likely to be got wrong

Hand-write `SHIP.md` for two real projects **before** building an MCP server to
manage them (`v2/task.md` 15–16 before 23–25). If a hand-written spec changes
no real decision on a real project, tooling will not rescue it — and that is an
afternoon to find out now rather than months later.

Tests and CI should land before the next feature. v0.1 proved both that the
discipline works and that adding it late is how it gets skipped.

---

## Open questions, in the order they will bite

1. **The work page is a dead end.** With the app header gone there is no way
   back to home except browser-back. The reference showed no such control, so
   this follows it rather than inventing one — but it needs an answer before
   anything real lives there.
2. **The checker is sandboxed, with two things left open.** Checks now run under
   seatbelt (`lib/ship/sandbox.ts`): network denied, filesystem confined to the
   repo and toolchain, `.git`/`.env*`/`.vercel` denied, environment replaced
   rather than inherited. Fourteen attacks were run against it and all fourteen
   were blocked — including reading this repo's live OIDC token, which the first
   version of the profile handed straight back.
   - **A check can still destroy the repo's uncommitted working tree.** Writes
     have to be allowed: `tsc` is `incremental`, so even `--noEmit` writes
     `tsconfig.tsbuildinfo`. History is protected; unstaged work is not. A
     consent gate — show the commands, approve once per repo — is the next layer
     and is not built.
   - **macOS only.** Seatbelt does not exist on Linux or Windows, so every check
     there returns `error` with the reason. That is deliberate: a sandbox that
     silently degrades reports the same green as a real run.
   - **`SHIP.md`'s own check #2 can no longer pass.** `git ls-remote … origin`
     needs the network, and the network is denied unconditionally. Your call,
     made knowingly. The box stays ticked because the fact is true; the check
     now errors. Rewriting it as a local assertion is the same move that fixed
     the commit-count check when it expired.
3. **The workspace rail is a 14rem commitment** with nothing in it. Cheap to
   change now, expensive once things live in it.
4. **Tests exist for the sandbox and nothing else.** `test/sandbox.test.ts`, 19
   assertions, run with `pnpm test` — node's own runner, no dependency added.
   Each one attacks the real sandbox rather than reading the profile, and they
   are mutation-verified: reverting the profile's carve-out to the wildcard form
   turns five of them red. `parse.ts` and the rest of `check.ts` have none.
   - **`SHIP.md`'s check #7 — `test -d test && pnpm test` — now fails, and the
     reason is worth knowing.** The checker runs it *inside* the sandbox, so the
     suite is nested one level deeper and cannot create the bait file it attacks
     with; all 19 error before asserting anything. `pnpm test` run directly is
     green. Either narrow the check to `test -d test`, or give the suite a
     `pnpm test:sandbox` of its own and point the check at the rest. **Do not
     make the suite skip when it detects confinement** — that turns check #7
     green while testing nothing, which is the exact failure the suite exists to
     prevent.
5. **No CI.** v0.1 ended with a four-gate workflow; v2 has none yet — and there
   are now five gates, `pnpm test` among them.

---

## Things that cost time, so they do not cost it twice

- **A wildcard deny does not override a specific allow in seatbelt.**
  `(deny file-read* …)` placed after `(allow file-read-data (subpath …))` does
  nothing at all — in either order. The more specific operation wins, and the
  profile reads as airtight while leaking the whole repo. The carve-outs must
  name `file-read-data` exactly, matching the allow. Cost: the first profile
  returned this repo's live `VERCEL_OIDC_TOKEN` on the first attack run.
- **A blocked-attack test can pass for the wrong reason, twice over.** "Cannot
  read `~/.ssh/id_rsa`" passed because `~/.ssh` does not exist on this machine —
  it proved nothing. And the `~/.npmrc` attack reported a *leak* because its
  pattern was `/./`, which matched the string "Operation not permitted". An
  attack test must assert on the file's contents and must run against bait that
  actually exists.
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

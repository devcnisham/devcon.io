# devcon v2 — handoff

> Read `CLAUDE.md` first, then this, then `v2/task.md`. Started 2026-08-08 when
> v0.1 was frozen; rewritten 2026-08-10 at the end of the session that built
> the five surfaces, the canvas, and CI. Swept 2026-08-11 — that rewrite left
> six claims behind that the same session had already made false, including a
> test count this file contradicted two hundred lines further down. Recorded
> here rather than quietly fixed, because it is the failure this tool exists to
> catch, committed by the tool's own handoff.

**Branch: `v2`** (orphan — no v0.1 history). Everything committed and pushed;
working tree clean.

**Gates: lint 0, tsc 0, test 0 (118 tests), build 0, 0 page chunks.**
**CI is green** — `.github/workflows/gates.yml`, seven gates, macOS.

**Progress: 5 of 13 done-when conditions in `SHIP.md`** — measured by running
the commands, not by reading ticks. Stable across runs since the timeout fix.
One condition drifts: *"The freeze exists on the remote"* is ticked and its
check fails, because the sandbox denies the network by design. That is a known,
deliberate disagreement, not a regression.

```bash
pnpm install
pnpm dev        # localhost:3000
```

---

## Where to start next session

Read this section first; the rest is history and detail.

**Three things are true and worth knowing before touching anything:**

1. **The app works end to end for one story.** Open a folder (real Finder
   dialog) or clone a repo → it appears as a card with its stack and its gaps →
   click it → the work page checks *that project's* `SHIP.md` in the sandbox,
   or shows its gaps if it has none → the canvas shows the same facts as cards
   you can drag.
2. **`SHIP.md` still cuts a web app**, and one is being built anyway. The entry
   is kept rather than deleted so the reversal stays visible.
3. **Nobody has finished a project because of devcon.** That has not changed
   and no feature here changes it.

**The next real move is not code.** `v2/task.md` 15 and 16: hand-write a
`SHIP.md` for two projects that are not this one, and name one decision each
changed. If a hand-written spec changes no real decision, none of the tooling
matters — and that is an afternoon to find out, not a quarter.

**Cheap and open, if you want code instead:** there are no end-to-end tests, and
`SHIP.md`'s own check #7 fails by construction (it runs `pnpm test` *inside* the
sandbox, where the suite cannot create the bait file it attacks with).
`parse.ts` was the third item here until 2026-08-11 and now has 34 tests.

---

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
| `app/page.tsx`, `open.tsx`, `cards.tsx` | Dashboard — Finder dialog, clone, stats, a card per project |
| `app/connectors/` | Integrations — coverage, what nothing covers yet, MCP badges |
| `app/console/` | What devcon is doing and what this machine can do, probed |
| `app/work/workspace/` | The open project's `SHIP.md`, checked in the sandbox |
| `app/work/canvas/` | The same project as draggable cards |
| `lib/ship/` | parse · check · sandbox · cache · search |
| `lib/detect.ts` | A project's stack and gaps, read from its files |
| `lib/workspaces.ts`, `clone.ts`, `pick-folder.ts` | Import, clone, real Finder dialog |
| `lib/canvas.ts` | Card positions, per project |
| `lib/diagnostics.ts` | Host probes for the console |
| `.github/workflows/gates.yml` | Seven gates on every push. Green. |

**118 tests.** `parse` 34 · `sandbox` 24 · `detect` 14 · `canvas` 12 ·
`clone` 11 · `search` 11 · `cache` 6 · `check` 6. Counted by running each file,
not by remembering. Every module in `lib/` now has a suite.

Everything devcon stores lives under `~/.devcon/` — the project list, which
project is open, and canvas layouts. **Never inside a tracked repo**, where it
would land in someone's diff and their submission.

### Waiting on you

`v2/product.md` and `v2/project.md` exist with only a heading each. You said you
would specify what goes in them; nothing was invented. `v2/task.md` is written —
29 tasks with real status.

**Decide how these relate to `SHIP.md`**, which already holds what ships, what
is cut, and the done-when conditions. Either it folds into `v2/` or it stays as
the machine-checkable one — but two files claiming to be the source of truth is
how the last version started rotting: v0.1's README claimed 209 tests while the
code said 252, and nothing noticed for weeks.

**This got worse on 2026-08-09, on request.** Six documents now describe v2's
state — `SHIP.md`, `v2/task.md`, this file, `README.md`, `v2/overview.md` and
`v2/v2_features.md` — and the last three only restate the first three. They are
each marked derivative and point at `SHIP.md` as the one that wins, which is a
convention rather than a mechanism.

The prediction already came true inside a single session: `README.md` described
the surfaces as empty after the workspace shipped, and two files carried a
progress number that had been wrong for a day. Nothing caught either — I did,
by hand, while looking for something else.

The honest options are to fold the derivative three back into `SHIP.md` and
`v2/task.md`, or to **generate them from the checker instead of typing them** —
which is the same argument this tool makes about ticked boxes, turned on its
own documentation.

### Two decisions blocked on you, not on work

Listed in full in `v2/task.md`; repeated here because they gate everything else.

1. **The 14rem workspace rail** is a permanent commitment with nothing in it.
2. **`SHIP.md` vs the `v2/` docs** — see above.

Two others are closed: the work page had no way home (a `←` link in the
floating switch), and the checker ran arbitrary shell (sandboxed — see below).

### The ordering most likely to be got wrong

Hand-write `SHIP.md` for two real projects **before** building an MCP server to
manage them (`v2/task.md` 15–16 before 23–25). If a hand-written spec changes
no real decision on a real project, tooling will not rescue it — and that is an
afternoon to find out now rather than months later.

**CI has landed and unit tests are complete; end-to-end are not.** Seven gates
run on every push and are green, and every module in `lib/` has a suite as of
2026-08-11. **Nothing drives the app as a user.** That goes in before the next
feature — v0.1 proved both that the discipline works and that adding it late is
how it gets skipped.

---

## Open questions, in the order they will bite

1. **The work page was a dead end — fixed 2026-08-09.** It had exactly two
   links, `workspace` and `canvas`, and both kept you on the work page. You
   could click forever and never leave; browser-back was the only exit. A `←`
   home link now sits in the floating switch rather than in a restored app
   header, which would have cost the full-bleed surface the page is built on.
   **Found by clicking, not by reading** — every route returned 200 and every
   anchor had a correct `href`, so nothing was broken in the sense a test or a
   log would have shown. The empty canvas made it worse: switching to it moved
   the tab highlight and changed nothing else, so a navigation that had worked
   read as one that had failed. A label fixed that, and both labels were
   removed again on 2026-08-10 when the views were cleared — so the symptom is
   back by choice. Worth remembering when either view is filled in.
2. **The checker is sandboxed, with two things left open.** Checks now run under
   seatbelt (`lib/ship/sandbox.ts`): network denied, filesystem confined to the
   repo and toolchain, `.git`/`.env*`/`.vercel` denied, environment replaced
   rather than inherited. **Twenty-four attacks run against it, all blocked** —
   including reading this repo's live OIDC token, which the first version of the
   profile handed straight back.
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
4. **Tests cover every module in `lib/`.** 118 assertions — `parse` 34 ·
   `sandbox` 24 · `detect` 14 · `canvas` 12 · `clone` 11 · `search` 11 ·
   `cache` 6 · `check` 6 — run with `pnpm test`, node's own runner, no
   dependency added. Each attacks real behaviour rather than reading source,
   and they are mutation-verified: reverting the profile's carve-out turns five
   red, flipping a timeout verdict to `fail` turns one red, dropping the Xcode
   allow turns one red, and re-introducing the `\Z` truncation turns sixteen
   red.
   - **`parse.ts` got its suite on 2026-08-11**, last module without one. It
     parses the repo's real `SHIP.md` as well as a fixture, because a fixture
     alone would have been written by the same hand that wrote the parser.
     Four mutations were run against it and all four go red: `\Z` truncation
     16, dropping the wrapped-line fold 8, leaving the check in the prose 3,
     hardcoding `claimed` 1.
   - **It found one defect, left asserted rather than fixed.** `bullets()`
     cannot tell a wrapped line from a new paragraph, so prose written
     *between* two bullets is appended to the one above it. `SHIP.md` puts its
     prose before the bullets and never trips this — luck, not design. A
     second, smaller one: a cut with no `**bold**` name is dropped silently
     rather than surfacing with an empty reason.
   - **`SHIP.md`'s check #7 — `test -d test && pnpm test` — now fails, and the
     reason is worth knowing.** The checker runs it *inside* the sandbox, so the
     suite is nested one level deeper and cannot create the bait file it attacks
     with; all 19 error before asserting anything. `pnpm test` run directly is
     green. Either narrow the check to `test -d test`, or give the suite a
     `pnpm test:sandbox` of its own and point the check at the rest. **Do not
     make the suite skip when it detects confinement** — that turns check #7
     green while testing nothing, which is the exact failure the suite exists to
     prevent.
5. **CI exists and is green** — `.github/workflows/gates.yml`. Seven gates on
   macOS: the five local ones plus a zero-page-chunk check and a tracked-secret
   scan. It took six runs to go green, and **every failure was a real
   portability bug that this laptop could not have shown**: a hardcoded Xcode
   path, the xcrun shim needing `xcodebuild`, a shallow clone with no tags, and
   pnpm living somewhere else on the runner. The sandbox now derives its
   toolchain allowlist from `PATH` instead of naming directories.
6. **A verdict changed with machine load — fixed 2026-08-09.** `check.ts`
   allowed 20s and ran every check at once. `pnpm exec tsc --noEmit` takes
   ~1.3s idle and over 20s at a load average of 32, so the same repo gave 5
   passes in the browser and 4 from the CLI minutes apart, with a busy text
   editor as the only variable. A tool that says "a ticked box is a claim, an
   exit code is evidence" cannot have its evidence depend on what else is
   running.

   Both causes were real and both moved. The budget is 120s, because the honest
   ceiling is "probably hung", not "slower than a build". And `checkAll` runs
   four at a time rather than all of them, because unbounded concurrency
   manufactured the load that tripped the old ceiling — thirteen sandboxed
   commands at once, one of which (`pnpm test`) spawns nineteen more.

   A timeout still reports `error` and never `fail`, and now says in its
   evidence that it is not a failed condition and to re-run. Both are
   parameters, which is what let `test/check.test.ts` drive the timeout to one
   second instead of waiting two minutes. Mutation-verified: changing that
   verdict to `fail` turns the test red.

   **What remains open is the number, not the mechanism.** 120s and 4 are
   judgement calls made without you. If a real check on a real project needs
   longer, or the page feels slow, those are the two knobs.
7. **`/work/canvas` — specified on request, then built.** It was an empty route
   from the sketch that no document said the *purpose* of. You specified it as a
   Figma-like surface: drag, two-finger pan, shift-drag marquee select. The
   cards are built on the server from the open project's files, and
   `board.tsx` only moves them; positions persist per project under
   `~/.devcon/canvas/`. **Positions only** — a gap you fix disappears next load
   rather than lingering because a layout file remembered it.
   - **This is v2's only `"use client"`, and it cost 4.4 KB gzip**, measured by
     building with and without it rather than asserted. No dependency: most of
     React Flow's ~50 KB would have gone unused.
   - Still open, and still yours: **zoom, undo, edges and snapping** are not
     built. Drag, pan and select are.

---

## Things that cost time, so they do not cost it twice

- **Stock `/usr/bin/git` on macOS is an xcrun shim, not git.** It dlopens
  `libxcrun` from the Xcode developer directory. The sandbox profile omitted
  that path, so every git check died with "unable to load libxcrun" — and it
  looked fine from a terminal, because this shell's PATH finds Homebrew's real
  git first. The dev server's PATH does not. Found by rendering the page and
  reading the evidence it printed, not by running the same checks from a shell
  where they had always worked. The regression test calls `/usr/bin/git` by
  absolute path for exactly that reason.
- **The fix for that then broke CI, and only CI could have shown it.** Allowing
  `/Applications/Xcode.app/Contents/Developer` is correct on this laptop and
  wrong on a GitHub runner, where Xcode installs as `Xcode_26.6.app` — so every
  git check failed there with the identical message. The profile now takes the
  developer directory as a parameter, probed once with `xcode-select -p`.
  **Do not hardcode a toolchain path.**
- **Never allow a PATH entry's parent directory.** The sandbox derives its
  toolchain allowlist from `PATH` so nvm, asdf, volta and a CI runner's pnpm all
  work without being named. Adding each entry's `dirname` looked like a harmless
  way to reach symlink targets and granted the **filesystem root**, because PATH
  contains `/bin`. The attack tests caught it on the next run, and
  `test/sandbox.test.ts` now asserts the invariant directly rather than relying
  on a bait file happening to exist.
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
  not a bad parser. **It now has a regression test**: every section body in
  `test/parse.test.ts`'s fixture opens with a word containing a `z`, and
  putting the truncation back turns sixteen tests red.
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

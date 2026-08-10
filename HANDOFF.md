# devcon v2 — handoff

> Read `CLAUDE.md` first, then this, then `v2/task.md`. Written 2026-08-08 at
> the end of the session that froze v0.1 and started v2; updated 2026-08-09,
> the session that sandboxed the checker and put it on screen.

**Branch: `v2`** (orphan — no v0.1 history). Everything committed and pushed;
working tree clean, nothing local-only.
**Gates all green: lint 0, tsc 0, test 0, build 0, and 0 client page chunks.**

**Progress: 5 of 13 done-when conditions in `SHIP.md`** — the only progress
number here produced by running commands rather than by self-report.

It read 4 or 5 depending on machine load earlier the same day, which was a
defect in the checker rather than in the repo. Fixed: see open question 6.
Three consecutive runs now agree at the load that used to break it.

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
| `app/page.tsx` | The plan's shape — parsed, not checked. Says a tick is a claim. |
| `app/work/` | The work page — full-bleed surface, floating switch |
| `app/work/workspace/` | This repo's `SHIP.md`, parsed and checked live |
| `app/work/canvas/` | Still empty, and now says so |
| `app/work/views.tsx` | The floating segmented switch |
| `lib/ship/parse.ts` | Reads `SHIP.md` — works |
| `lib/ship/check.ts` | Runs the done-when checks — works, wired to the workspace |
| `lib/ship/sandbox.ts` | Confines them. macOS only, by design |

Page flow, from the sketch: `/` → `/work`, with workspace and canvas as two
views *inside* the work page rather than siblings of home. `/work` redirects to
`/work/workspace`.

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

### Three decisions blocked on you, not on work

Listed in full in `v2/task.md`; repeated here because they gate everything else.

1. ~~The work page has no way back to home.~~ **Fixed** — a `←` link in the floating switch.
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

1. **The work page was a dead end — fixed 2026-08-09.** It had exactly two
   links, `workspace` and `canvas`, and both kept you on the work page. You
   could click forever and never leave; browser-back was the only exit. A `←`
   home link now sits in the floating switch rather than in a restored app
   header, which would have cost the full-bleed surface the page is built on.
   **Found by clicking, not by reading** — every route returned 200 and every
   anchor had a correct `href`, so nothing was broken in the sense a test or a
   log would have shown. The empty canvas made it worse: switching to it moved
   the tab highlight and changed nothing else, so a navigation that had worked
   read as one that had failed. It now says `canvas — nothing here yet`.
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
4. **Tests cover the sandbox, the checker and the cache. `parse.ts` has
   none.** 32 assertions across `test/sandbox.test.ts` (20), `test/check.test.ts`
   (6) and `test/cache.test.ts` (6), run with `pnpm test` — node's own runner,
   no dependency added. Each attacks real behaviour rather than reading source,
   and they are mutation-verified: reverting the profile's carve-out turns five
   red, flipping a timeout verdict to `fail` turns one red, dropping the Xcode
   allow turns one red.
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
7. **`/work/canvas` has no specification.** It is an empty route that came from
   the sketch. `SHIP.md`, `v2/task.md` and this file all mention it only as a
   route that exists — none says what it is *for*. v0.1 had a canvas of service
   nodes, but nothing is carried forward, and an interactive node canvas would
   need client JavaScript, which this repo spends only when something earns it.
   This is a decision, not a task.

---

## Things that cost time, so they do not cost it twice

- **Stock `/usr/bin/git` on macOS is an xcrun shim, not git.** It dlopens
  `libxcrun` from `/Applications/Xcode.app/Contents/Developer`. The sandbox
  profile omitted that path, so every git check died with
  "unable to load libxcrun" — and it looked fine from a terminal, because this
  shell's PATH finds Homebrew's real git first. The dev server's PATH does not.
  Found by rendering the page and reading the evidence it printed, not by
  running the same checks from a shell where they had always worked. The
  regression test calls `/usr/bin/git` by absolute path for exactly that
  reason.
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

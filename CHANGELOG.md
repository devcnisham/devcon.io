# Changelog

Every change to `v2`, newest first. Built from `git log`, not from memory.

**Nothing here has been released.** `v2` is not deployed and has no version
number; `main` still serves v0.1 at <https://devcon-hazel.vercel.app>. There is
no `1.0.0` section below because there has been no release, and adding one
would be the kind of unearned tick this project exists to catch.

This file is append-only history. It is the one document that does *not*
restate the current state — for that, `SHIP.md` decides and `v2/overview.md`
lists.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## Unreleased

### 2026-08-11

#### Changed

- **CI actions taken the rest of the way, on request** — `actions/checkout` v5
  → **v7**, `actions/setup-node` v5 → **v7**, `pnpm/action-setup` v5 → **v6**.
  The entry below argued for stopping at v5 and the owner's call was to go to
  latest; recorded here rather than quietly rewritten, the same way `SHIP.md`
  keeps the web-app reversal visible.

  Every major between here and latest was read before the bump, and two of them
  matter to this repo:

  - **`setup-node` v6 narrowed v5's automatic caching to npm only.** v5 had
    started caching automatically for any `packageManager` field, and this
    `package.json` has one (`pnpm@10.25.0`). The previous commit kept
    `cache: pnpm` written out rather than deleting it in favour of that new
    default — **one major later the default no longer covers pnpm at all.** A
    workflow that had trusted it would have lost its pnpm cache on v6 and
    stayed green while doing it. The reasoning was a guess about release notes;
    it happened to be right, and the line stays with the evidence attached.
  - **`checkout` v6 moved persisted credentials out of `.git/config`** and into
    a file under `$RUNNER_TEMP` — **and this one went red before it went
    green.** The prediction written here first was that `$RUNNER_TEMP` sits
    outside `$GITHUB_WORKSPACE`, so a check confined to the repo cannot reach
    the token and no carve-out is needed. True, and beside the point: v6 also
    leaves an `includeIf` in `.git/config` pointing at that file, so *every*
    git invocation inside the sandbox tried to read a denied path and exited
    128 — "unable to access '…/git-credentials-<uuid>.config': Operation not
    permitted". Two tests red on the first run at v7: `git resolves and runs`
    and `the checks that should pass, do`.

    Fixed with **`persist-credentials: false`**, not with a carve-out. Allowing
    that path would hand a sandboxed check the `GITHUB_TOKEN`, which is the
    leak the profile exists to prevent — the same trade the OIDC token taught.
    Nothing in this workflow runs an authenticated git command after checkout.

    The reasoning was done by reading and the consequence was found by running,
    one run apart. **A local `~/.gitconfig` with an `includeIf` — the ordinary
    work/personal split — is the same trap against a real project, and no test
    covers it.** Task 42.

  Not applicable but read anyway: `checkout` v7 blocks fork checkouts for
  `pull_request_target` and `workflow_run`, and this workflow uses neither.
  `pnpm/action-setup` v6 adds pnpm v11 support; `version: 10.25.0` is unchanged.

- **CI actions bumped to v5** — `actions/checkout`, `actions/setup-node` and
  `pnpm/action-setup`. Not a version-chasing bump: v4 of all three declares
  `using: node20`, which GitHub has deprecated. The runner force-runs them on
  node24 today and annotates every run saying so; at some point it stops. The
  previous run was green *with* that annotation, which is the interesting part
  — a warning that costs nothing today and the whole pipeline later.

  **Read from each `action.yml` at the tag rather than from a changelog.** v4
  is `node20` and v5 is `node24` for all three, which is the fact that decides
  this. Newer majors exist — `checkout` and `setup-node` are on v7,
  `pnpm/action-setup` on v6 — and were deliberately not taken: v5 is the
  smallest change that clears the deprecation, and three simultaneous major
  bumps on a pipeline with no staging is how a green CI stops being evidence.

  One breaking change came with it, and it is live here: **`setup-node` v5
  caches automatically when `package.json` has a `packageManager` field**, and
  this one does (`pnpm@10.25.0`). `cache: pnpm` is left explicit rather than
  deleted in favour of the new default — a cache that turns itself on is a
  cache that can turn itself off in a release note nobody read.

  Verified the only way a CI change can be: pushed and watched. This repo has
  already recorded twice that a workflow's correctness is not observable from
  this laptop.

#### Added

- **`test/parse.test.ts` — 34 assertions.** `parse.ts` was the last module in
  `lib/` without a suite, and the one that had shipped the worst defect in the
  repo: `(?=^##\s|\Z)`, where `\Z` is Perl rather than JavaScript and compiled
  to "the literal letter `z`". Every section truncated at its first one —
  "frozen" became "fro" and took thirteen of fourteen done-when conditions with
  it, and it read as bad markdown rather than a bad parser.

  Covered: section boundaries (`##` ends one, `###` does not, a heading that
  merely starts the same way is a different section, headings match whatever
  their case), wrapped-line folding for reasons, conditions and assumptions,
  em/en/hyphen separators on cuts, `[x]`/`[X]`/`[ ]`, a check being lifted out
  of the prose with its shell kept verbatim — quotes and `$(…)` and all — and
  the empty cases that must not throw.

  **The fixture opens every section body with a word containing a `z`**, and a
  second block parses this repo's real `SHIP.md`, because a fixture alone would
  have been written by the same hand that wrote the parser. The real-file
  assertions are properties rather than counts, so adding a condition to
  `SHIP.md` does not turn the parser red.

  Mutation-verified four ways, all red: re-introducing the `\Z` truncation 16,
  dropping the wrapped-line fold 8, leaving the check in the prose 3,
  hardcoding `claimed` to `true` 1.

  Test count 84 → 118: `parse` 34 · `sandbox` 24 · `detect` 14 · `canvas` 12 ·
  `clone` 11 · `search` 11 · `cache` 6 · `check` 6, counted by running each
  file.

#### Found, not fixed

- **`bullets()` swallows prose written between two bullets.** It folds any
  non-bullet line into the bullet above it — which is how a wrapped reason is
  recovered, and it cannot tell that line from a new paragraph. So a paragraph
  between two cuts is appended to the first one's reason. This repo's `SHIP.md`
  puts its prose before the bullets and never trips it; that is luck, not
  design, and a cloned repo's `SHIP.md` owes it nothing. **Asserted in
  `test/parse.test.ts` rather than fixed**, so the limit is visible and a fix
  turns the test red instead of passing quietly. Task 41.
- **A `Not shipping` bullet with no `**bold**` name is dropped entirely**,
  rather than surfacing with an empty reason — a malformed cut vanishes and
  nothing tells the author. Same test file, same reason for leaving it. Neither
  is worth fixing before task 15 says the format is worth having at all.

#### Fixed

- **Ten false claims in the two documents that are supposed to be authoritative.**
  `HANDOFF.md` holds session state and `v2/task.md` holds task status, and both
  described a repo that had stopped existing the day before: CI was recorded as
  "written, never run — the first push is its first run" after six runs and a
  green badge; the canvas was "an empty route with no specification" after being
  specified and built; search was "built, then removed" while wired at
  `app/work/workspace/page.tsx:67`; and task 9 still called 0 page chunks "the
  concrete answer to v0.1's 173KB", which task 39 in the same file records as
  measured and withdrawn.

  **Four of them were test counts, and two documents contradicted themselves.**
  `HANDOFF.md` listed the correct 24·14·12·11·11·6·6 on line 95 and then
  "84 assertions across sandbox (20), check (6) and cache (6)" on line 189 —
  a sum of 32 presented as 84. `v2/overview.md` said sandbox had 20 tests on one
  line and 24 on another. `lib/canvas.ts` was credited with 13 tests and has 12;
  `lib/detect.ts` with 12 and has 14.

  This is precisely the defect the project exists to catch — v0.1's README
  claimed 209 tests while the code said 252 — committed by v2's own handoff, in
  the commit whose message was "every doc is made true again". Found by counting
  `it(`/`test(` in the files and diffing against every count claimed in the
  docs, not by rereading them. The counts are now checked that way rather than
  transcribed, and both files record the sweep instead of quietly absorbing it.

### 2026-08-10

#### Added

- **Settings became the console.** `/console`; `/settings` redirects rather
  than 404s.

- **CI is green.** Six runs to get there, and every failure was a real
  portability bug this laptop could not have produced: a hardcoded
  `/Applications/Xcode.app` path (the runner has `Xcode_26.6.app`), the xcrun
  git shim needing `xcodebuild` (refused on purpose — a build system does not
  belong in a sandbox built to confine untrusted commands), a shallow clone
  with no tags, and pnpm installed somewhere this profile had never heard of.
  The sandbox now derives its toolchain allowlist from `PATH` rather than
  naming directories, which fixes the class instead of the instances.

- **CI.** `.github/workflows/gates.yml` runs the five gates on every push and
  pull request, plus two more: the build must emit zero page chunks, and no
  `.env` or `.vercel` path may be tracked by git. **On macOS, deliberately** —
  the sandbox tests drive real seatbelt, and on Linux they would pass without
  running anything.

- **The sandbox suite refuses to report green where it cannot test.** Without
  `sandbox-exec` every attack command fails to start, produces no output, and
  every "did not leak" assertion passes vacuously. It now fails loudly with the
  reason instead.

- **The workspace checks the open project, not this repo.** The first thing in
  v2 to run `lib/ship/` against a folder someone else may have written, which
  is the entire reason the sandbox was built. Stat cards, a card per condition
  carrying its tick, verdict, command and raw evidence, and the filter back.
  Drift is computed from the whole spec, so a search can never hide a ticked
  box whose command disagrees. A project with no `SHIP.md` gets its detected
  gaps instead, the leaked `.env` first.

- **The canvas drags.** Cards built on the server from the open project's
  files — its stack, each gap, each installed integration, the shipping
  sentence — and arranged by you. Two-finger pan, shift-drag marquee select,
  dragging a selection moves all of it. Positions persist per project under
  `~/.devcon/canvas/`; positions only, so a gap you fix disappears next load
  rather than lingering because a layout file remembered it. **4.4 KB gzip**,
  measured by building with and without it. No dependency: most of React
  Flow's ~50 KB would have gone unused.

- **Settings probes this machine rather than assuming it.** Platform, node,
  the check sandbox, the Finder dialog and git are each checked when the page
  loads, and anything unavailable says why. Several of those are macOS-only,
  and listing them as working because the code exists would be a claim rather
  than a fact. The check numbers are imported from the modules that use them,
  so the page cannot drift from the behaviour it describes.

- **Integrations reports what nothing covers yet** — read from this project's
  `package.json`, not from a list of things every project ought to have. A
  capability with nothing installed says so rather than being omitted.

- **Clicking a project card opens it.** The work page names the open project.
  Active project lives in its own `~/.devcon/active.json` and is checked
  against the disk on every read, so a deleted folder reports as nothing open.

- **The dashboard reads every project it lists.** Stack from the lockfile and
  dependencies; gaps from files that are absent — no git, no `.gitignore`, no
  `SHIP.md`, no README, no tests, no CI. **A `.env` not covered by
  `.gitignore` is flagged as urgent and sorted first**, because that one is
  losing a key rather than being untidy. Derived from the repo, never a
  pre-written checklist, so it can only report what it actually looked for.
  Four stat cards and a card per project. 12 tests.

- **Search on the workspace.** Filters conditions, cuts and assumptions by
  query. Matches a condition's text, its **command** and its **evidence**, so a
  commit hash or an error string from the output finds the row that produced
  it; `fail` narrows to what is failing. Terms are ANDed.
  **No client JavaScript** — a `GET` form and `searchParams`, server-filtered,
  reusing the cached check run. A drift warning is never hidden by a filter.

- **Home page.** Reads `SHIP.md` and shows the plan's shape — the sentence,
  13 conditions, 6 ticked, 6 cut — and a way into the work page. Deliberately
  does not run the checks: parsing is microseconds, checking is seconds, and it
  says on screen that nothing there has been verified.
- **A way out of the work page.** It had exactly two links and both kept you on
  it; browser-back was the only exit. A `←` home link now sits in the floating
  switch.
- **One shared check run** (`lib/ship/cache.ts`). The workspace re-ran every
  command per request, putting a view switch at ~13s each way. Held for 15s,
  and any edit to `SHIP.md` beats the clock. The age is always printed.
- **`test/check.test.ts` and `test/cache.test.ts`** — timeouts, verdicts,
  bounded concurrency, TTL expiry. 6 assertions each.
- **The owner's workflow, hierarchy, project stages and daily checklist**, in
  `CLAUDE.md`, with a record of which steps have nothing to run against.
- **`v2/overview.md` and `v2/v2_features.md`.**

#### Removed

- **Both work-page views.** The canvas is a bare surface again — the
  `canvas — nothing here yet` label went with it, which trades away the cue
  that made switching views read as a working navigation rather than a dead
  link.
- **The workspace view.** Cleared on request — the rendered spec, its live
  verdicts and evidence, the drift banner and the filter. In git at `45ae91e`.
  `lib/ship/` is untouched and still covered by its tests; `checkedSpec`,
  `tally`, `lies` and `filterSpec` simply have no caller for now.

#### Fixed

- **The "zero client JavaScript" claim was overstated, and is now measured.**
  Every route loads 8 scripts totalling **172.5 KB gzip** of Next.js and React
  runtime before any of this repo's code — near-identical to the 173 KB v0.1
  landing page the rule exists to condemn. `0 page chunks` is true and worth
  keeping, but it counts *application* code; it was being read as an empty
  network tab. README and `CLAUDE.md` now carry the number and no longer claim
  this answers v0.1.

- **A verdict could change with machine load.** The budget was 20s and every
  check ran at once; `tsc --noEmit` takes ~1.3s idle and over 20s at a load
  average of 32, so the same repo read 5 passing conditions then 4, minutes
  apart. Now 120s and four at a time. A timeout reports `error`, never `fail`.
- **Every git check failed on any Mac without Homebrew git.** Stock
  `/usr/bin/git` is an xcrun shim that dlopens `libxcrun` from the Xcode
  toolchain, which the sandbox profile never allowed. It passed here only
  because this shell's PATH finds Homebrew's git first.
- **The work page was two trapped scroll boxes on a phone.** `h-dvh
  overflow-hidden` at every width left the conditions list with 2832px of
  content in a 374px window. Below `lg` the page scrolls as one document.
- **The floating switch scrolled away on mobile** — `absolute` where it needed
  to be `fixed`, which would have stranded you on the work page again.
- **Unticked checkboxes were read as ticked** by screen readers and text
  extraction. They rendered a `✓` hidden only by `text-transparent` — on a tool
  whose premise is that a tick is a claim.
- **Two colour systems in one app.** `spec.tsx` and `views.tsx` used raw
  Tailwind `emerald`/`rose`/`amber` while the theme defined `--color-pass`,
  `--color-fail` and `--color-cut`. Zero raw Tailwind colours remain in `app/`.
- **Four false claims in the docs** — the README said the surfaces were empty
  and that there were no tests, and two files carried a progress number that
  had been wrong for a day.

### 2026-08-09

#### Added

- **The done-when checker is sandboxed** (`lib/ship/sandbox.ts`). `SHIP.md`
  lives in the repo and the repo may not be yours; running its checks was
  running a stranger's shell with the dev server's environment. Now under macOS
  seatbelt: network denied, filesystem confined to the repo and toolchain,
  `.git`/`.env*`/`.vercel` denied, environment replaced rather than inherited.
  Off macOS every check returns `error` rather than running unconfined.
- **`test/sandbox.test.ts`** — the repo's first tests. Every assertion runs a
  real command through the real sandbox; none inspect the profile's text.
- **`/work/workspace` renders this repo's `SHIP.md`, checked.** The first thing
  in v2 that runs `lib/ship/` rather than merely containing it. The tick and the
  verdict are drawn as two separate marks, and drift gets the top of the page.
- **The work page as a surface** — full-bleed, floating view switch, layered
  gradient and dot grid, no app header.
- **The page flow** — `/` → `/work`, with workspace and canvas as two views
  inside the work page rather than siblings of home.
- **`lib/ship/parse.ts`** — reads `SHIP.md` into a spec. Plain markdown, no
  custom syntax, so the file stays useful when this tool is not installed.
- **The `SHIP.md` format**, `CLAUDE.md`, `README.md`, `HANDOFF.md` and
  `v2/task.md`.
- **`v2` started from an empty tree** as an orphan branch sharing no history
  with v0.1. The root commit touched exactly two files.

#### Security

- The first sandbox profile **leaked this repo's live Vercel OIDC token** on its
  first attack run. A wildcard `(deny file-read* …)` does not override a
  specific `(allow file-read-data …)` — in either order. Caught by attacking it,
  not by reading it, and the reason `test/sandbox.test.ts` never asserts on the
  profile's text.

---

## v0.1 — frozen, not deleted

Tagged `v0.1-archive` at `f038349`, kept on `archive/v0.1`, still deployed.
Nothing is carried forward; the archive is a record, not a parts bin.

It proved prompts work when an agent runs them — 2 of 63 cleared a two-agent
bar, checked by running the result. It did not prove the thing that matters:
**nobody has finished a project because of devcon**, v0.1 or v2.

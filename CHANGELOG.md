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

### 2026-08-10

#### Added

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

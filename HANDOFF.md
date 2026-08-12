# devcon v2 — handoff

> Read `CLAUDE.md` first, then this, then `v2/task.md`. Started 2026-08-08 when
> v0.1 was frozen; rewritten 2026-08-10 at the end of the session that built
> the five surfaces, the canvas, and CI. Swept 2026-08-11 — that rewrite left
> six claims behind that the same session had already made false, including a
> test count this file contradicted two hundred lines further down. Recorded
> here rather than quietly fixed, because it is the failure this tool exists to
> catch, committed by the tool's own handoff.
>
> **Updated 2026-08-12**, at the end of the session that built phase 0 features
> 001–003 — accounts, profile, workspaces — on request, feature by feature.
> That session also changed the shape of the product: devcon now has users.

**Branch: `v2`** (orphan — no v0.1 history). Everything committed and pushed;
working tree clean.

**Gates: lint 0, tsc 0, test 0 (174 tests), build 0, 0 page chunks.**
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

**The owner is building the 329-feature plan in order, one feature per
instruction.** Phase 0 items 001–003 are done. **004 — project creation — is
next**, and 004/005 will largely *replace* the folder-import dashboard, which
was the prototype of a project list from before workspaces existed. Expect to
delete some of it rather than add beside it.

| Phase 0 | State |
|---|---|
| 001 Authentication | done — `/signup`, `/login`, sign out, landing page |
| 002 User profile | done — `/profile`, display name, password change |
| 003 Workspace | done — `/settings`, owns projects, rename/switch/create |
| 004 Project creation | **next** |
| 005 Project list · 006 Project settings · 007 Basic dashboard | not started |

**The plan itself was deleted from the tree on 2026-08-12**, along with the
tracker built from it. It is still in history and every live reference cites it
that way: `git show d84925e:v2/feature-phase.md`.

**Five things are true and worth knowing before touching anything:**

1. **The app works end to end for one story.** Open a folder (real Finder
   dialog) or clone a repo → it appears as a card with its stack and its gaps →
   click it → the work page checks *that project's* `SHIP.md` in the sandbox,
   or shows its gaps if it has none → the canvas shows the same facts as cards
   you can drag.
2. **devcon has accounts now, and everything is per-account.** A workspace owns
   projects; projects are scoped to the active workspace. All local, under
   `~/.devcon`, nothing sent anywhere.
3. **`SHIP.md` still cuts a web app and accounts**, and both are being built
   anyway. Each entry is kept rather than deleted so the reversal stays visible.
   Only the *accounts* half is reversed — backend and sync are genuinely cut.
4. **The store layout changed and there was a migration.** See below; it ran on
   the real machine and the original is still on disk.
5. **Nobody has finished a project because of devcon.** Three features and an
   account system have not touched that, and none of 004–007 will either.

**The move that would actually test the bet is still not code.** `v2/task.md`
15 and 16: hand-write a `SHIP.md` for two projects that are not this one, and
name one decision each changed. Phase 0 is building the platform around a
format nobody has yet used on a second project. That is the owner's call and it
has been made twice — but it should be made knowingly, not by drift.

**Cheap and open, if you want code instead:** there are still no end-to-end
tests — the one item on the owner's own daily checklist with nothing behind it —
and `SHIP.md`'s check #7 fails by construction, running `pnpm test` *inside* the
sandbox where the suite cannot create the bait file it attacks with.

---

---

## What v2 is

A shipping critic that runs inside your coding agent, keeps one `SHIP.md` in
your repo, reads what you actually built, and tells you what to cut.

Four things decided in the 2026-08-08 session, all of them the owner's calls:

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
| `app/page.tsx`, `open.tsx`, `cards.tsx` | Dashboard — Finder dialog, clone, stats, a card per project. **Landing page when signed out.** |
| `app/login/`, `app/signup/`, `auth-actions.ts` | Sign in, sign up, sign out — feature 001 |
| `app/profile/` | Your account — name, password change — feature 002 |
| `app/settings/`, `lib/workspace.ts` | Workspaces — rename, switch, create — feature 003 |
| `lib/projects.ts` | The project list, scoped to a workspace. Was `lib/workspaces.ts`. |
| `lib/auth/` | password · session · users · validate |
| `app/connectors/` | Integrations — coverage, what nothing covers yet, MCP badges |
| `app/console/` | What devcon is doing and what this machine can do, probed |
| `app/work/workspace/` | The open project's `SHIP.md`, checked in the sandbox |
| `app/work/canvas/` | The same project as draggable cards |
| `lib/ship/` | parse · check · sandbox · cache · search |
| `lib/detect.ts` | A project's stack and gaps, read from its files |
| `lib/clone.ts`, `pick-folder.ts` | Clone by URL, real Finder dialog |
| `lib/canvas.ts` | Card positions, per project |
| `lib/diagnostics.ts` | Host probes for the console |
| `.github/workflows/gates.yml` | Seven gates on every push. Green. |

**174 tests.** `auth` 37 · `parse` 34 · `sandbox` 32 · `workspace` 11 · `detect` 14 · `canvas` 12 ·
`clone` 11 · `search` 11 · `cache` 6 · `check` 6. Counted by running each file,
not by remembering. Every module in `lib/` now has a suite.

Everything devcon stores lives under `~/.devcon/`. **Never inside a tracked
repo**, where it would land in someone's diff and their submission.

| File | What | Mode |
|---|---|---|
| `users.json` | Accounts. scrypt hashes, never a password | 0600 |
| `session.key` | The token signing key, made on first use | 0600 |
| `workspaces.json` | Workspaces, owned by an account | |
| `active-workspace.json` | Which workspace each account is in | |
| `projects.json` | The project list, each row stamped with its workspace | |
| `active.json` | Which project the work page is showing | |
| `canvas/` | Card positions, per project | |
| `workspaces.json.legacy` | The pre-feature-003 project list, retired not deleted | |

**That last row is a migration that already ran on this machine.**
`workspaces.json` used to hold *folders*; feature 003 needed the name for the
thing that actually is a workspace, so the contents were moved to
`projects.json` and the original renamed rather than removed. Projects written
before 003 have no `workspaceId` and are adopted by the first workspace that
asks. Four tests cover it, and it was checked against the real store: nothing
was lost. **Delete `workspaces.json.legacy` only when you are sure**, and note
that `lib/workspaces.ts` is now `lib/projects.ts` with its type renamed to
`Project` — the UI had called them projects all along.

### Waiting on you

`v2/product.md` and `v2/project.md` exist with only a heading each. You said you
would specify what goes in them; nothing was invented. `v2/task.md` is written —
52 tasks with real status.

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

### What features 001–003 left open, deliberately

Every one of these is stated on the page or in the code rather than left to be
discovered. None is a bug; all are things devcon cannot do yet and says so.

| Open | Why | Task |
|---|---|---|
| No password reset | devcon cannot send mail. A reset link that never arrives is worse than no button | 45 |
| No email confirmation | Same. Signup trusts the address typed | 46 |
| Cannot change your email | It is the identity of the row and needs a confirmation to the new address | 48 |
| Cookie is not `secure` | devcon serves http on localhost, and a secure cookie is never sent over http. **Must flip with the first https deploy** | 44 |
| Signing out does not revoke | It clears the cookie. A copy taken beforehand lives until it expires — *changing your password does* revoke, which is the case that matters | — |
| Workspaces are not shareable | No invites, roles or permissions, and no server. Phase 26 | — |

Two more worth carrying forward: **the token format changed** on 2026-08-12
(`id.expires.sig` → `id.issued.expires.sig`) so anyone signed in before it had
to sign in once more, and **`sessionIsCurrent` lives in `lib/auth/session.ts`
rather than inline in `currentUser`** because `currentUser` imports
`next/headers` and `pnpm test` cannot reach it — inline, the revocation check
would have been deletable with the whole suite still green.

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
run on every push and are green, and every module in `lib/` has a suite.
**Nothing drives the app as a user.** That was supposed to go in before the next
feature and did not — three features shipped past it on 2026-08-12, each
verified by driving the running app by hand instead. Hand-driving found real
defects every time and is not a substitute: none of it runs in CI, so none of it
protects the next change. v0.1 proved both that the discipline works and that
adding it late is how it gets skipped.

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
   rather than inherited, and **git pointed at the repo's own config and no
   other** — see the gotcha below. **Thirty-two assertions run against it, every
   attack blocked** — including reading this repo's live OIDC token, which the
   first version of the profile handed straight back.
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
4. **Tests cover every module in `lib/`.** 174 assertions — `auth` 37 · `parse` 34 · `sandbox` 32 · `workspace` 11 ·
   · `detect` 14 · `canvas` 12 · `clone` 11 · `search` 11 ·
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
- **A git config include can point outside the repo, and then no git check
  runs.** `actions/checkout` v6+ moved the persisted token from `.git/config`
  to a file under `$RUNNER_TEMP` and left an `includeIf` behind pointing at it.
  The token became unreachable from a sandboxed check — the good half — and
  *every* git invocation started exiting 128 with "unable to access
  '…/git-credentials-<uuid>.config': Operation not permitted", because the
  profile denies everything outside the repo. Two tests red on the first run at
  v7, and the message names a path rather than a repo, so it reads like
  infrastructure rather than a config include. Predicted safe by reasoning about
  `$RUNNER_TEMP` being outside the workspace, which was true and beside the
  point; CI found the actual consequence in one run.
  **CI fixed with `persist-credentials: false`; the product fixed in
  `sandboxEnv()`** — `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL=/dev/null`,
  because an ordinary `~/.gitconfig` with an `includeIf` does the same thing to
  a real project. **Never a carve-out for the path** — an include may name any
  path, so there is nothing finite to allow, and allowing that one hands a
  sandboxed check the `GITHUB_TOKEN`. A git check now depends on the repo alone
  and means the same thing on two machines. Task 42, closed with six tests that
  failed first.
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

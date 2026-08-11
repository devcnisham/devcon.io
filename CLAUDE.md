# CLAUDE.md — devcon v2

Read this, then `HANDOFF.md`, then `v2/task.md`.

## What this is

A shipping critic that runs inside your coding agent, keeps one `SHIP.md` in
your repo, reads what you actually built, and tells you what to cut.

Branch `v2` is an **orphan** — it shares no history with v0.1. That is
deliberate.

## How a feature gets built

The owner's workflow. Follow it in order for every feature.

```
idea → research → requirements → ui wireframe → ui design → database design
→ api design → frontend development → backend development → integration
→ testing → bug fixes → refactoring → code review → git commit
→ push to github → CI pipeline → deploy to staging → QA testing
→ deploy to production → monitor logs → collect feedback → improve
```

**Say which steps you skipped and why. Never run a step in name only.** A step
reported as done that produced nothing is the same defect this whole tool
exists to catch — a ticked box with no exit code behind it.

As of 2026-08-10, ten of those twenty-three steps have nothing to run against,
and pretending otherwise would be theatre:

| Step | State |
|---|---|
| database design | No database. v2 reads one local markdown file. |
| api design | No API. Every route is a server component. |
| CI pipeline | **Exists and is green** — `.github/workflows/gates.yml`, macOS. |
| deploy to staging | No staging environment. |
| QA testing | No environment to test in beyond localhost. |
| deploy to production | **`v2` is not deployed.** `main` still serves v0.1. |
| monitor logs | Nothing deployed, so no logs. |
| collect feedback | **No users.** Nobody has used devcon. |

The last one is the project's central gap, not a missing tool. Building CI or
staging does not close it.

Steps that are real today and must actually happen: research, requirements,
ui design, frontend development, integration, **testing**, bug fixes,
refactoring, code review, git commit, push, **CI pipeline**.

### Hierarchy

| Area | Covers |
|---|---|
| **Product** | product management · project management · design · architecture |
| **Engineering** | development · database · integrations · testing · debugging · code quality · security · performance |
| **Operations** | git · devops · deployment · monitoring · analytics · backup · automation |
| **Main** | documentation · marketing · customer support · billing · release management · legal · maintenance |

### Project stages

planning · architecture · design · development · testing · security ·
optimization · documentation · deployment · monitoring · maintenance ·
iteration

## Daily checklist

The owner's nine groups. Same rule as above — **name what you skipped.**

| Group | Items |
|---|---|
| **Planning** | review backlog · select today's tasks · estimate time · update kanban board |
| **Development** | frontend · backend · database changes · api implementation · authentication · file storage · payments · notifications · background jobs |
| **Debugging** | reported bugs · console errors · api issues · ui issues · responsive layout · performance bottlenecks |
| **Code quality** | refactor · remove duplication · rename variables · folder structure · comments where needed · improve architecture |
| **Testing** | unit · integration · end-to-end · manual · edge case · **mobile** · desktop |
| **Git** | commit · push · meaningful messages · tag releases when needed |
| **Deployment** | build production · run CI · deploy · verify · check logs · roll back if needed |
| **Monitoring** | server logs · analytics · uptime · errors · database |
| **Documentation** | README · api docs · changelog · feature list |

### What this repo can actually tick, 2026-08-09

Most of Development, all of Deployment and all of Monitoring have nothing
behind them: no backend, no database, no API, no auth, no file storage, no
payments, no notifications, no background jobs, nothing deployed, no logs, no
analytics. Do not tick them. **CI is real now** and runs on every push.

Three gaps in this list are real, cheap and currently open:

- ~~Mobile testing has never been run.~~ Run 2026-08-09 on its first use of
  this checklist, and it found a real defect immediately — see the gotcha
  below. Still never verified below 408px: the preview pane will not go
  narrower, so a true 375px phone is untested.
- ~~No changelog.~~ `CHANGELOG.md`, built from `git log`. The one document that does not restate current state, so it does not worsen task 20.
- **No end-to-end tests.** Unit and integration exist; nothing drives the app
  as a user.

`v2/task.md` is the backlog. There is no kanban board and no time estimates,
and inventing either would be process theatre.

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

Tests cover `lib/ship/`, the workspace store, the detector and the canvas
layout. **`parse.ts` has none** — still an open task.

CI runs the five gates plus two more on every push:
`.github/workflows/gates.yml`. **It runs on macOS and that is not a
preference** — `test/sandbox.test.ts` drives the real seatbelt sandbox, and on
Linux every attack command fails to start, produces no output, and every "did
not leak" assertion passes because nothing ran. The suite now refuses to run
without a sandbox rather than report green, so a Linux runner would be red
instead of misleading.

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
  component; the build emits 0 page chunks. If a `"use client"` goes in, say
  what it bought **and measure it** — build with and without, diff the gzipped
  chunks. `app/work/canvas/board.tsx` is the only one, and it cost 4.4 KB.
  **Do not repeat the claim that this answers v0.1's 173 KB.** Measured on
  2026-08-10 against a production build: every route already loads 172.5 KB
  gzip of framework runtime before any of this repo's code. 0 page chunks
  measures application code, which is real and worth keeping — it is not an
  empty network tab, and saying so was the same unchecked claim this tool
  exists to catch.
- **State what isn't done.** Do not tick a box you have not run — the checker
  in `lib/ship/` caught its own author doing exactly that on its first run.
- **Update the docs in the same commit, not after.** `HANDOFF.md`,
  `v2/task.md`, `v2/overview.md`, `v2/v2_features.md`, `README.md` and
  `CHANGELOG.md` are part of the change, not a follow-up. A claim goes stale
  the moment the code moves, and this repo has already shipped a README that
  called the surfaces empty after the workspace was built. Before committing,
  grep the docs for what the change just made false.
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
- **`h-dvh overflow-hidden` is a desktop-only idea.** The work page locked
  itself to the viewport at every width, so on a phone the grid split into two
  independent scroll boxes: the rail took half the screen and the conditions
  list had 2832px of content trapped in the other 374px. Below `lg` the page
  must scroll as one document. Found by measuring `scrollHeight` against
  `clientHeight` per element, not by looking — the screenshot alone read as
  merely cramped.
- **A pinned control must be `fixed`, not `absolute`, once the page can
  scroll.** The floating switch is the only navigation on the work page,
  including the way home. Absolute meant it scrolled off the top of a phone and
  stranded you exactly as before.
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
  `check.ts` allowed a check 20s and ran every check at once. `pnpm exec tsc
  --noEmit` takes ~1.3s on an idle machine and over 20s at a load average of 32
  — so the same repo reported 5 passing conditions and then 4, minutes apart,
  and the only variable was two VS Code helpers at 370% CPU. **A timeout is not
  an exit code.** Fixed: 120s, four at a time, and a timeout reports `error`
  with an explanation rather than `fail`. **Before blaming the sandbox for
  slowness, time the command unsandboxed and check `uptime`** — four hypotheses
  died that way here, and `uptime` would have killed all four in one step.
- **Stock `/usr/bin/git` on macOS is an xcrun shim, not git.** It dlopens
  `libxcrun` from `/Applications/Xcode.app/Contents/Developer`, so a sandbox
  profile that omits that path fails *every* git check with
  "unable to load libxcrun" — which reads as a broken repo. It passed here for
  weeks only because this shell's PATH finds Homebrew's real git first; the dev
  server's PATH does not, and neither does a normal Mac's. **Test toolchain
  binaries by absolute path, not by name** — `git` and `/usr/bin/git` are two
  different programs.
- **The sandbox does not admit `xcodebuild`, so the Xcode git shim cannot run
  in it.** `/usr/bin/git` resolves the real binary by running `xcode-select`
  and then `xcodebuild`; letting a build system into a profile built to confine
  untrusted commands would be a real weakening for a marginal gain. Checks call
  `git` from PATH, so any machine with a real git — Homebrew, nix, asdf — is
  fine. A machine whose only git is the shim cannot run git checks, and the
  tests assert that contract rather than wishing otherwise.
- **CI needs `fetch-depth: 0`.** `SHIP.md` asserts permanent properties of this
  repo's history — that `v0.1-archive` exists, that the root commit touched two
  files — and `actions/checkout` clones shallow without tags, so those
  conditions fail for a reason that is about CI rather than about the repo.
- **Never allow a PATH entry's parent directory.** The sandbox derives its
  toolchain allowlist from PATH so nvm, asdf, volta and a CI runner's pnpm all
  work without being named. Adding each entry's `dirname` looked like a
  harmless way to reach symlink targets and granted the **filesystem root**,
  because PATH contains `/bin`. The attack tests caught it immediately, and
  `test/sandbox.test.ts` now asserts the invariant directly rather than relying
  on a bait file happening to exist.
- **Do not hardcode the Xcode path — ask `xcode-select -p`.** The fix for the
  xcrun trap above allowed `/Applications/Xcode.app/Contents/Developer`, which
  is correct on this laptop and wrong on a CI runner, where Xcode installs as
  `Xcode_26.6.app`. Every git check failed there with the same
  "unable to load libxcrun" message. **The first CI run caught it; no amount of
  local testing could have.** The profile now takes the developer dir as a
  parameter, probed once.
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
| `CHANGELOG.md` | Every change, newest first | Append-only history |
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

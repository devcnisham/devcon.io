# Task

Every task for v2 and where it stands. Updated 2026-08-11.

**Progress: 5 of 13 done-when conditions in `SHIP.md`.** The only progress
number that means anything here — checked by running commands, not by ticking
boxes. It was unstable earlier on 2026-08-09, reading 4 or 5 depending on
machine load; task 28 fixed that, and it now reads the same three runs running
at the load that used to break it.

Status keys: **done** · **doing** · **next** · **blocked** (waiting on a
decision) · **later**

---

## Foundation

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Freeze v0.1 — tag, branch, `ARCHIVE.md` | **done** | `v0.1-archive` at `f038349`, 123 files, on the remote. Still deployed. |
| 2 | Start `v2` from an empty tree | **done** | Orphan branch, root commit touched exactly 2 files. |
| 3 | `.gitignore` before anything can be staged | **done** | `.env.local` here holds a live Vercel OIDC token. Verified 0 secrets in any commit on any branch. |
| 4 | Scaffold — Next 16, Tailwind v4, biome | **done** | Chosen fresh, not inherited. Nothing copied from v0.1. |

## Surfaces

| # | Task | Status | Notes |
|---|---|---|---|
| 5 | Home page | **done** | `app/page.tsx` reads `SHIP.md` and shows the plan's shape — name, sentence, conditions, ticked, cut — and a way into the work page. Deliberately does **not** run the checks: parsing is microseconds, checking is seconds, and a landing page that takes 13s to say hello is broken. It says on screen that nothing there has been verified. |
| 6 | Work page, full-bleed | **done** | Three washes over lifted navy + dot grid. Matches the reference. |
| 7 | Workspace + canvas as views inside work | **done** | `/work` → `/work/workspace`. Real routes, not a client toggle. |
| 8 | Floating segmented switch | **done** | Lives in each view — a layout cannot see which child renders without a client hook. |
| 9 | Zero client JS on every route | **done** | 0 page chunks — application code only. **Not the answer to v0.1's 173 KB**; see task 39 for the measurement that killed that claim. The canvas is the one exception, at 4.4 KB. |
| 10 | A way back from the work page | **done** | Found by clicking rather than reading: the work page had exactly two links and both kept you on it, so you could click forever and never leave. A `←` home link now sits in the floating switch — not a restored header, which would cost the full-bleed surface. |
| 11 | Decide the 14rem workspace rail | **blocked** | A permanent commitment with nothing in it. Cheap now, expensive later. |

## The spec format

| # | Task | Status | Notes |
|---|---|---|---|
| 12 | `SHIP.md` format — ships / not shipping / done-when | **done** | 8 cuts and 13 conditions recorded. |
| 13 | Parser (`lib/ship/parse.ts`) | **done** | Works. Read by the dashboard. **34 tests as of 2026-08-11**, including a regression test for the `\Z` truncation that once ate thirteen of fourteen conditions. Two defects it surfaced are asserted rather than fixed — see task 41. |
| 14 | Done-when checker (`lib/ship/check.ts`) | **done** | Works, sandboxed, and running the **open project's** checks at `/work/workspace`. Caught its author overclaiming on the first run, and again on the first render. |
| 43 | Feature 001 — authentication, and a landing page | **done** | Phase 0 item 1 of `v2/feature-phase.md`, on request. `/signup`, `/login`, sign out, and `/` as a landing page when signed out. scrypt from `node:crypto` — no dependency, no native build — with N/r/p written into every hash so the cost can be raised later without invalidating existing passwords. Session is a signed httpOnly cookie; the key is generated on first use at `~/.devcon/session.key`, 0600, **never in the repo and never in an env var**. Accounts at `~/.devcon/users.json`, also 0600. **Reverses `SHIP.md`'s "Accounts, backend, sync" cut** — accounts only; the entry is kept and annotated rather than deleted, like the web app. 27 tests. Verified by driving it: signup → dashboard, sign out → landing, wrong password → error with the email preserved, right password → dashboard, and `document.cookie` empty in the browser, which is what proves httpOnly rather than asserting the config. Two deliberate holes, both stated on the page or in the code: **sign-out does not revoke** a copied token before it expires, and `secure` is off because devcon serves http on localhost — tasks 44–46. |
| 50 | Feature 003 — workspace, and a real settings page | **done** | Phase 0 item 3, on request, with the settings page asked for alongside it. A workspace owns projects and belongs to an account; everyone gets one named Personal on first use, so there is no "create your first workspace" step between signing up and using the thing. Several are allowed — separating work from side projects is the first thing anyone asks for, and retrofitting one-to-many later means migrating everyone. **Not sharing:** no invites, roles or permissions, and no server to share through. That is phase 26. `/settings` stopped being a redirect to `/console` and became what you have set, against the console's what devcon is doing. **The name had to be taken back first** — see task 51. 11 tests, and driven: rename collapsed "  Side   projects  " to "Side projects" and the rail followed, create switched to the new one, the switcher marked and disabled the current. A second account saw 0 projects while the first still saw its own, which is the scoping working. |
| 51 | `Workspace` meant two things | **done** | `lib/workspaces.ts` used "workspace" for "a folder you opened", while every surface in `app/` already called those **projects** — `ProjectCard`, `detectProject`, the "projects" stat. Only the storage module disagreed, so it was renamed to `lib/projects.ts` and the type to `Project` rather than inventing a second word for feature 003. 10 files, mechanical, caught by tsc. |
| 52 | Migrating `workspaces.json` | **done** | The filename was already taken on the one machine that has ever run devcon, and it held a real project list. The legacy contents are **moved** to `projects.json`, never overwritten, and the original is retired as `workspaces.json.legacy` rather than deleted. Refuses to run if `projects.json` already exists — a migration that deletes what it was meant to preserve is worse than one that does not run. Rows from before feature 003 have no `workspaceId` and are **adopted** by the first workspace that asks, because a project list that empties itself the day a new concept ships is the worst possible introduction to it. 4 of the 11 tests are this, and it was verified against the real store: `devcon-io` survived with its workspace stamped. |
| 47 | Feature 002 — user profile | **done** | Phase 0 item 2, on request. `/profile`: your email and when the account was created, an optional display name, and a password change. Two forms, two server actions, no client JavaScript. **The name has no character rules beyond the undisplayable** — name validation is how software tells people their own name is wrong, and `Seán`, `Иван`, `山田太郎`, `O'Neill` and mononyms are all tested as accepted; only C0/C1 controls and bidi overrides are refused, the last because they make the stored name and the rendered name disagree. **Changing a password ends every other session**: the token now carries `issuedAt`, the row carries `sessionsValidFrom`, and `currentUser` refuses anything older. The session doing the changing is reissued so it survives. 37 tests (was 27); mutation-verified — always-true `sessionIsCurrent` turns 2 red, not writing the cutoff turns 1, dropping the current-password check turns 2. **Verified against the running server, not just asserted:** a validly signed, unexpired token minted before the change got 307 to `/login` and one minted after got 200. |
| 48 | Changing your email | **open** | Not offered. It changes the identity of the row and needs a confirmation sent to the new address; devcon cannot send mail, so the choices were an unverified change or a field that lies. Neither shipped. Same blocker as 45 and 46. |
| 49 | The token format changed, so feature 001 sessions ended | **done, one-off** | Tokens went from `id.expires.sig` to `id.issued.expires.sig` because revocation needs to know when a token was minted. Anyone signed in before this had to sign in once more. A compatibility shim for three-part tokens was considered and dropped: it would have been permanent complexity to spare a single re-login on a tool with one account, one day old. |
| 44 | Session cookie is not `secure` | **open** | Correct today and wrong the moment this is served over https: a `secure` cookie is never sent over http, so turning it on now would silently break every session on localhost, the only host devcon serves. Must flip with the first https deploy, which is task 27. |
| 45 | No password reset | **open** | Needs to send mail and devcon cannot. A reset link that never arrives is worse than an absent button, so there is no button. |
| 46 | No email confirmation | **open** | Same reason as 45. Signup trusts the address typed, which is honest for a local single-user tool and is not for a hosted one. |
| 15 | Hand-write specs for 2+ other real projects | **next** | The cheapest test of whether the bet holds. No code needed. |
| 16 | Name one decision each of them changed | **next** | If none, the format is not useful and tooling will not save it. |

## Known problems

| # | Task | Status | Notes |
|---|---|---|---|
| 17 | Checker executes arbitrary shell from markdown | **done, macOS only** | Confined by seatbelt (`lib/ship/sandbox.ts`): no network, no filesystem outside the repo and toolchain, no `.git`/`.env*`/`.vercel`, empty environment. Every attack verified by running it — see task 21 for the current count. Residual: a check can still destroy the repo's uncommitted working tree — writes cannot be denied, `tsc` is `incremental`. Non-macOS refuses to run rather than running unconfined. |
| 18 | A check can sabotage the process running it | **done** | `pnpm build` fought the dev server over `.next`. Now `tsc --noEmit`. |
| 19 | A check can expire | **done** | Commit-count check went stale in four commits. Now asserts a permanent property of history. |
| 20 | `SHIP.md` vs `v2/` docs overlap | **blocked, worse** | Six documents describe v2's state — `SHIP.md`, this file, `HANDOFF.md`, `README.md`, `v2/overview.md`, `v2/v2_features.md` — and the last three only restate the first three. Each is marked derivative, which is a convention, not a mechanism. It already failed once inside a single session: `README.md` called the surfaces empty after the workspace shipped, and two files carried a stale progress number. Fold them back, or generate them from the checker. **Needs your call.** |
| 28 | A verdict changes with machine load | **done** | Two causes, both fixed: the 20s budget became 120s, and `checkAll` stopped running every check at once — it now runs four, because unbounded concurrency manufactured the load that tripped the ceiling. Timeout and concurrency are parameters so `test/check.test.ts` can drive them; a timeout still reports `error`, never `fail`, and now says so in its evidence. Verified: 5/2/6 with zero errors on three consecutive runs at load average 24, which previously produced 4 passes and 2 errors. |
| 31 | Search the workspace | **done, restored** | Shipped at `45ae91e`, removed when the workspace was cleared on request, and back when it was rebuilt — wired at `app/work/workspace/page.tsx:67`. A `GET` form and `searchParams`, server-filtered, no client JavaScript. Matches a condition's text, its command **and its evidence**, so an error string from the output finds the row that produced it. Terms are ANDed. The drift banner is computed from the full set, so a filter can never hide a ticked box whose check disagrees. 11 tests. |
| 34 | Open a project from its card | **done** | Clicking a card sets it active and goes to the work page, which names it on the switch. Active project is a separate `~/.devcon/active.json`, checked against the disk every read — a remembered folder that has been deleted reports as nothing open. Forgetting a project clears it. Card body and Forget are sibling forms, never nested: nested forms are invalid HTML and the inner one is dropped, which would make Forget open the project. |
| 40 | Workspace rebuilt, against the open project | **done** | The first thing in v2 that runs `lib/ship/` against a repo that is **not this one** — which is why the sandbox exists. Stat cards, condition cards with tick, verdict, command and evidence, drift from the full set so a filter can never hide it, filter restored, cuts and assumptions. A project with no `SHIP.md` gets its detected gaps instead, urgent first. |
| 38 | Canvas — drag, pan, selection | **done** | Cards built on the server from the open project's files; `app/work/canvas/board.tsx` only moves them. Drag, two-finger pan (wheel), shift-drag marquee, multi-select drag. Positions persist per project under `~/.devcon/canvas/`, keyed by a hash of the path so a project path cannot escape the store. Positions only — a fixed gap disappears next load rather than lingering. 12 tests. Not built: zoom, undo, edges, snapping. |
| 39 | The zero-JS claim was overstated | **fixed** | Measured against a production build: every route loads 172.5 KB gzip of framework runtime, near-identical to v0.1's 173 KB that the rule condemns. 0 page chunks is real but measures application code only. README and CLAUDE.md now state the number; the comparison to v0.1 is removed. The canvas itself cost 4.4 KB, measured by building with and without it. |
| 36 | Console page with cards | **done** | Renamed from Settings on request; `/settings` redirects rather than 404s. Stat cards, host probes and grouped rows. Every capability is **probed**, not assumed — platform, node, sandbox, Finder dialog, git — because several features are macOS-only and listing them as working because the code exists would be a claim. Check numbers imported from the modules that use them, so the page cannot drift. No profile: there are no accounts. |
| 37 | biome `recommended` deprecation | **done** | `rules.recommended` → `rules.preset`, deprecated in 2.5.7 and gone next major. Changed by hand, not by `biome migrate`, which rewrites the file and drops the comments recording two defects. Verified the linter still bites: a deliberate `==` was caught. |
| 35 | Integrations page with cards | **done** | Capability coverage read from `package.json` — what nothing covers yet, in this project, rather than a list of things every project ought to have. Stat cards, letter tiles, MCP badges, Docs beside Connect. |
| 33 | Dashboard with cards | **done** | Four stat cards and a card per project. `lib/detect.ts` reads stack and gaps from the files — including a `.env` not covered by `.gitignore`, flagged urgent and sorted first. Derived from the repo, not a step catalog. 14 tests. |
| 32 | Workspace cleared | **done** | Emptied on request. `lib/ship/` untouched and still covered — `checkedSpec`, `tally`, `lies` and `filterSpec` currently have no caller. Waiting, not dead. |
| 30 | Mobile layout | **done** | The work page was two trapped scroll boxes on a phone. Fixed and measured at 408px. **Never verified below 408px** — the preview pane will not go narrower. |
| 29 | `/work/canvas` has no specification | **done** | Specified on request as a Figma-like surface: drag, two-finger pan, shift-drag select. Built. Cost 4.4 KB gzip of client JS, measured. |
| 42 | A git config include outside the repo kills every git check | **done** | Found by CI on 2026-08-11 bumping `actions/checkout` to v7: v6+ persists the token to `$RUNNER_TEMP` and leaves an `includeIf` in `.git/config` pointing at it, the sandbox denies everything outside the repo, and *every* git invocation exited 128 with "unable to access …: Operation not permitted" — which reads as a broken repo. CI got `persist-credentials: false`; the product hole stayed open, because an ordinary `~/.gitconfig` with an `includeIf` does the same to a real project. **Fixed in `sandboxEnv()`:** `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL=/dev/null`, so a git check reads the repo's own config and nothing else and means the same thing on two machines. The profile was **not** widened — an include may name any path, so there is nothing finite to allow, and CI proved what sits on the other end of one. The named cost was covered too: dropping the global config drops any `safe.directory` the user set there, so the repo under check is injected back via `GIT_CONFIG_COUNT`/`KEY_0`/`VALUE_0`. **Test written first and failed first**, against a scratch repo with a bait include the profile denies — 6 new assertions in `test/sandbox.test.ts` (24 → 30), including one that proves the bait is genuinely unreadable, because this file has twice passed against bait that was not. Mutation-verified: removing `GIT_CONFIG_GLOBAL` turns 6 red, disabling the `safe.directory` injection turns 2, removing `GIT_CONFIG_NOSYSTEM` turns 3. **`GIT_CONFIG_NOSYSTEM` was untested for a day** — proving it looked like it needed `/etc/gitconfig` and therefore root — until `GIT_CONFIG_SYSTEM` turned out to move the system config to a path of the test's choosing. It now has a test **and a control run** that reads the bait with the suppression off, because an assertion that the value is absent proves nothing if git never looked. The two `$HOME` git-config allows the fix made dead are gone from the profile, retested by deleting them and running the suite rather than by rereading the comment that justified them; a check can no longer read `~/.gitconfig` at all, and that is asserted rather than assumed. 8 tests across three describes. |
| 41 | `bullets()` swallows prose written between two bullets | **open, asserted** | Found by writing task 13's tests, not by reading. `bullets()` folds any non-bullet line into the bullet above it, because that is how a wrapped line is recovered — so a paragraph *between* two bullets is appended to the one above as if it were part of its reason. This repo's `SHIP.md` puts its prose before the bullets and never trips it, which is luck rather than design; a cloned repo's need not. Asserted in `test/parse.test.ts` rather than fixed, so the limit is visible and a fix turns the test red instead of passing silently. Smaller sibling, same test file: a `Not shipping` bullet with no `**bold**` name is dropped entirely rather than surfacing with an empty reason, so a malformed cut vanishes and nothing tells the author. **Neither is worth fixing before task 15 says the format is worth having.** |

## Not started

| # | Task | Status | Notes |
|---|---|---|---|
| 21 | Tests — any at all | **started** | **174 assertions**, counted by running each file: `auth` 37 · `parse` 34 · `sandbox` 32 · `workspace` 11 · `detect` 14 · `canvas` 12 · `clone` 11 · `search` 11 · `cache` 6 · `check` 6. `pnpm test`, node's runner, no dependency added. Mutation-verified: reverting the profile's carve-out turns 5 red, flipping a timeout to `fail` turns 1 red, dropping the Xcode allow turns 1 red, re-introducing the `\Z` truncation turns 16 red. **Every module in `lib/` now has a suite.** Still **started**, not **done** — nothing drives the app as a user. |
| 22 | CI gates | **done, green** | `.github/workflows/gates.yml` — the five gates plus a zero-page-chunk check and a tracked-secret scan, on every push and PR. **macOS runner, not a preference:** on Linux `sandbox-exec` is missing, every attack command fails to start, and every "did not leak" assertion passes because nothing ran. **Six runs to go green, and every failure was a real portability bug this laptop could not have produced** — a hardcoded `/Applications/Xcode.app` (the runner has `Xcode_26.6.app`), the xcrun shim then wanting `xcodebuild` (refused on purpose), a shallow clone with no tags, and pnpm installed somewhere the profile had never heard of. The sandbox now derives its toolchain allowlist from `PATH` rather than naming directories, which fixes the class instead of the instances. That is the entire argument for having CI. |
| 23 | MCP server + repo reader | **later** | Blocked behind 15/16 — do not build tooling for a format that has not proved useful. |
| 24 | Critique pass | **later** | The actual product. Everything before it is plumbing. |
| 25 | Cut rules | **later** | Written fresh, not ported from v0.1's 21 anti-steps. |
| 26 | `v2/product.md`, `v2/project.md` | **blocked** | Awaiting your content. |
| 27 | Deploy v2 | **later** | `main` still serves v0.1. Do not replace what is live until v2 is better. |

---

## The order that matters

15 and 16 come before 23, 24 and 25. Hand-write the specs before building
anything to manage them — if a hand-written `SHIP.md` does not change a real
decision on a real project, the tooling will not rescue it, and finding that
out costs an afternoon now versus months later.

**22 has landed and 21 is still partial.** CI runs seven gates on every push and
is green, and as of 2026-08-11 every module in `lib/` has a suite — but nothing
drives the app end to end. v0.1 proved both that the discipline works and that
adding it late is how it gets skipped — so that one goes in before the next
feature, not after.

## The gap none of this closes

Nobody has finished a project because of devcon — v0.1 or v2. There is still no
number for *"of N who started, M shipped."* Every task above is an assertion
that it will help, and none of them is evidence.

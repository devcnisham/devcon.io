# Ship — devcon v2

**A shipping critic that runs inside your coding agent, keeps this file, reads
what you actually built, and tells you what to cut.**

Deadline: none. Judged on whether Nisham uses it on his own projects.

---

## Not shipping

The reasons matter more than the list. Each of these existed in v0.1 and none
of them moved the only number that counted.

- **A web app** — v0.1 shipped a canvas, a workspace, a landing page and a docs
  page. 7,935 lines, the largest thing in the repo, and its own `CLAUDE.md`
  said the moat was elsewhere. The agent is already a UI.
- **A step catalog** — 63 pre-written steps assumed the plan is knowable in
  advance. It is not: verifying `comp-happy-path` through a second agent
  produced *nothing to do*, because the previous step had eaten its scope.
- **Accounts, backend, sync** — nobody is sharing anything yet. `SHIP.md` is in
  your repo, so git is the sync. **Accounts reversed on request, 2026-08-12**,
  as phase 0 feature 001 of `v2/feature-phase.md`. The entry is kept rather than
  deleted so the reversal is visible, the same way the web app above is. Backend
  and sync are *not* reversed: accounts live in `~/.devcon/users.json` on this
  machine and nothing is sent anywhere.
- **Telemetry** — there is nothing to measure until one person ships one thing.
- **A second agent to run the work** — you already have one. This tool talks to
  the one you are in.
- **Anything copied from v0.1** — the archive is a record, not a parts bin.
  Rewriting with a fresh reason is the point.

## Done when

- [x] v0.1 is frozen and reachable, not deleted
      `check: git rev-parse --verify --quiet v0.1-archive`
- [x] The freeze exists on the remote, not just this laptop
      `check: git ls-remote --exit-code --tags origin v0.1-archive`
- [x] v2 started from an empty tree with no inherited history
      `check: test "$(git show --name-only --format= $(git rev-list --max-parents=0 HEAD) | grep -c .)" -eq 2`
- [x] The surface typechecks
      `check: pnpm exec tsc --noEmit`
- [x] The surface ships no client JavaScript of its own
      `check: test -z "$(find .next/static/chunks/app -name 'page-*.js' 2>/dev/null)"`
- [x] Lint is clean and stays a gate
      `check: pnpm lint`
- [ ] Tests exist at all
      `check: test -d test && pnpm test`
- [ ] At least two more `SHIP.md` files exist, hand-written, for real projects
      that are not this one
- [ ] Nisham can name one decision each of them changed
- [ ] An MCP server loads in Claude Code and exposes a repo reader
- [ ] The reader returns real structure for a repo it has never seen — run,
      not read
- [ ] `check my ship plan` names drift in a deliberately-drifted spec
- [ ] …and stays quiet against a clean one. A critic that always finds
      something is noise

## Assumptions

If one of these is wrong, the spec is wrong — not the build.

- A spec is more useful than a plan. Untested. This is the whole bet, and
  hand-writing a few of these on real projects is the cheapest way to find out.
- Reading repo structure is enough to critique usefully, without reading source.
- Living inside the agent beats a separate surface. v0.1's surface was never
  the thing people bounced off, so this is inference, not evidence. **A web app
  is now being built anyway** — that reverses the "not shipping" entry above,
  deliberately and on request, and the entry is kept rather than deleted so the
  reversal is visible.

## What this file has already taught

Two things, both from running the checker against it rather than reasoning
about it:

- **A ticked box is a claim, not evidence.** "The surface builds" was ticked
  without being run. The build was fine; the *check* failed, because it ran
  `pnpm build` from inside the dev server and the two fought over `.next`. The
  check is now `tsc --noEmit`, which touches nothing. **A check that can
  sabotage the process running it is not a check** — and running shell out of a
  markdown file means opening a cloned repo's `SHIP.md` executes whatever it
  says. Unsolved.
- **A check can expire.** "v2 started from an empty tree" was
  `git rev-list --count HEAD -le 3` — true when written, false four commits
  later, though the fact it described never changed. It now asserts the root
  commit touched exactly two files, which is a permanent property of history
  rather than a temporary one.

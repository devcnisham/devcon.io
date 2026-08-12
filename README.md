# devcon

A shipping critic that runs inside your coding agent, keeps one `SHIP.md` in
your repo, reads what you actually built, and tells you what to cut.

**v2, in progress.** The spec reader, the checker and its sandbox work and are
on screen. The critique pass — the actual product — does not exist yet.

```bash
pnpm install
pnpm dev        # localhost:3000
```

| Route | What |
|---|---|
| `/` | Landing when signed out. Dashboard when signed in — open a folder or clone a repo, and a card per project read from its files |
| `/signup`, `/login` | Create an account or sign in. Local only: accounts live in `~/.devcon`, hashed with scrypt, and nothing is sent anywhere |
| `/connectors` | Integrations — what this project covers, and what nothing covers yet |
| `/console` | What devcon is doing and what this machine can do, probed |
| `/work` | Redirects to the default view |
| `/work/workspace` | The open project's `SHIP.md`, every condition checked in the sandbox |
| `/work/canvas` | The open project as cards you can drag, pan and select |

Every route is a server component and the build emits **zero page chunks** —
no per-page application JavaScript. One client component exists, the canvas
board, and it costs **4.4 KB gzip**, measured by building with and without it.

**The framework baseline is not zero, and the number is uncomfortable.** Every
route loads 8 scripts totalling **172.5 KB gzip** of Next.js and React runtime,
whether or not the page has any client code. v0.1's landing page — the thing
this rule exists to condemn — was 173 KB. Measured against a production build,
not estimated. "Zero client JavaScript" means zero *application* JavaScript;
it has never meant an empty network tab, and this README said otherwise until
2026-08-10.

## Reading order

| File | Holds |
|---|---|
| `CLAUDE.md` | Working agreement, gates, gotchas that already cost time |
| `HANDOFF.md` | Current state and the decisions blocking progress |
| `v2/task.md` | Every task and its status |
| `SHIP.md` | What ships, what is cut and why, done-when conditions |
| `CHANGELOG.md` | Every change, newest first — the only append-only file |
| `v2/overview.md` | Everything, as a flat list — start here for state |
| `v2/v2_features.md` | The same ground in prose, with how each part was verified |

## What is not built

**The critique pass — which is the actual product.** Everything present is
plumbing for it, and it is deliberately sequenced behind hand-writing a
`SHIP.md` for two real projects: if a hand-written spec changes no real
decision, tooling will not rescue it.

Also missing: an MCP server, cut rules, and end-to-end tests. Unit tests cover
every module in `lib/`, but nothing drives the app as a user. Connecting a
service is not wired either — no OAuth, no token exchange. Integration panels
tell you what a service needs; you set it up.

The accounts added on 2026-08-12 have **no password reset and no email
confirmation**, because devcon has no way to send mail, and signing out clears
the cookie without revoking a token copied beforehand. All three are stated
here rather than discovered later.

Checks run confined — macOS seatbelt, no network, no filesystem outside the
project and its toolchain, no `.git`, `.env*` or `.vercel`, and a replaced
environment. Off macOS they refuse to run rather than running unconfined. A
check can still change the project's own uncommitted files; writes cannot be
denied.

## v0.1

Frozen at the tag `v0.1-archive`, kept on `archive/v0.1`, still deployed at
<https://devcon-hazel.vercel.app>. Nothing was deleted and nothing is carried
forward — the archive is a record, not a parts bin.

It proved that prompts work when an agent runs them: 2 of 63 cleared a
two-agent bar, verified by running the result rather than reading the diff.

It did not prove the thing that matters. **Nobody has finished a project
because of devcon**, v0.1 or v2, and there is still no number for *"of N who
started, M shipped."* Every claim above is an assertion until that exists.

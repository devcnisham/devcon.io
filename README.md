# devcon

A shipping critic that runs inside your coding agent, keeps one `SHIP.md` in
your repo, reads what you actually built, and tells you what to cut.

**v2, in progress.** The surfaces exist and are empty; the product does not
exist yet.

```bash
pnpm install
pnpm dev        # localhost:3000
```

| Route | What |
|---|---|
| `/` | Home — empty |
| `/work` | Redirects to the default view |
| `/work/workspace` | Rail + area — empty |
| `/work/canvas` | Full-bleed surface — empty |

Every route is a server component. The build emits **zero client-side page
chunks**, which is the deliberate answer to v0.1's landing page costing 173KB
of JavaScript to render a headline and one input.

## Reading order

| File | Holds |
|---|---|
| `CLAUDE.md` | Working agreement, gates, gotchas that already cost time |
| `HANDOFF.md` | Current state and the decisions blocking progress |
| `v2/task.md` | Every task and its status |
| `SHIP.md` | What ships, what is cut and why, done-when conditions |

## What is not built

No tests. No CI. No MCP server. No critique pass — which is the actual product;
everything present is plumbing. `lib/ship/` can parse a `SHIP.md` and run its
checks, and is wired to nothing.

## v0.1

Frozen at the tag `v0.1-archive`, kept on `archive/v0.1`, still deployed at
<https://devcon-hazel.vercel.app>. Nothing was deleted and nothing is carried
forward — the archive is a record, not a parts bin.

It proved that prompts work when an agent runs them: 2 of 63 cleared a
two-agent bar, verified by running the result rather than reading the diff.

It did not prove the thing that matters. **Nobody has finished a project
because of devcon**, v0.1 or v2, and there is still no number for *"of N who
started, M shipped."* Every claim above is an assertion until that exists.

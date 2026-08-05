# devcon.io

Takes an idea — or an existing repo — and returns a short, ordered sequence of
steps to ship it. Everything that doesn't apply stays hidden, with a reason
attached. At each step it generates a context-rich prompt to paste into
whatever coding agent you use.

**The intelligence is deciding what to leave out.**

One engine, three contexts: academic, competition, commercial. A hackathon team
that says it needs authentication doesn't get a login step — it gets a loud
instruction not to build one, because judges never sign up and four hours spent
there scores nothing.

## Try it

```bash
pnpm install
pnpm dev
```

Then point it at a real project. Four ways in:

- **A folder** — your browser reads it on your machine. Nothing is uploaded, no
  server involved. Chromium only.
- **A public GitHub repo** — read over the anonymous API, no sign-in.
- **Dropped files** — `package.json` and `.env.example` are enough to start.
- **A local path** — development only; the route 404s in production by design.

It reads structure only: dependency names, config filenames, the directory
tree, and the key **names** in `.env.example`. Never your source, never `.env`,
and there is no field anywhere that accepts a key value.

## How it decides

Selection and ordering are pure functions over a versioned TypeScript catalog.
No model picks your steps. Each step carries a predicate over your project's
profile, and when one fails, the condition tree is walked to find the leaf that
failed — which is why the hidden drawer can tell you *why* something was left
out instead of just hiding it.

That constraint is the product. Subtraction only earns trust if "why was this
hidden?" has an answer, and freeform generation has none.

## What's in here

| | |
|---|---|
| **Engine** | Plan generation, dependency ordering, hidden-step explanation, capacity-vs-deadline cutting |
| **Catalogs** | Academic, competition and commercial tracks, plus 30 providers |
| **Registry** | Project Intelligence — Features is the first module; APIs, routes and models plug into the same shape |
| **Integrations** | 9 MCP servers, with config that works in Claude Code, Cursor and VS Code |
| **Telemetry** | Local event store and a ranked catalog fix list — drop-off is product data, not marketing analytics |

```bash
pnpm build   # the gate — runs TypeScript
pnpm test    # 209 tests, every one mutation-verified
```

## What this is not, yet

Stated plainly rather than discovered later:

- **No backend and no accounts.** All state is browser `localStorage`.
- **`/api/*` returns 404 in production.** The scan route reads the host
  filesystem and the registry routes have no auth. Production ingest goes
  through the browser sources.
- **The sync engine has no remote.** Queue, retry, deduplication and
  revision-based conflict resolution are implemented and tested against a
  transport interface. It says so rather than pretending.
- **4 of 62 prompts have been through an agent, and only one agent.** The
  catalog's own bar is two, so those four report as `partial`.

**And the one that matters: nobody has finished a project because of DevCon.**
There is no number yet for *"of N who started a plan, M reached demo"*. Until
that exists, every claim here — including the whole subtraction thesis — is an
assertion, and it will not be closed by building more features.

## Reading order

- [`features.md`](features.md) — every feature by category, with an honest status
- [`bug-report.md`](bug-report.md) — every defect found, by the feature that caused it
- [`HANDOFF.md`](HANDOFF.md) — current state, the gotchas, where work stopped
- [`docs/gaps-plan.md`](docs/gaps-plan.md) — what to do next, in dependency order

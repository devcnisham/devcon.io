# DevCon — Handoff

> Last updated: end of the session that built the competition track, the
> registry, and the landing page.
> Branch: `devcon-engine-and-catalogs` · remote: `github.com/devcnisham/devcon.io`
> **Read this first. Then the "Where to pick up" section at the bottom.**
>
> `main` has everything through PR #2. The branch is one commit ahead
> (`49a66dd`, the landing page) and **not yet pushed or merged**.
>
> **209 tests, build green.** Every assertion mutation-verified.

---

## What changed since the last handoff

Four things, all merged to `main` except the last:

1. **The competition track now exists.** It didn't — `Context` allowed
   `"competition"` while no step referenced it, so a competition profile
   produced 0 steps and 58 hidden. 17 do-steps + 8 anti-steps now.
2. **Ingest works in production.** `/api/scan` is dev-only and 404s in prod, so
   a deployed DevCon could scan nothing. Four sources behind one digest builder.
3. **The Project Intelligence registry**, with Features as its first module.
4. **The landing page and waitlist**, wired to `/` — uncommitted-to-`main`.

`docs/gaps-plan.md` had three factual errors, all corrected in this file's
history: the step counts, and a claim that the engine "already excludes
unverified steps, so this gates itself". It did not — there was no field to
gate on. `Step.verification` exists now, and deliberately does **not** filter
plans, because a verified-only plan would today be empty.

---

## What DevCon is

Takes an idea — or an existing repo — and returns a **short, ordered,
personalised sequence of steps to ship it**. Everything that doesn't apply
stays hidden, with a reason attached. At each step it generates a
context-rich prompt to paste into whatever coding agent the person uses.

**The intelligence is deciding what to leave out.**

For: students, hackathon teams, vibe coders, early founders. One engine,
three contexts — academic / competition / commercial.

---

## The decisions that hold everything up

Change these and things break in non-obvious ways.

### 1. Selection and ordering are pure functions. The LLM never picks steps.
The catalog is versioned TypeScript. Each step carries a predicate over the
profile. Selection is filter + topological sort. No I/O, no network.

**Why:** subtraction only earns trust if *"why was this hidden?"* is
answerable. With freeform LLM generation there is no answer and output drifts
run to run.

### 2. Conditions are a self-describing DSL, not raw predicates.
`lib/catalog/conditions.ts`. A raw `(p) => boolean` cannot explain why it
failed. Each condition node describes itself, and `explain()` walks the tree
to find the failing leaf. **The hidden-drawer copy is generated, never
hand-written** — hand-written reasons rot the moment a predicate changes.

### 3. Ordering tie-breaks on `id`.
`lib/engine/order.ts`. Without it, plan order silently depends on file-read
order — passes locally, differs in CI, and produces different plans for the
same profile on different machines.

### 4. Anti-steps (`kind: "avoid"`) are NOT hidden steps.
Hidden = silent, the user never knows it existed. Anti-step = shown loudly,
tells them **not** to do something they're about to. Excluded from dependency
ordering entirely — they aren't work, so they can't be a prerequisite.

### 5. One catalog, gated by a `context` predicate. Never fork per track.
`lib/catalog/index.ts` combines academic + commercial. The pressure to fork
"just this once" will look reasonable every time. Forking triples maintenance
and is the failure mode that turns this into a year-long project.

### 6. Schema is team-shaped and account-shaped from day one.
Even though there are no accounts and no teams yet. Retrofitting membership
onto live user data is a migration, not a feature. Cost while solo-only: one
extra table, two nullable columns.

### 7. DevCon never stores or accepts a secret VALUE.
Key **names** plus a "configured" boolean. There is deliberately no input
anywhere that accepts a key. The scanner reads `.env.example` only, never
`.env`. Generated MCP config emits `<your KEY>` placeholders on purpose.

---

## Current state — what actually works

Run `pnpm dev`, open `http://localhost:3000`.

| Area | State |
|---|---|
| Engine (DSL, select, order, explain) | Works. Pure, deterministic. |
| Academic catalog | 16 do-steps + 6 anti-steps. **Unverified.** |
| Commercial catalog | 29 do-steps + 7 anti-steps. **Unverified.** |
| Repo scanner | Works on real repos incl. monorepos. Dev-only route. |
| Completion detection | Works — pre-ticks steps the repo already satisfies. |
| Prompt generation | Works. Template assembly, not LLM. |
| Prompt verification | `/api/verify?path=…` — checks factual claims. |
| Canvas (React Flow) | Works. DAG, drag, marquee select, doc windows, dock. |
| Workspace | Works. Overview / Tasks / Prompts / Board / Don't do / Hidden / Deliverables / Funnel / Integrations / Settings. |
| Docs sidebar | Works. Card tree, search, import .md, open as canvas node, edit. |
| Integrations | 30 providers, env manifest, generated MCP config, custom entries. |
| **Telemetry** | **Just built.** Events fire, funnel reads them, fix list ranks. |
| Home page | Works. Open folder scans a real repo. |

### Verified against a real repo
Scanned `~/Desktop/projects/vespor` (monorepo, 5 workspaces, 80 schema
models). Produces **24 steps, 11 pre-marked done, 27 hidden**. Prompts name
the actual stack — Clerk, Supabase, Stripe, Razorpay, Anthropic, Groq,
Resend, Sentry, PostHog.

---

## What is NOT built — stated so nobody goes looking

- **No backend.** All state is browser `localStorage`. Refresh-safe, but
  clearing site data wipes everything.
- **No accounts, no auth, no teams.** These land together.
- **No prompt has been run through an agent.** The catalog rubric says a
  prompt isn't verified until it's been pasted into two agents against a real
  repo and produced working output. **Zero of 45 do-steps meet that bar.**
- **79 tests, all mutation-verified** (`test/`). Engine, catalog, scanner,
  prompt assembly, telemetry. Not a snapshot suite — every claim was checked
  by breaking the implementation and confirming a test caught it.
  **Still untested: the UI and the two dev-only API routes.**
- **Provider free tiers are seeded, not audited.** `last_verified` is the
  seed date.
- **No pricing.** Deferred deliberately. Direction recorded: one-time
  payment, BYO API key, paid extra if DevCon supplies agent access.
- Waitlist, docs page, pricing page, sign-in — all unstarted, all below the
  cohort in priority.

---

## File map

```
lib/
  catalog/
    types.ts          ProjectProfile, Step, Condition, Plan
    conditions.ts     the self-describing predicate DSL   ← load-bearing
    index.ts          combined registry + validateCatalog()
    steps/academic.ts     16 do-steps + 6 anti-steps
    steps/commercial.ts   29 do-steps + 7 anti-steps
    providers/index.ts    30 providers across 8 capabilities
  engine/
    plan.ts           buildPlan — SELECTION LIVES HERE, inline.
                      There is NO select.ts. Selection is the
                      applies_when loop at the top of buildPlan().
    order.ts          topological sort, tie-break on id
    explain.ts        firstFailure() — walks the condition tree
    layout.ts         DAG positions for the canvas
    prompt.ts         prompt assembly + per-agent preambles
  scan/
    types.ts profile.ts   digest → profile + completion detection
  telemetry/
    events.ts         taxonomy, LocalEventStore, track/trackOnce
    funnel.ts         aggregation + rankCatalogIssues()
  fixtures/profiles.ts    3 sample profiles, used when no repo is loaded
  workspaces/store.ts     recent-workspace list; holds repoPath so a
                          workspace re-scans its real repo on open
  docs/types.ts tasks/types.ts settings/types.ts   local state shapes

app/
  layout.tsx          root layout
  page.tsx            home — open folder / recent workspaces
  WorkspaceThumb.tsx  generated canvas preview for workspace cards
  api/scan/route.ts   repo scanner       (DEV ONLY, 404 in prod)
  api/verify/route.ts prompt verifier    (DEV ONLY, 404 in prod)
  canvas/
    page.tsx          orchestrates everything
    Workspace.tsx     the ordered-list view + section switch
    Funnel.tsx        north star, fix list, per-step funnel
    ProjectLoader.tsx path input + scan, lives in the header
    Prompts.tsx Integrations.tsx Settings.tsx LeftSidebar.tsx
    DocsSidebar.tsx DocWindowNode.tsx StepNode.tsx Dock.tsx ViewTabs.tsx

docs/
  v1.0.0-solo-team-plan.md   the release plan
  gaps-plan.md               what to fix next  ← READ THIS
  checklist.md               page checklist (mostly below the cohort)
```

Frozen reference plan (not in repo):
`~/.claude/plans/i-have-an-idea-encapsulated-hanrahan.md`

**Untracked and deliberately not committed:** `nisham/` and `sumayya/` —
personal notes and templates that appeared in the working tree. Not part of
the app. Commit them yourself if they belong here.

---

## Gotchas that will bite

1. **`useSearchParams` needs a Suspense boundary** or the static export fails.
   `app/canvas/page.tsx` wraps `CanvasInner` for this reason.
2. **React StrictMode double-fires effects in dev.** `trackOnce()` exists
   because `plan_generated` was double-counted — that's the north star's
   denominator, and a ship rate at half its true value looks credible.
3. **Percentage height on a flex child doesn't reliably resolve.** Workspace
   uses `absolute inset-0`, not `h-full`. It rendered blank before.
4. **Don't re-export the registry from a step file.** `academic.ts` importing
   from `catalog/index.ts` is a cycle — build-time crash, not a type error.
5. **Doc windows open to the LEFT** (`x: -640`). Step layout centres on x=0,
   so positive x lands under the docs sidebar, out of sight.
6. **`clipboard.writeText` rejects** when the document isn't focused. Handled
   with an `execCommand` fallback; only records `prompt_copied` on success,
   because a failed copy counted as a success corrupts the key signal.

---

## Testing discipline — read before adding tests

**A green suite is not evidence a suite works.** Every assertion in `test/`
was mutation-tested: break the implementation, confirm a test catches it.
That practice has paid for itself twice.

- It found a test **passing against a deleted invariant** — the `id`
  tie-break in `orderSteps` could be removed with all 33 tests still green,
  because no two steps in a single plan share a `(phase, weight)`. The 16
  collisions are all *across* tracks, and only one track is ever selected, so
  catalog data never exercises it. Replaced with a direct `orderSteps` test on
  synthetic tied steps.
- It found a **real bug in `rankCatalogIssues`** — a step everyone copied and
  completed still scored 0.5 and was reported as broken, because
  `step_opened` wasn't recorded. That event only fires in the Prompts section,
  so completing from the task list tripped it. A fix list containing working
  steps is a fix list nobody trusts.

Do the same for anything new. Two lines of shell:

```bash
sed -i '' 's/<the invariant>/<broken>/' lib/…   # break it
pnpm test                                        # expect a failure
git checkout lib/…                               # restore
```

---

## What this session changed

### 1. Ingest is real, and the sample projects are gone

Before: three fixture profiles rendered when nothing was loaded, and the only
way to load a real repo was `/api/scan`, which is **dev-only and 404s in
production**. A deployed DevCon could scan nothing at all.

Now there is a source interface (`lib/scan/source.ts`) and one scanner
(`lib/scan/digest.ts`) behind four ingest paths:

| Source | File | Works in prod | Notes |
|---|---|---|---|
| Browser folder picker | `sources/folder.ts` | yes | Chromium only. Reads on the user's machine; nothing uploaded. |
| Public GitHub repo | `sources/github.ts` | yes | Anonymous API, one recursive tree call. Public only — a private repo would need a token, and no field takes one. |
| Dropped files | `sources/dropped.ts` | yes | Universal fallback. Reports `manifest-only` when it can't see a tree. |
| Local path | `sources/node-fs.ts` | **no** | Dev route, unchanged guard. |

The dev route is now ~60 lines that call `buildDigest(nodeSource(root))`. It
produces a *better* digest than the old bespoke walk: it finds the git remote,
and on the vespor monorepo it reports 5 `.env` files as never-read where the
old code saw 1.

Fixtures moved to `test/profiles.ts`. The app ships no sample project;
`app/canvas/EmptyState.tsx` asks for a real one.

**Gotcha worth knowing:** `EMPTY_PROFILE` does *not* select nothing. Every
track has steps gated on `context` alone, so any complete profile builds a
plan — an empty profile rendered 13 commercial steps behind the empty state.
The plan is therefore gated on `scanned`, not on the profile being empty.

### 2. The generated MCP config was broken, and is not now

Three of the five servers were stale or dead, and all five emitted
`"env": {"KEY": "<your KEY>"}` — a literal string the client passes through as
the credential, so every server started and then failed its first
authenticated call. Config that reads as working right up until it isn't.

- `${NAME}` references now, which MCP clients expand from the environment.
- Remote entries carry `"type"`. Without it a `url` entry is read as stdio and
  **silently skipped**.
- `@modelcontextprotocol/server-github` was archived → GitHub's own hosted
  server. Linear's `mcp-remote` shim → native remote. Stripe's stdio form took
  a live `STRIPE_SECRET_KEY` through the config file → hosted OAuth.
- 9 servers now, up from 5. All OAuth, so `mcpKeysNeeded()` returns nothing.
- Per-client output (Claude Code / Cursor / VS Code — VS Code reads `servers`,
  not `mcpServers`) plus runnable `claude mcp add` commands.

Every endpoint was checked against vendor docs on 2026-08-05. That is
deliberately **not** folded into `last_verified`, which still means free tiers
and is still just the seed date.

### 3. Connected services are on the canvas

`Step.serves?: Capability[]` is catalog data — 13 steps tagged — so a service
node draws edges to the steps it actually wires up rather than to a guess.
Integration state moved out of the panel into `lib/integrations/store.ts` so
the canvas can see it. The scan's git remote names the real repository on the
card (`devcnisham/devcon.io`, not "GitHub").

### 4. Smaller fixes

- Docs sidebar starts **closed** and no longer reserves its gutter.
- `navigator.clipboard.writeText` in Integrations was unhandled — the same bug
  already fixed in Prompts. Extracted to `lib/clipboard.ts` and used by both.
- `context()` in the condition DSL still reads "a academic project". Not fixed
  — see below.

**Tests: 134, up from 79.** All new ones mutation-verified. That found four
assertions passing against nothing (every shipped MCP server is remote, so the
stdio paths were never exercised) and two real bugs: `droppedCoverage`
misreading a flat directory drop, and a migration count that agreed with the
wrong implementation because every fixture directory held one file.

---

## Where the last session stopped

**Finished this session:**

1. **Funnel instrumented** (item 1 of `docs/gaps-plan.md`). Events fire,
   `trackOnce` dedupes, the Funnel section renders the north star, ranked fix
   list, un-hidden steps and the per-step table. Verified by copying two
   prompts without completing them → `2 × prompt_copied, 0 × step_completed`,
   exactly the diagnostic case the taxonomy exists to capture.
2. **Handoff audited against the repo** — found and fixed five factual errors,
   including a listed `lib/engine/select.ts` that has never existed.
3. **79 tests written and mutation-verified** across engine, catalog, scanner,
   prompt assembly and telemetry.

**Bugs those found and fixed:** the `rankCatalogIssues` false-positive above;
`clipboard.writeText` rejecting unhandled *and* recording a failed copy as a
successful one; StrictMode double-firing `plan_generated`, which is the north
star's denominator.

**Loose end, small:** never visually confirmed the Funnel table renders with
real events in it. The aggregation is tested; the rendering is not.

## Everything unfinished, in one place

Written at the end of the session that built the competition track, the
registry and the landing page. Ordered by whether it blocks anything.

### Blocking — the product's own claim depends on these

| # | Item | State |
|---|---|---|
| 1 | **Verify the prompts through a second agent.** 4 of 62 do-steps have been run against a real repo, by one agent. The catalog rubric's bar is two, so `verificationState()` reports those four as `partial` and the rest as `unverified`. | 4/62, half-verified |
| 2 | **Run one hackathon cohort.** 10–50 teams on the competition track. The only thing that closes the dominant gap. | not started |
| ~~3~~ | ~~Steps shipping an agent prompt for work no agent can do.~~ **DONE.** All three tracks now declare `execution`. Academic 3 human / 4 needs-input, competition 3 / 4, commercial 5 / 10. | closed 2026-08-06 |

### Not blocking, but wrong today

| # | Item | Where |
|---|---|---|
| 4 | **Nothing in the catalog checks the demo actually renders.** `comp-guard-happy-path` covers crashes and `comp-demo-environment` covers the machine. Neither catches "it works and looks wrong on a projector" — found when the verification demo shipped mojibake that `curl` couldn't see. | competition catalog |
| 5 | **`@feature` annotations are picked up inside string literals.** Scanning this repo reports `Authentication` as annotated, from a string in `test/registry.test.ts`. Accepted cost of regex parsing so annotations work in a browser tab; an AST parser is the only real fix. | `lib/registry/sources/annotations.ts` |
| 6 | **`project-management` is the one capability no step serves.** Connect Linear and its canvas node draws no edges. Honest — no catalog step wires up a tracker — but it reads as a bug. | catalog `serves` tags |
| 7 | **Funnel table never seen with real events in it.** The aggregation is tested; the rendering is not. | `app/canvas/Funnel.tsx` |
| 8 | **`last_verified` CI check (90 days)** never built. Provider free tiers are seeded, not audited. | `docs/gaps-plan.md` item 6 |

### Built but not driven by hand

Typed, unit-tested, and never clicked:

- **Browser folder picker** and **file drop** — the two production ingest paths.
  The digest builder behind them has 15 tests and the GitHub path was run
  end-to-end against `vercel/next-learn`, but nobody has used the pickers.
- **The waitlist form** — `lib/waitlist/store.ts` is straightforward and
  deduplicates on a lowercased email, but the page has not been submitted in a
  browser. **It has no tests at all.**

### Has no backend, and says so

These are implemented against an interface with nothing on the other side.
None of them are broken; all of them are inert.

- **Sync engine** — queue, backoff, dedup, revision-based conflict resolution,
  optimistic updates. `localOnlyTransport` is what runs. `devcon sync` prints
  why rather than pretending.
- **Registry REST API** — module-generic routes with optimistic concurrency,
  **dev-only**, because there is no auth and an unauthenticated write endpoint
  on a deployed host lets anyone rewrite anyone's registry.
- **Waitlist** — browser `localStorage`. Emails entered on one machine exist
  only on that machine.
- **Accounts, auth, teams** — none. Schema is already team- and account-shaped
  so retrofitting is not a migration.

### Registry modules declared but not implemented

`ModuleId` lists nine beyond `feature`: `api`, `route`, `model`, `job`,
`prompt`, `component`, `env`, `integration`, `package`. The core mentions no
feature anywhere, so each is a module definition plus a detector — that claim
is untested until someone actually adds the second one.

### Working tree, right now

- **Branch is one commit ahead of `main`** (`49a66dd`, the landing page) and
  **not pushed**. No PR open.
- **Three files carry edits that are not from this session** and were left
  alone: `app/canvas/DocsSidebar.tsx` (unused import), `lib/scan/profile.ts`
  (adds `state` to an evidence note — a real improvement), `test/prompt.test.ts`
  (unused const). Small and benign; commit or discard deliberately.
- **`checklist.md` at the repo root is untracked and differs from
  `docs/checklist.md`.** Two checklists, one stray. Reconcile or delete.
- `nisham/`, `sumayya/` and `static_analysis_codeql_1/` are now gitignored.
  The last is a generated CodeQL database of 2,983 files that was sitting one
  `git add -A` away from being committed.

### Deliberately deferred

- **The name.** "DevCon" reads as *developer conference* — the deleted
  `landing.html` stub actually described it that way. Cheap to change now.
- **Pricing.** Direction recorded: one-time payment, BYO API key.
- **Accounts** — revisit only if a cohort shows they are needed.

---

## Where to pick up

Do this first, in this order:

1. **Verify prompts through a second agent** — item 1 above. 4 of 62, by one
   agent, when the rubric's bar is two. Everything about the catalog's
   credibility routes through this.
2. **Run one hackathon cohort** on the competition track.

Classifying the commercial track is done. Nothing else on this page closes the
gap below — only putting it in front of people does.

---

## The gap none of it closes

**Nobody has finished a project because of DevCon.**

There is still no number for *"of N who started a plan, M reached demo."*
Everything above is built and tested; none of it is evidence the thesis works.
It cannot be closed by building more features — only by putting the thing in
front of people and measuring what happens.

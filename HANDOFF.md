# DevCon — Handoff

> Last updated: end of the session that wrote the test suites.
> Branch: `devcon-engine-and-catalogs` · remote: `github.com/devcnisham/devcon.io`
> **Read this first. Then `docs/gaps-plan.md` for what to do next.**
>
> Everything is committed and pushed. Working tree clean apart from
> `nisham/` and `sumayya/`, which are deliberately untracked.

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

**Nothing is half-done.** Build passes, tests pass, everything is pushed.

---

## Next steps, in dependency order

From `docs/gaps-plan.md`. The order is forced, not preference.

| # | Work | Why here |
|---|---|---|
| 1 | ~~Instrument the funnel~~ | **Done.** |
| 2 | **Verify the competition prompts through a real agent** | Running a cohort on unverified prompts makes failure un-diagnosable between "plan wrong" and "prompt wrong". ~10 steps. Set `verified_at`. |
| 3 | **Run one hackathon cohort**, 10–50 teams | The only thing that closes the dominant gap. |
| 4 | Read drop-off → fix the catalog | The flywheel, with real input for the first time. |
| 5 | Accounts + return loop | **Only if the cohort shows it's needed.** |
| 6 | `last_verified` CI check (90 days) | Independent, do anytime. |
| — | Name, positioning, README | Not blocked. Do in parallel. |

### The dominant gap
**Nobody has finished a project because of DevCon.** There is no number for
*"of N who started a plan, M reached demo."* Until that exists, every claim
here — including the whole subtraction thesis — is an assertion. It cannot be
closed by building more features.

---

## Open decisions

- **The name.** "DevCon" means developer conference to the industry and the
  search term is crowded. Cheap now, expensive after any marketing.
- **Positioning.** Lead with the shared bottleneck (order + wiring + what to
  skip), use the three tracks as proof the engine is context-native. Not
  "college project planner" — academic was a release order, never the market.
- **Pricing.** Deferred.

---

## Commands

```bash
pnpm dev        # localhost:3000
pnpm build      # typecheck + build — the real gate
pnpm lint       # biome (a11y noise from scaffolded SVGs is expected)
pnpm test       # vitest — 34 engine tests, mutation-verified
```

Scan a repo: `curl 'localhost:3000/api/scan?path=/abs/path'`
Verify prompts: `curl 'localhost:3000/api/verify?path=/abs/path'`

---

## Working agreement

- **Build is the gate**, not lint. `pnpm build` runs TypeScript.
- **State what isn't done** rather than implying completeness. Several UI
  surfaces say so in the product itself — keep that.
- **Don't add UI in response to a defensibility worry.** The moat is the
  catalog and the measured loop. More UI makes it less defensible.

# DevCon — Feature Registry

Every feature in this project, by category, with an honest status.

> Status vocabulary is the one the registry itself uses:
> **✅ Completed** · **⏳ Testing** · **🚧 Building** · **📋 Planned** · **🗑 Deprecated**
>
> "Completed" here means built, typechecked and covered by mutation-verified
> tests. It does **not** mean proven with users — nothing in this project has
> been through a real cohort yet, and that gap is the subject of the last
> section.

---

## Planning engine

The core. Pure functions over a versioned catalog — no LLM picks steps, so
"why was this hidden?" always has an answer.

| Feature | Status | Notes |
|---|---|---|
| Plan generation | ✅ Completed | `buildPlan` — pure, no I/O, byte-identical output for the same profile |
| Step selection | ✅ Completed | Predicate per step, evaluated inline in `buildPlan` |
| Dependency ordering | ✅ Completed | Topological sort, tie-broken on `id` so plans don't differ between machines |
| Hidden-step explanation | ✅ Completed | `firstFailure()` walks the condition tree and names the leaf that failed |
| Condition DSL | ✅ Completed | Self-describing predicate nodes — the reason a step is hidden is generated, never hand-written |
| Anti-steps | ✅ Completed | Shown loudly, excluded from dependency ordering — they aren't work |
| Progress by weight | ✅ Completed | Estimated minutes, never step count |
| Mark tracking | ✅ Completed | Academic only; a rubric maps features to marks |
| Capacity vs. deadline | ✅ Completed | Flags "you won't finish" and proposes what to cut |
| DAG layout | ✅ Completed | Deterministic node positions for the canvas |

## Catalogs

The moat. Versioned TypeScript, one catalog gated by `context` — never forked
per track.

| Feature | Status | Notes |
|---|---|---|
| Academic track | ⏳ Testing | 16 do-steps + 6 anti-steps. **No prompt verified against a live agent.** 7 steps classified by execution mode. |
| Competition track | ⏳ Testing | 17 do-steps + 8 anti-steps. Hackathons. 4 steps partially verified; 7 classified by execution mode. |
| Commercial track | ⏳ Testing | 29 do-steps + 7 anti-steps. **No prompt verified, none classified** — the track this work hasn't reached. |
| Provider catalog | ⏳ Testing | 30 providers across 8 capabilities. Free tiers are seeded, not audited. |
| Catalog validation | ✅ Completed | Duplicate ids, dangling dependencies, cycles, rubric rules |
| `serves` capability tagging | ✅ Completed | 15 steps declare which service they wire up |
| Verification tracking | ✅ Completed | `Step.verification` records the date and which agents ran it. `verificationState()` returns `unverified` / `partial` / `verified` — two agents is the bar, so one run is `partial`. Deliberately does **not** filter plans: a verified-only plan would be empty today, and hiding that is worse than showing it. |
| Prompt verification | 🚧 Building | 4 competition steps run through one agent against a scratch repo. 0 of 62 at the two-agent bar. |

## Project ingest

Reads a real repo. Structure only — never source, never `.env`, never a key
value.

| Feature | Status | Notes |
|---|---|---|
| Source interface | ✅ Completed | One scanner behind four ingest paths |
| Digest builder | ✅ Completed | Dependencies, config files, directories, migrations, markers |
| Browser folder picker | 🚧 Building | Works in production, Chromium only. Unit-tested; not yet driven by hand. |
| Public GitHub repo | ✅ Completed | Anonymous API, one recursive tree call. Verified against `vercel/next-learn`. |
| Dropped files | 🚧 Building | Universal fallback. Reports `manifest-only` when it can't see a tree. |
| Local path scan | ✅ Completed | **Dev-only — 404s in production by design** |
| Profile inference | ✅ Completed | Evidence-backed; every conclusion records what it saw |
| Completion detection | ✅ Completed | Pre-ticks steps the repo already satisfies |
| Git remote identity | ✅ Completed | Parsed from `.git/config`; strips committed credentials |
| Secret refusal | ✅ Completed | `.env` listed and reported as skipped, never read |

## Feature Registry

The first registry module. The core is deliberately module-agnostic — APIs,
routes, models and components plug into the same shape.

| Feature | Status | Notes |
|---|---|---|
| Registry core | ✅ Completed | `RegistryEntry`, `RegistryModule`, `Detector` — mentions no feature anywhere |
| Feature module | ✅ Completed | Lifecycle, priorities, validation, hydration |
| Auto-detection | ✅ Completed | 16 rules over dependencies, env key names and paths |
| Evidence trail | ✅ Completed | Every suggestion says what it matched on |
| Suggestion review | ✅ Completed | Detected entries are questions until accepted; a re-scan never resurrects a dismissal |
| Comment annotations | ✅ Completed | `@feature` in block, `//` and `#` comments |
| Config file | ✅ Completed | `project.features.ts` read as data, never executed |
| SDK | ✅ Completed | `feature({...})` — returns null rather than throwing inside a host app |
| Origin precedence | ✅ Completed | manual > declared > annotated > detected. A scan never overwrites a decision. |
| Store + history | ✅ Completed | Interface first; localStorage and in-memory implementations. Append-only diffs. |
| Query layer | ✅ Completed | Search, filter, sort, facets, grouping — pure, outside React |
| Dashboard | ✅ Completed | List and grid, status badges, filters, detail panel, `/` to search, skeletons, empty states |
| CLI | 🚧 Building | `scan`, `feature list/add/update/remove`, `doctor` work. `sync` needs a backend. |
| REST API | 🚧 Building | Module-generic routes with optimistic concurrency. **Dev-only — no auth exists.** |
| Sync engine | 🚧 Building | Queue, backoff, dedup, revision-based conflicts — all implemented and tested against a transport interface. **No remote to talk to.** |
| AI query layer | 📋 Planned | Architecture allows it; deliberately not implemented |
| Further modules | 📋 Planned | `api`, `route`, `model`, `job`, `prompt`, `component`, `env`, `integration`, `package` declared in `ModuleId`, none implemented |

## Prompts

| Feature | Status | Notes |
|---|---|---|
| Prompt assembly | ✅ Completed | Template assembly with real profile, deps, services and anti-steps |
| Execution modes | ✅ Completed | Steps declare `agent` / `needs-input` / `human`. A human step has no prompt at all — `buildPrompt` throws — and gets a checklist. |
| Step inputs | ✅ Completed | `needs-input` steps collect the rubric, sponsor rules or demo outline. Blank fields are named as missing so the agent asks instead of inventing. |
| Checklists for human steps | ✅ Completed | `buildChecklist()` — copyable, so "get everyone to push" can go in the team chat. None of the framing that only makes sense addressed to a model. |
| Complete anti-step context | ✅ Completed | Every prompt carries every anti-step. Phase-filtering made prompts contradict themselves: the profile said the project needs auth while the instruction not to build it sat in another phase. |
| Honest dependency status | ✅ Completed | "Already built" and "Not done yet" are separate sections. One heading covering both said the opposite of its own body. |
| Per-agent preambles | ✅ Completed | Claude Code, Cursor, Lovable, v0, generic |
| Detected-service injection | ✅ Completed | Names Clerk/Supabase/Stripe rather than saying "your auth provider" |
| Safe clipboard copy | ✅ Completed | Only records `prompt_copied` when the clipboard actually took it |
| Prompt verification route | ✅ Completed | Checks factual claims against a repo. **Dev-only.** Cannot tell you a prompt produces working code. |

## Canvas & workspace

| Feature | Status | Notes |
|---|---|---|
| React Flow canvas | ✅ Completed | Drag, marquee select, pan, minimap |
| Step nodes | ✅ Completed | Four-sided handles, state-driven styling |
| Integration nodes | ✅ Completed | Connected services drawn against the steps they serve |
| Doc windows | ✅ Completed | Markdown files opened as canvas nodes |
| Docs sidebar | ✅ Completed | Card tree, search, import, edit. Closed by default. |
| Left rail | ✅ Completed | Overview, Tasks, Prompts, Board, Don't do, Hidden, Deliverables, Registry, Funnel, Integrations, Settings |
| Empty state | ✅ Completed | No sample project — asks for a real one |
| Landing page | ✅ Completed | `/` — positioning, the three tracks, anti-steps, and the waitlist form |
| Workspace picker | ✅ Completed | Moved to `/start` when the landing took `/`. Recent workspaces, re-scanned on open. |
| Keyboard shortcuts | 🚧 Building | `/` and Escape in the registry. Nowhere else. |
| Dark mode | ✅ Completed | The only mode. There is no light theme. |
| Accessibility | 🚧 Building | Labels and `aria-pressed` on controls; no audit has been done |

## Integrations

| Feature | Status | Notes |
|---|---|---|
| Provider directory | ✅ Completed | Search, one-per-capability, trade-offs, free tiers |
| MCP config generation | ✅ Completed | 9 servers, `${NAME}` expansion, correct `type` on remote entries |
| Per-client output | ✅ Completed | Claude Code, Cursor, VS Code — VS Code reads `servers`, not `mcpServers` |
| `claude mcp add` commands | ✅ Completed | Runnable as written |
| Env manifest | ✅ Completed | Key names and a configured boolean. No field anywhere accepts a value. |
| Custom providers | ✅ Completed | Never claims verification |
| OAuth connect flow | 📋 Planned | "Connect" records a decision; there is no handshake behind it |

## Telemetry

| Feature | Status | Notes |
|---|---|---|
| Event taxonomy | ✅ Completed | `prompt_copied` and `step_completed` deliberately separate |
| Local event store | ✅ Completed | Not a vendor — drop-off ranks the catalog fix list, so it's product data |
| Funnel aggregation | ✅ Completed | North star, per-step funnel, un-hidden steps |
| Fix-list ranking | ✅ Completed | Ranks catalog steps by where people stall |
| Rendering with real events | 🚧 Building | Aggregation is tested; the table has never been seen with real data in it |

## Platform

| Feature | Status | Notes |
|---|---|---|
| Test suite | ✅ Completed | 209 tests, every assertion mutation-verified. The waitlist store is the one module with none. |
| Build gate | ✅ Completed | `pnpm build` runs TypeScript |
| Workspace persistence | ✅ Completed | Recent workspaces, re-scanned on open |
| Documentation | ✅ Completed | `README.md`, this file, `bug-report.md`, `HANDOFF.md`, `docs/gaps-plan.md`. Each states what isn't done as plainly as what is. |
| Backend | 📋 Planned | None. All state is browser `localStorage`. |
| Accounts / auth / teams | 📋 Planned | None. Schema is already team- and account-shaped. |
| Waitlist | 🚧 Building | Browser `localStorage`, deduplicated on a lowercased email, shaped as the row a future table will hold. **No tests, and the form has never been submitted in a browser.** |
| Pricing | 📋 Planned | Deferred. Direction recorded: one-time payment, BYO API key. |

---

## The gap this table cannot close

**Nobody has finished a project because of DevCon.**

Everything above is built and tested. None of it is evidence that the thesis
works. There is no number for *"of N people who started a plan, M reached
demo"*, and until that number exists every claim here — including the whole
subtraction argument — is an assertion.

The two things that would change it, in order:

1. **Verify the competition prompts through a real agent.** 0 of 62 do-steps
   meet the catalog's own bar. Running a cohort before this makes failure
   un-diagnosable between "the plan is wrong" and "the prompt is wrong".
2. **Run one hackathon cohort.** 10–50 teams, competition track, with a control
   group if possible.

More features do not close it. See `docs/gaps-plan.md`.

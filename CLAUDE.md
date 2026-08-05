@AGENTS.md

# DevCon

**Start every session by reading `HANDOFF.md`.** It carries current state,
what's built, what isn't, the gotchas, and the ordered next steps. This file
is only the short version.

## What it is

Takes an idea or an existing repo, returns a short ordered sequence of steps
to ship it, and hides everything that doesn't apply — with a reason attached.
Generates a context-rich prompt per step to paste into a coding agent.

**The intelligence is deciding what to leave out.** One engine, three
contexts: academic / competition / commercial.

## Rules that hold the design up

Break these and things fail in non-obvious ways.

1. **Selection and ordering are pure functions. The LLM never picks steps.**
   The catalog is versioned TypeScript with predicates over a profile.
2. **Conditions are a self-describing DSL** (`lib/catalog/conditions.ts`), so
   `explain()` can name the leaf that failed. Hidden-drawer copy is
   generated, never hand-written.
3. **Ordering tie-breaks on `id`** — otherwise plan order depends on
   file-read order and differs between machines.
4. **Anti-steps are not hidden steps.** Hidden is silent; an anti-step is
   shown loudly and tells you not to do something. Never in dependency order.
5. **One catalog gated by `context`.** Never fork per track — the pressure to
   fork "just this once" will always look reasonable.
6. **Schema is team- and account-shaped already**, though neither exists yet.
   Retrofitting is a migration, not a feature.
7. **Never store or accept a secret VALUE.** Key names plus a boolean. The
   scanner reads `.env.example`, never `.env`. No input anywhere takes a key.

## Layout

- `lib/catalog/` — types, the condition DSL, step catalogs, providers
- `lib/engine/` — plan (selection lives inline in `buildPlan`, there is no
  `select.ts`), order, explain, layout, prompt
- `lib/scan/` — repo digest → profile + completion detection
- `lib/telemetry/` — event taxonomy, funnel aggregation, fix-list ranking
- `app/canvas/` — canvas + workspace UI
- `app/api/scan`, `app/api/verify` — **dev-only**, 404 in production
- `docs/gaps-plan.md` — what to do next and why, in dependency order

## Working agreement

- `pnpm build` is the gate — it runs TypeScript. Lint has known a11y noise
  from scaffolded SVGs. `pnpm test` runs 34 mutation-verified engine tests.
- **A green suite is not evidence a suite works.** Every assertion in
  `test/` was checked by breaking the implementation and confirming a test
  caught it — that found one test passing against a deleted invariant. Do
  the same for anything new.
- **State what isn't done** rather than implying completeness. Several
  surfaces say so in the product; keep that.
- The moat is the catalog and the measured loop, not the UI. Don't add
  surfaces to answer a defensibility worry.
- Nothing is verified until it's been run. No prompt has been through an
  agent yet — that's the next real task, not more features.

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
- `lib/scan/` — source interface, one digest builder, four ingest sources
  (browser folder picker, public GitHub, dropped files, dev-only local path)
- `lib/telemetry/` — event taxonomy, funnel aggregation, fix-list ranking
- `app/canvas/` — canvas + workspace UI
- `app/api/scan`, `app/api/verify` — **dev-only**, 404 in production. Production
  ingest goes through the browser sources, not here.
- `docs/gaps-plan.md` — what to do next and why, in dependency order

## Working agreement

- **Four gates, all of them green, all run by CI** on every push and PR
  (`.github/workflows/ci.yml`): `pnpm docs:check`, `pnpm lint`, `pnpm test`
  (<!--catalog:tests-->252<!--/catalog--> mutation-verified tests), `pnpm build`.
  - `pnpm build` runs TypeScript, and the typecheck happens *after*
    "✓ Compiled successfully" prints — reading only that line has already
    hidden 7 type errors here once. Check the exit code.
  - `pnpm lint` is clean. It used to report ~80 findings and this file blamed
    "a11y noise from scaffolded SVGs"; the real cause was biome being unable to
    parse `globals.css` without `css.parser.tailwindDirectives`. Rules still
    disabled are scoped per file in `biome.jsonc`, each with its reason.
  - `pnpm docs:check` fails when a documented number disagrees with the
    catalog. Numbers in README, HANDOFF, features and this file sit inside HTML
    comment markers and are written by `pnpm docs:sync` — see
    `lib/docs/sync.ts` for the syntax. Do not write the marker form into a
    synced file even as an example: the parser cannot tell your illustration
    from a real marker, which is exactly how this line was first written.
- **A green suite is not evidence a suite works.** Every assertion in
  `test/` was checked by breaking the implementation and confirming a test
  caught it. That found a test passing against a deleted invariant, and a
  real bug that flagged working steps as broken. Do the same for anything
  new — see the testing-discipline section in `HANDOFF.md`.
- **State what isn't done** rather than implying completeness. Several
  surfaces say so in the product; keep that.
- The moat is the catalog and the measured loop, not the UI. Don't add
  surfaces to answer a defensibility worry.
- Nothing is verified until it's been run. <!--catalog:partial-->2<!--/catalog--> of <!--catalog:doSteps-->63<!--/catalog--> prompts have been
  through an agent, and only one agent — the rubric's bar is two, so
  `verificationState()` reports those as `partial` and the rest as
  `unverified`. A second Claude Code run does not close it; that is the same
  agent. This is still the next real task, not more features.

# DevCon — Bug Report

Every defect found, grouped by the feature that produced it.

> Bugs found by *building* a feature are listed under that feature. Bugs found
> by *exercising* one are listed under the feature that was wrong, not the one
> that caught it — the catcher is credited in the "Found by" column.
>
> Status: **Fixed** · **Open** · **Won't fix** (with a reason)

---

## Prompt generation — `lib/engine/prompt.ts`

Found by running the competition prompts through a real agent against a scratch
repo. All three had shipped and none had ever been read by an agent.

| # | Bug | Severity | Status |
|---|---|---|---|
| P1 | **"Already built (don't redo)" listed steps that were not built.** Unfinished dependencies were filed under that heading and tagged `— NOT yet done` in the body. The heading and the body said opposite things, and an agent skimming headings reads the heading. Every competition foundation prompt carried it above a step nobody had started. | High | Fixed |
| P2 | **The prompt contradicted itself about auth and payments.** The profile line says "It needs users to sign in, payments…" because the builder said so. The anti-steps saying *don't build either* are `core` phase, and anti-steps were filtered to the current phase — so a `foundation` prompt showed the need and hid the instruction. An agent reading it would go and build auth, which is the exact outcome the competition track exists to prevent. | **Critical** | Fixed |
| P3 | **Steps no agent can execute still generated a paste-into-your-agent prompt.** `comp-read-judging` asked the agent to check every criterion is answered, but the criteria were never supplied and the profile only carries a boolean. Same for `comp-sponsor-requirements`, `comp-split-work`, `comp-demo-script`, `comp-submission-video`, `comp-submit-early` — 6 of 15 selected steps were human or team coordination. | High | Fixed |

**P3 was the finding that mattered**, and it was not a wording problem. Steps
now declare `execution`:

- `agent` — the prompt carries everything needed. The default.
- `needs-input` — an agent can do it once a human supplies something DevCon
  cannot know. The card shows fields for exactly those; blank ones are named in
  the prompt as missing, with "ask me rather than assuming an answer", because
  an agent told to check criteria it was never given invents plausible ones.
- `human` — `buildPrompt` **throws**. There is no paste button. It renders a
  checklist instead, copyable so it can go in the team chat.

The same defect existed on the academic track (`module-ownership`, `viva-prep`,
`submit-early` were human; `read-rubric`, `confirm-constraints`,
`project-report`, `demo-script` needed the brief), and was fixed there too —
fixing one track's symptom would have left two shipping the same lie.

## MCP config generation — `lib/catalog/providers/index.ts`

Found by reading the generated config against vendor documentation. The feature
had shipped; none of the endpoints had been checked since they were seeded.

| # | Bug | Severity | Status |
|---|---|---|---|
| M1 | **Every server was emitted with a literal placeholder as its credential.** `"env": {"KEY": "<your KEY>"}` is not a placeholder any MCP client understands — it is passed through verbatim as the key. Every server started and then failed its first authenticated call. Config that reads as working right up until it isn't. | **Critical** | Fixed |
| M2 | **Remote entries had no `type`, so clients silently skipped them.** A `url` entry without `type` is read as a stdio server; Claude Code reports `has a "url" but no "type"` and drops it. | **Critical** | Fixed |
| M3 | **GitHub pointed at an archived package.** `@modelcontextprotocol/server-github` moved to `github/github-mcp-server` and was archived. The config installed a dead package. | High | Fixed |
| M4 | **Linear shimmed through `mcp-remote` to a `/sse` endpoint Linear is removing.** | Medium | Fixed |
| M5 | **Stripe's stdio form carried a live `STRIPE_SECRET_KEY` through the config file** — a payments key, in the one place this product refuses to put one. Now hosted OAuth, so no key enters the config at all. | High | Fixed |
| M6 | **`navigator.clipboard.writeText` unhandled in Integrations.** Rejects when the document isn't focused; the rejection crashed the dev overlay. The identical bug had already been found and fixed in Prompts and was never shared. | Medium | Fixed |

## Catalog & engine — `lib/catalog/`, `lib/engine/`

| # | Bug | Severity | Found by | Status |
|---|---|---|---|---|
| C1 | **The competition track did not exist.** `Context` allowed `"competition"`, no step referenced it, there was no `competition` block on `ProjectProfile`. A competition profile produced 0 steps / 0 anti-steps / 58 hidden — a silently empty plan, because nothing distinguishes "everything hidden" from "nothing applies". `docs/gaps-plan.md` items 2 and 3 both assumed it existed. | **Critical** | Reading gaps-plan against the code | Fixed |
| C2 | **`docs/gaps-plan.md` claimed the engine excluded unverified steps and "gates itself".** It did not. `Step` had no `verified_at` field and `buildPlan` filtered on nothing but `applies_when`. The claim had been in the plan through two sessions. | High | Same | Fixed |
| C3 | **Hidden-drawer copy read "this isn't a academic project".** `context()` built `a ${c}` with no article logic. `prompt.ts` already had an `article()` helper for exactly this and it was never shared. Every hidden academic step showed it. | Low | Running `buildPlan` | Fixed |
| C4 | **`EMPTY_PROFILE` rendered 13 commercial steps behind the empty state.** I introduced it while removing the fixtures, with a comment asserting it "selects nothing". It does not — every track has steps gated on `context` alone, so any complete profile builds a plan. Exactly the invented project the change was meant to stop. | High | Screenshot after the change | Fixed |
| C5 | **`trackOf` in `catalog.test.ts` classified every `comp-` step as academic.** Cross-track dependency checking therefore did not cover the new track at all. | Medium | Adding the track | Fixed |

## Repo scanner — `lib/scan/`

| # | Bug | Severity | Found by | Status |
|---|---|---|---|---|
| S1 | **Production had no way to load any project.** `/api/scan` reads the host filesystem and 404s in production by design, and it was the only ingest path. A deployed DevCon could scan nothing; the three sample profiles were all it could ever render. | **Critical** | Asked how a real repo gets in | Fixed |
| S2 | **The old walk found one `.env` and missed four.** On the vespor monorepo it reported 1 file as never-read; the rewritten scanner reports 5, including `frontend/.env.local` and `database/.env`. The privacy rule was being enforced on a file list that did not include everything it should have. | High | Comparing digests after the refactor | Fixed |
| S3 | **`droppedCoverage` misreported a flat directory drop as manifest-only.** It checked the path *after* stripping the chosen folder's name, so a repo with no subdirectories lost its only signal and the UI wrongly warned that completion detection was unavailable. | Medium | Its own unit test | Fixed |

## Feature Registry — `lib/registry/`

| # | Bug | Severity | Found by | Status |
|---|---|---|---|---|
| R1 | **The annotation parser ignored `// @feature`.** The regex required a `*` prefix, so only block comments worked — and the single-line form is the convenient one the spec's own example implies. | High | Its own unit test | Fixed |
| R2 | **The two stores disagreed about the same event.** `MemoryRegistryStore` recorded accepting a suggestion as a plain `updated`; `LocalRegistryStore` recorded `accepted`. A fake that behaves differently from the real store tests the fake — which my own comment in that file said must not happen. | High | Its own unit test | Fixed |
| R3 | **Dead branch in the annotation parser.** An explicit check for the closing comment delimiter could never fire, because the tag regex requires an `@` and a delimiter line has none. | Low | Mutation testing | Fixed |
| R4 | **A `@feature` inside a string literal is picked up.** Scanning this repo reports `Authentication` as *annotated* — from a string in `test/registry.test.ts`. Regex parsing was chosen deliberately so annotations work in a browser tab against a folder handle; an AST parser is the only real fix and costs more than the precision is worth. | Low | Scanning this repo | **Won't fix** — documented in the parser |

## UI

| # | Bug | Severity | Status |
|---|---|---|---|
| U1 | **Docs sidebar opened by default and covered the right of the canvas** before anyone had a reason to want it. | Low | Fixed |
| U2 | **The workspace reserved the sidebar's 312px gutter even when hidden**, leaving a dead strip down the right. | Low | Fixed |
| U3 | **Mojibake in the verification demo** — `text/html` served without a charset, so the browser guessed Latin-1 and em dashes rendered as `â€"`. Not a DevCon bug; listed because it is the class of fault `comp-guard-happy-path` should arguably catch and does not. It looked fine in `curl` and wrong on screen. | — | Fixed in the scratch demo; catalog gap **Open** |

## Test-suite defects

Bugs in the tests themselves. All found by mutation testing — breaking the
implementation and checking a test noticed. Every one of these was a **green
test protecting nothing**.

| # | Defect | Feature | Status |
|---|---|---|---|
| T1 | **Four MCP assertions were vacuous.** Every shipped MCP server is remote, so the stdio env path, the `--env` argument ordering, the `--` separator and the populated branch of `mcpKeysNeeded` were never exercised. `.every()` on an empty array is true and two empty sets are equal. Rewritten against synthetic providers. | MCP config | Fixed |
| T2 | **The `createdAt` test passed against a store that overwrote it.** Both writes landed in the same millisecond, so preserved and overwritten compared equal. Now pins an explicit past date. | Registry store | Fixed |
| T3 | **The migration-count test agreed with the wrong implementation.** Every fixture migration directory held exactly one file, so counting files and counting directories gave the same answer. | Digest builder | Fixed |
| T4 | **`providerByCapability` was tested with no two providers sharing a capability**, so first-wins and last-wins were indistinguishable. | Integrations store | Fixed |
| T5 | **`comp-avoid-payments` was unreachable** — no fixture set `needs.payments`, so the anti-step was dead catalog no test could select. | Competition track | Fixed |

## Process failures

Mine, during this work. Recorded because each cost real time and each has a
rule that prevents it.

| # | What happened | Rule |
|---|---|---|
| X1 | `git checkout <file>` inside a mutation-testing script **discarded all my uncommitted work** on that file, twice. The script only meant to revert the mutation. | Never `git checkout` a file with uncommitted changes. Snapshot with `cp` first. |
| X2 | `for f in $FILES` **does not word-split in zsh.** The backup loop silently backed up nothing and every "restore" was a no-op, so eight mutations accumulated on top of each other and corrupted seven files. | Snapshot the whole directory with `cp -R`, and check the baseline still passes after each restore. |
| X3 | Two backup paths **collided on `basename`** — `modules/feature.ts` and `detect/feature.ts` both wrote `feature.ts.bak`, so restoring overwrote one file with the other's contents. | Preserve the directory structure in backup paths. |
| X4 | A `*/` inside a JSDoc comment **terminated the comment early** and broke the file. | Don't write a comment delimiter inside a comment. |

---

## Open items, in priority order

1. **U3 — nothing in the catalog checks the demo actually renders.**
   `comp-guard-happy-path` covers crashes, `comp-demo-environment` covers the
   machine. Neither catches "it works and looks wrong on a projector".
2. **R4 — annotation false positives in string literals.** Accepted cost of
   regex parsing; revisit only if it becomes noisy in practice.

## What this report is evidence of

Every "Fixed" above was found by running something, not by reading it. The
three biggest — P2, M1, C1 — had all shipped and all passed a green test
suite. They were found by generating the prompts and reading them, by checking
the MCP output against vendor docs, and by asking whether a documented plan
step was actually possible.

That is the same argument the project makes about itself: **nothing is verified
until it has been run.** See `features.md` for what is built and
`docs/gaps-plan.md` for what that still does not prove.

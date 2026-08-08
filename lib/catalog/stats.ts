import { ALL_STEPS } from "./index";
import { CAPABILITY_ORDER, PROVIDERS } from "./providers";
import { executionOf, verificationState } from "./types";

/**
 * Every countable fact about the catalog, in one place.
 *
 * The docs page reads this, and `scripts/sync-docs.ts` writes it into the
 * markdown. Before it existed the same numbers were typed into README.md,
 * HANDOFF.md and the docs page independently, and they disagreed: the README
 * claimed 209 tests and "4 of 62 prompts" long after both had moved.
 *
 * Nothing here is hand-maintained. Adding a step changes every surface at once
 * or fails the suite trying.
 */

/**
 * Track from the id prefix.
 *
 * There is no `track` field, because `applies_when` is the real gate and a
 * second source of truth would drift from it. `comp-` MUST be tested before
 * `c-`: "comp-repo".startsWith("c-") is false, but relying on that is the kind
 * of thing that breaks when someone renames a prefix.
 */
function trackOf(id: string): "academic" | "competition" | "commercial" {
  if (id.startsWith("comp-")) return "competition";
  if (id.startsWith("c-")) return "commercial";
  return "academic";
}

const doSteps = ALL_STEPS.filter((s) => s.kind === "do");
const antiSteps = ALL_STEPS.filter((s) => s.kind === "avoid");
const verification = doSteps.map(verificationState);

const perTrack = (track: ReturnType<typeof trackOf>) => {
  const mine = doSteps.filter((s) => trackOf(s.id) === track);
  const human = mine.filter((s) => executionOf(s) === "human").length;
  const needsInput = mine.filter(
    (s) => executionOf(s) === "needs-input",
  ).length;
  return {
    do: mine.length,
    anti: antiSteps.filter((s) => trackOf(s.id) === track).length,
    human,
    needsInput,
    /**
     * Steps that are NOT plain `agent`.
     *
     * `features.md` calls these "classified by execution mode", which is the
     * work of deciding a step has no agent-shaped version. An `agent` step is
     * the default and required no decision, so counting it would inflate the
     * number that measures the decision.
     */
    classified: human + needsInput,
  };
};

const academic = perTrack("academic");
const competition = perTrack("competition");
const commercial = perTrack("commercial");

export const CATALOG_STATS = {
  doSteps: doSteps.length,
  antiSteps: antiSteps.length,
  providers: PROVIDERS.length,
  mcpServers: PROVIDERS.filter((p) => p.mcp_server).length,
  capabilities: CAPABILITY_ORDER.length,

  verified: verification.filter((v) => v === "verified").length,
  partial: verification.filter((v) => v === "partial").length,
  unverified: verification.filter((v) => v === "unverified").length,

  agent: doSteps.filter((s) => executionOf(s) === "agent").length,
  needsInput: doSteps.filter((s) => executionOf(s) === "needs-input").length,
  human: doSteps.filter((s) => executionOf(s) === "human").length,

  /** Steps declaring which capability they wire up — drives the canvas edges. */
  servesTagged: ALL_STEPS.filter((s) => s.serves?.length).length,

  academicDo: academic.do,
  academicAnti: academic.anti,
  academicClassified: academic.classified,
  competitionDo: competition.do,
  competitionAnti: competition.anti,
  competitionClassified: competition.classified,
  commercialDo: commercial.do,
  commercialAnti: commercial.anti,
  commercialClassified: commercial.classified,
  commercialHuman: commercial.human,
  commercialNeedsInput: commercial.needsInput,
} as const;

export type CatalogStatKey = keyof typeof CATALOG_STATS;

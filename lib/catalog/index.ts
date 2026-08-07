import type { Capability } from "./providers";
import { ACADEMIC_STEPS } from "./steps/academic";
import { COMMERCIAL_STEPS } from "./steps/commercial";
import { COMPETITION_STEPS } from "./steps/competition";
import type { Step } from "./types";

/**
 * The whole catalog, across every track.
 *
 * Tracks are separate FILES, not separate catalogs — selection is still one
 * pass over one list, gated by the `context` predicate on each step. Forking
 * the engine per track is the failure mode this arrangement exists to avoid.
 */
export const ALL_STEPS: Step[] = [
  ...ACADEMIC_STEPS,
  ...COMPETITION_STEPS,
  ...COMMERCIAL_STEPS,
];

/**
 * Capabilities some step in the catalog actually wires up.
 *
 * Exists to tell two different silences apart on the canvas. A connected
 * service that no step in *this plan* uses is normal — you connected Stripe and
 * this project takes no payments. A capability no step in the *catalog* serves
 * is a gap in DevCon, and saying "no step in this plan uses it" about it is a
 * quiet lie: no plan will ever use it.
 *
 * `project-management` is the live case. Connect Linear and its node draws no
 * edges, because nothing in any track wires up a tracker.
 */
export function capabilitiesServed(steps: Step[] = ALL_STEPS): Set<Capability> {
  const served = new Set<Capability>();
  for (const step of steps) {
    for (const cap of step.serves ?? []) served.add(cap);
  }
  return served;
}

/** True when no step anywhere in the catalog wires this capability up. */
export function isUnservedCapability(
  capability: Capability,
  steps: Step[] = ALL_STEPS,
): boolean {
  return !capabilitiesServed(steps).has(capability);
}

export interface CatalogProblem {
  stepId: string;
  problem: string;
}

/**
 * Catalog invariants. Run by the tests, and cheap enough to run at import.
 *
 * These are the rules from the plan's rubric that a machine can check — the
 * ones it can't (is the prompt any good?) still need a human.
 */
export function validateCatalog(steps: Step[] = ALL_STEPS): CatalogProblem[] {
  const problems: CatalogProblem[] = [];
  const byId = new Map<string, Step>();

  for (const step of steps) {
    if (byId.has(step.id)) {
      problems.push({ stepId: step.id, problem: "duplicate id" });
    }
    byId.set(step.id, step);
  }

  for (const step of steps) {
    for (const dep of step.requires) {
      if (!byId.has(dep)) {
        problems.push({
          stepId: step.id,
          problem: `requires "${dep}", which doesn't exist`,
        });
      }
    }

    if (step.kind === "do" && step.done_when.length === 0) {
      problems.push({ stepId: step.id, problem: "no done_when" });
    }

    if (step.kind === "avoid" && step.done_when.length > 0) {
      problems.push({
        stepId: step.id,
        problem: "anti-step has done_when — there is nothing to complete",
      });
    }

    if (step.kind === "avoid" && step.requires.length > 0) {
      problems.push({
        stepId: step.id,
        problem: "anti-step has dependencies — it isn't work",
      });
    }

    if (!step.why.trim()) {
      problems.push({ stepId: step.id, problem: "no why" });
    }
  }

  // Cycle detection, so a bad `requires` chain fails loudly at build rather
  // than throwing from orderSteps at render time.
  const state = new Map<string, "visiting" | "done">();
  const visit = (step: Step, trail: string[]): void => {
    const s = state.get(step.id);
    if (s === "done") return;
    if (s === "visiting") {
      problems.push({
        stepId: step.id,
        problem: `dependency cycle: ${[...trail, step.id].join(" → ")}`,
      });
      return;
    }
    state.set(step.id, "visiting");
    for (const dep of step.requires) {
      const next = byId.get(dep);
      if (next) visit(next, [...trail, step.id]);
    }
    state.set(step.id, "done");
  };
  for (const step of steps) visit(step, []);

  return problems;
}

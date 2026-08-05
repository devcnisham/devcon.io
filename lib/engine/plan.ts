import { ALL_STEPS } from "../catalog";
import type { HiddenStep, Plan, ProjectProfile, Step } from "../catalog/types";
import { explainHidden } from "./explain";
import { orderSteps } from "./order";

/**
 * Build a plan from a profile.
 *
 * Pure. No I/O, no database, no LLM. Same profile in, byte-identical plan out.
 * That determinism is what lets the UI render real plans before any backend
 * exists — and what makes the per-step telemetry loop meaningful later.
 */
export function buildPlan(
  profile: ProjectProfile,
  catalog: Step[] = ALL_STEPS,
): Plan {
  const selected: Step[] = [];
  const hidden: HiddenStep[] = [];

  for (const step of catalog) {
    if (step.applies_when.test(profile)) {
      selected.push(step);
    } else {
      hidden.push({ step, reason: explainHidden(step.applies_when, profile) });
    }
  }

  // Anti-steps carry no dependencies and are not work, so they never
  // participate in ordering — they attach to a phase and render as callouts.
  const doSteps = selected.filter((s) => s.kind === "do");
  const antiSteps = selected.filter((s) => s.kind === "avoid");

  return {
    steps: orderSteps(doSteps),
    antiSteps,
    hidden,
  };
}

/** Total estimated minutes of work in a plan. */
export function planMinutes(plan: Plan): number {
  return plan.steps.reduce((sum, s) => sum + s.est_minutes, 0);
}

/**
 * Progress by weight, never by step count.
 *
 * A 6-hour report and a 20-minute README are not one unit each. Counting them
 * equally makes the pacing indicator lie in the direction that hurts most:
 * it reads "on track" right up until the work that actually takes time.
 */
export function progressByWeight(plan: Plan, completed: Set<string>): number {
  const total = planMinutes(plan);
  if (total === 0) return 0;
  const done = plan.steps
    .filter((s) => completed.has(s.id))
    .reduce((sum, s) => sum + s.est_minutes, 0);
  return done / total;
}

/** Share of available marks covered by completed steps. */
export function marksEarned(plan: Plan, completed: Set<string>): number {
  return plan.steps
    .filter((s) => completed.has(s.id))
    .reduce((sum, s) => sum + (s.mark_weight ?? 0), 0);
}

export function marksAvailable(plan: Plan): number {
  return plan.steps.reduce((sum, s) => sum + (s.mark_weight ?? 0), 0);
}

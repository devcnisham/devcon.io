import type { DevconEvent } from "./events";

/**
 * Per-step funnel and the catalog fix ranking derived from it.
 *
 * Pure functions over an event list — same input, same output, no I/O. The
 * whole improvement loop depends on this being deterministic, because a
 * ranking that shifts on its own is a ranking nobody trusts.
 */

export interface StepFunnel {
  stepId: string;
  reached: number;
  opened: number;
  copied: number;
  completed: number;
  stuck: number;
  skipped: number;
  /**
   * Copied the prompt but never completed the step.
   *
   * The most diagnostic number in the product: it means the person had the
   * prompt in hand, went to do the work, and it didn't land. That is a broken
   * prompt or a broken step — not a user who lost interest.
   */
  copiedNotCompleted: number;
  /** Median ms from copy to completion, for the ones that did complete. */
  medianCopyToComplete: number | null;
}

export interface FunnelSummary {
  projects: number;
  plansGenerated: number;
  shipped: number;
  /** The north star. Of projects that got a plan, how many shipped. */
  shipRate: number;
  drawerExpandRate: number;
  steps: StepFunnel[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function buildFunnel(events: DevconEvent[]): FunnelSummary {
  const projects = new Set(events.map((e) => e.project));
  const plansGenerated = new Set(
    events.filter((e) => e.type === "plan_generated").map((e) => e.project),
  );
  const shipped = new Set(
    events.filter((e) => e.type === "shipped").map((e) => e.project),
  );
  const drawerProjects = new Set(
    events.filter((e) => e.type === "drawer_expanded").map((e) => e.project),
  );

  // Group per (project, step) so counts are of distinct attempts rather than
  // clicks — copying the same prompt three times is one attempt, not three.
  const byStep = new Map<string, Map<string, DevconEvent[]>>();
  for (const e of events) {
    if (!e.stepId) continue;
    const perProject = byStep.get(e.stepId) ?? new Map();
    const list = perProject.get(e.project) ?? [];
    list.push(e);
    perProject.set(e.project, list);
    byStep.set(e.stepId, perProject);
  }

  const steps: StepFunnel[] = [];

  for (const [stepId, perProject] of byStep) {
    let reached = 0;
    let opened = 0;
    let copied = 0;
    let completed = 0;
    let stuck = 0;
    let skipped = 0;
    let copiedNotCompleted = 0;
    const durations: number[] = [];

    for (const list of perProject.values()) {
      const has = (t: DevconEvent["type"]) => list.some((e) => e.type === t);
      const first = (t: DevconEvent["type"]) =>
        list.filter((e) => e.type === t).sort((a, b) => a.ts - b.ts)[0];

      if (has("step_reached")) reached++;
      if (has("step_opened")) opened++;
      if (has("step_skipped")) skipped++;
      stuck += list.filter((e) => e.type === "step_stuck").length;

      const didCopy = has("prompt_copied");
      const didComplete = has("step_completed");
      if (didCopy) copied++;
      if (didComplete) completed++;
      if (didCopy && !didComplete) copiedNotCompleted++;

      if (didCopy && didComplete) {
        const c = first("prompt_copied");
        const d = first("step_completed");
        if (c && d && d.ts > c.ts) durations.push(d.ts - c.ts);
      }
    }

    steps.push({
      stepId,
      reached,
      opened,
      copied,
      completed,
      stuck,
      skipped,
      copiedNotCompleted,
      medianCopyToComplete: median(durations),
    });
  }

  return {
    projects: projects.size,
    plansGenerated: plansGenerated.size,
    shipped: shipped.size,
    shipRate: plansGenerated.size ? shipped.size / plansGenerated.size : 0,
    drawerExpandRate: plansGenerated.size
      ? drawerProjects.size / plansGenerated.size
      : 0,
    steps: steps.sort((a, b) => b.reached - a.reached),
  };
}

export interface CatalogIssue {
  stepId: string;
  score: number;
  reason: string;
  sample: number;
}

/**
 * Rank steps most likely to be broken.
 *
 * This is the flywheel from the plan: drop-off in, ranked fix list out. It
 * weights copy-without-completion highest because that is the clearest
 * evidence the *step* failed rather than the person — they had the prompt and
 * it still didn't land.
 *
 * `minSample` exists so one person's bad afternoon can't top the list.
 */
export function rankCatalogIssues(
  summary: FunnelSummary,
  minSample = 3,
): CatalogIssue[] {
  const issues: CatalogIssue[] = [];

  for (const s of summary.steps) {
    if (s.reached < minSample) continue;

    const copyFailRate = s.copied ? s.copiedNotCompleted / s.copied : 0;
    const stuckRate = s.reached ? s.stuck / s.reached : 0;
    const skipRate = s.reached ? s.skipped / s.reached : 0;
    const openRate = s.reached ? s.opened / s.reached : 0;

    /**
     * "Nobody opened it" only means something if nobody acted on it either.
     *
     * Copying or completing IS engagement — the title plainly earned
     * attention. Counting a low open rate against a step people copied and
     * finished flagged working steps as broken, and `step_opened` only fires
     * in the Prompts section anyway, so anyone completing from the task list
     * or the NOW card would trip it. That would fill the fix list with noise
     * and make the one list that's supposed to be evidence-ranked untrusted.
     */
    const engaged = s.copied > 0 || s.completed > 0;
    const ignoredPenalty = engaged ? 0 : (1 - openRate) * 0.5;

    // Copy-without-completion dominates: it is the least ambiguous signal.
    const score =
      copyFailRate * 3 + stuckRate * 2 + skipRate * 1.5 + ignoredPenalty;

    if (score < 0.15) continue;

    const reason =
      copyFailRate > 0.4
        ? `${Math.round(copyFailRate * 100)}% copied the prompt but never finished — the prompt probably doesn't work`
        : stuckRate > 0.3
          ? `${Math.round(stuckRate * 100)}% got stuck — the step is unclear or wrong`
          : skipRate > 0.3
            ? `${Math.round(skipRate * 100)}% skipped it — it may not belong in this plan`
            : `${Math.round((1 - openRate) * 100)}% never opened it — the title isn't earning attention`;

    issues.push({ stepId: s.stepId, score, reason, sample: s.reached });
  }

  return issues.sort((a, b) => b.score - a.score);
}

/**
 * Steps users un-hid.
 *
 * A step that gets un-hidden repeatedly has a wrong `applies_when` predicate.
 * This is a catalog bug report generated without anyone filing one.
 */
export function unhiddenSteps(
  events: DevconEvent[],
): { stepId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "step_unhidden" || !e.stepId) continue;
    counts.set(e.stepId, (counts.get(e.stepId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([stepId, count]) => ({ stepId, count }))
    .sort((a, b) => b.count - a.count);
}

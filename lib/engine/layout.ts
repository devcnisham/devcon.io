import type { Step } from "../catalog/types";

export interface Positioned {
  step: Step;
  x: number;
  y: number;
  depth: number;
}

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 150;

/**
 * Layer the DAG by longest-path depth from its roots.
 *
 * Depth — not phase — drives the columns, because depth is what actually
 * describes "can this start yet". Two steps at the same depth are genuinely
 * parallelisable, which is the same computation that powers "three steps are
 * unblocked, take one each".
 */
export function layoutSteps(steps: Step[]): Positioned[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const depths = new Map<string, number>();

  const depthOf = (step: Step, trail: Set<string>): number => {
    const cached = depths.get(step.id);
    if (cached !== undefined) return cached;
    if (trail.has(step.id)) return 0; // cycles are caught in orderSteps

    const next = new Set(trail).add(step.id);
    const deps = step.requires
      .map((id) => byId.get(id))
      .filter((s): s is Step => s !== undefined);

    const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((s) => depthOf(s, next)));
    depths.set(step.id, d);
    return d;
  };

  for (const step of steps) depthOf(step, new Set());

  // Stable slot assignment: steps keep the order the engine already sorted them
  // into, so layout never reshuffles between renders.
  const slotCursor = new Map<number, number>();
  const widthAt = new Map<number, number>();
  for (const step of steps) {
    const d = depths.get(step.id) ?? 0;
    widthAt.set(d, (widthAt.get(d) ?? 0) + 1);
  }

  // Flows top-to-bottom: depth is the row, siblings spread across it.
  //
  // A plan's dependency chain is mostly linear, so depth-as-columns produces
  // one very wide strip that fits to nothing on screen. Depth-as-rows reads
  // like a plan and keeps parallel work visibly side by side.
  return steps.map((step) => {
    const depth = depths.get(step.id) ?? 0;
    const slot = slotCursor.get(depth) ?? 0;
    slotCursor.set(depth, slot + 1);

    const rowWidth = widthAt.get(depth) ?? 1;
    const offset = (slot - (rowWidth - 1) / 2) * COLUMN_WIDTH;

    return { step, depth, x: offset, y: depth * ROW_HEIGHT };
  });
}

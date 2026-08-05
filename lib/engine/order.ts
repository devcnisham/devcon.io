import { PHASE_ORDER, type Step } from "../catalog/types";

/**
 * Topological sort over `requires`, tie-broken by (phase, weight, id).
 *
 * The `id` tiebreak is not cosmetic. Without it, ordering silently depends on
 * array/file-read order, which means the determinism test passes locally and
 * fails in CI — or worse, passes everywhere and produces different plans for
 * the same profile on different machines.
 *
 * Throws on a dependency cycle. A cycle is a catalog bug, not a runtime
 * condition to recover from.
 */
export function orderSteps(steps: Step[]): Step[] {
  const byId = new Map(steps.map((s) => [s.id, s]));

  const rank = (s: Step): [number, number, string] => [
    PHASE_ORDER.indexOf(s.phase),
    s.weight,
    s.id,
  ];

  const compare = (a: Step, b: Step): number => {
    const [ap, aw, ai] = rank(a);
    const [bp, bw, bi] = rank(b);
    if (ap !== bp) return ap - bp;
    if (aw !== bw) return aw - bw;
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  };

  const sorted = [...steps].sort(compare);

  const result: Step[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();

  const visit = (step: Step, trail: string[]): void => {
    if (placed.has(step.id)) return;
    if (visiting.has(step.id)) {
      throw new Error(
        `Dependency cycle in catalog: ${[...trail, step.id].join(" → ")}`,
      );
    }
    visiting.add(step.id);

    // Dependencies first, themselves in deterministic order.
    const deps = step.requires
      .map((id) => byId.get(id))
      .filter((s): s is Step => s !== undefined)
      .sort(compare);

    for (const dep of deps) visit(dep, [...trail, step.id]);

    visiting.delete(step.id);
    placed.add(step.id);
    result.push(step);
  };

  for (const step of sorted) visit(step, []);

  return result;
}

/**
 * Steps whose dependencies are all satisfied — i.e. workable right now.
 *
 * Teams see "these are unblocked, take one each". Solo sees the same
 * computation inverted: "nothing else starts until X finishes".
 */
export function unblockedSteps(steps: Step[], completed: Set<string>): Step[] {
  return steps.filter(
    (s) =>
      !completed.has(s.id) && s.requires.every((dep) => completed.has(dep)),
  );
}

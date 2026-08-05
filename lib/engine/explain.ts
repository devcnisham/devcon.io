import type { Condition, ProjectProfile } from "../catalog/types";

/**
 * Walk a condition tree and return the specific leaf that caused failure.
 *
 * This is what makes the hidden-steps drawer honest: the reason shown is the
 * actual failed predicate, generated, never hand-written. Hand-written reason
 * strings rot the moment a predicate changes and nobody notices.
 *
 * Returns null when the condition passes.
 */
export function firstFailure(
  cond: Condition,
  p: ProjectProfile,
): Condition | null {
  if (cond.test(p)) return null;

  switch (cond.kind) {
    case "leaf":
      return cond;

    case "all":
      // The first failing child is the reason the whole thing failed.
      for (const child of cond.children ?? []) {
        const failure = firstFailure(child, p);
        if (failure) return failure;
      }
      return cond;

    case "any":
      // Every child failed. Report the first — listing all of them produces
      // unreadable copy like "A and B and C and D".
      return firstFailure(cond.children?.[0] ?? cond, p) ?? cond;

    case "not":
      // `not(X)` failed means X passed. The reason is X's positive reading,
      // which is exactly what `not.describeFail()` returns.
      return cond;
  }
}

/** Human-readable reason a step was hidden. Always non-empty. */
export function explainHidden(cond: Condition, p: ProjectProfile): string {
  const failure = firstFailure(cond, p);
  if (!failure) return "this step applies to your project";
  return failure.describeFail();
}

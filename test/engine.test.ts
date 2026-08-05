import { describe, expect, it } from "vitest";
import { ALL_STEPS } from "@/lib/catalog";
import {
  all,
  any,
  context,
  isGroup,
  needs,
  not,
} from "@/lib/catalog/conditions";
import type { Step } from "@/lib/catalog/types";
import { explainHidden, firstFailure } from "@/lib/engine/explain";
import { orderSteps, unblockedSteps } from "@/lib/engine/order";
import { buildPlan } from "@/lib/engine/plan";
import { ALL_FIXTURES, COMMERCIAL_SAAS } from "./fixtures";

const FINAL_YEAR = ALL_FIXTURES.FINAL_YEAR_SOLO;

describe("selection", () => {
  it("returns only steps whose predicate passes", () => {
    const plan = buildPlan(COMMERCIAL_SAAS);
    for (const step of [...plan.steps, ...plan.antiSteps]) {
      expect(step.applies_when.test(COMMERCIAL_SAAS)).toBe(true);
    }
  });

  it("hides every step whose predicate fails, and loses none", () => {
    const plan = buildPlan(COMMERCIAL_SAAS);
    const total = plan.steps.length + plan.antiSteps.length + plan.hidden.length;
    // Nothing may vanish: selected + hidden must account for the whole catalog.
    expect(total).toBe(ALL_STEPS.length);
  });

  it("keeps tracks apart — a commercial profile selects no academic steps", () => {
    const plan = buildPlan(COMMERCIAL_SAAS);
    const leaked = [...plan.steps, ...plan.antiSteps].filter(
      (s) => !s.id.startsWith("c-"),
    );
    expect(leaked.map((s) => s.id)).toEqual([]);
  });

  it("separates anti-steps from work", () => {
    const plan = buildPlan(COMMERCIAL_SAAS);
    expect(plan.steps.every((s) => s.kind === "do")).toBe(true);
    expect(plan.antiSteps.every((s) => s.kind === "avoid")).toBe(true);
  });
});

describe("determinism", () => {
  it("produces an identical plan for the same profile", () => {
    /**
     * The whole improvement loop assumes a stable plan: telemetry compares
     * runs, and a plan that reorders on its own makes drop-off meaningless.
     */
    const a = buildPlan(FINAL_YEAR);
    const b = buildPlan(FINAL_YEAR);
    expect(a.steps.map((s) => s.id)).toEqual(b.steps.map((s) => s.id));
    expect(a.hidden.map((h) => h.step.id)).toEqual(
      b.hidden.map((h) => h.step.id),
    );
  });

  it("does not depend on catalog input order", () => {
    const shuffled = [...ALL_STEPS].reverse();
    const normal = buildPlan(FINAL_YEAR, ALL_STEPS);
    const reversed = buildPlan(FINAL_YEAR, shuffled);
    expect(reversed.steps.map((s) => s.id)).toEqual(
      normal.steps.map((s) => s.id),
    );
  });

  it("breaks (phase, weight) ties on id, regardless of input order", () => {
    /**
     * The test above does NOT cover this, and mutation-testing proved it:
     * deleting the id tie-break left all other tests green. Within a single
     * plan no two real steps currently share a (phase, weight) — the
     * collisions are across tracks, and only one track is ever selected — so
     * the tie-break is never exercised by catalog data.
     *
     * It still has to hold. The moment two steps in one track share a weight,
     * plan order would start tracking array order, which means differing
     * plans on different machines for the same profile.
     */
    const tied: Step[] = ["c-zebra", "c-alpha", "c-mango"].map((id) => ({
      ...ALL_STEPS[0],
      id,
      kind: "do" as const,
      phase: "core" as const,
      weight: 5,
      requires: [],
    }));

    const forward = orderSteps(tied).map((s) => s.id);
    const backward = orderSteps([...tied].reverse()).map((s) => s.id);

    expect(forward).toEqual(["c-alpha", "c-mango", "c-zebra"]);
    expect(backward).toEqual(forward);
  });
});

describe("ordering", () => {
  it("always places a dependency before its dependent", () => {
    for (const profile of Object.values(ALL_FIXTURES)) {
      const plan = buildPlan(profile);
      const position = new Map(plan.steps.map((s, i) => [s.id, i]));
      for (const step of plan.steps) {
        for (const dep of step.requires) {
          const depIndex = position.get(dep);
          if (depIndex === undefined) continue; // dependency hidden for this profile
          expect(depIndex).toBeLessThan(position.get(step.id) as number);
        }
      }
    }
  });

  it("throws on a dependency cycle rather than looping", () => {
    const cyclic: Step[] = [
      { ...ALL_STEPS[0], id: "a", requires: ["b"], kind: "do" },
      { ...ALL_STEPS[0], id: "b", requires: ["a"], kind: "do" },
    ];
    expect(() => orderSteps(cyclic)).toThrow(/cycle/i);
  });

  it("reports steps with satisfied dependencies as unblocked", () => {
    const plan = buildPlan(FINAL_YEAR);
    const none = unblockedSteps(plan.steps, new Set());
    // With nothing complete, exactly the dependency-free steps are workable.
    expect(none.every((s) => s.requires.length === 0)).toBe(true);
    expect(none.length).toBeGreaterThan(0);
  });

  it("unblocks a dependent once its dependency completes", () => {
    const plan = buildPlan(FINAL_YEAR);
    const dependent = plan.steps.find((s) => s.requires.length === 1);
    if (!dependent) return;
    const before = unblockedSteps(plan.steps, new Set());
    expect(before.map((s) => s.id)).not.toContain(dependent.id);

    const after = unblockedSteps(plan.steps, new Set(dependent.requires));
    expect(after.map((s) => s.id)).toContain(dependent.id);
  });
});

describe("explain — the trust feature", () => {
  it("gives every hidden step a non-empty, human-readable reason", () => {
    /**
     * A step hidden without a reason is a bug: the hidden drawer is the whole
     * argument that subtraction is judgment rather than concealment.
     */
    for (const profile of Object.values(ALL_FIXTURES)) {
      const plan = buildPlan(profile);
      for (const { step, reason } of plan.hidden) {
        expect(reason, `${step.id} hidden with no reason`).toBeTruthy();
        expect(reason.trim().length).toBeGreaterThan(3);
      }
    }
  });

  it("never returns a placeholder or a raw field name", () => {
    const plan = buildPlan(COMMERCIAL_SAAS);
    for (const { reason } of plan.hidden) {
      expect(reason).not.toMatch(/undefined|null|\[object|applies_when|_/);
    }
  });

  it("names the specific leaf that failed, not the whole tree", () => {
    // needs("payments") is the failing leaf; context passes.
    const cond = all(context("commercial"), needs("payments"));
    const failure = firstFailure(cond, {
      ...COMMERCIAL_SAAS,
      needs: { ...COMMERCIAL_SAAS.needs, payments: false },
    });
    expect(failure?.kind).toBe("leaf");
    expect(failure?.describeFail()).toMatch(/payments/i);
  });

  it("returns null when the condition passes", () => {
    expect(firstFailure(context("commercial"), COMMERCIAL_SAAS)).toBeNull();
  });
});

describe("condition DSL", () => {
  it("all() fails if any child fails", () => {
    const cond = all(context("commercial"), needs("realtime"));
    expect(cond.test(COMMERCIAL_SAAS)).toBe(false);
  });

  it("any() passes if one child passes", () => {
    const cond = any(needs("realtime"), needs("payments"));
    expect(cond.test(COMMERCIAL_SAAS)).toBe(true);
  });

  it("not() inverts, and its failure reads as the positive", () => {
    const cond = not(needs("payments"));
    expect(cond.test(COMMERCIAL_SAAS)).toBe(false);
    expect(explainHidden(cond, COMMERCIAL_SAAS)).toMatch(/takes payments/i);
  });

  it("describe and describeFail are distinct and both non-empty", () => {
    for (const cond of [context("academic"), needs("auth"), isGroup()]) {
      expect(cond.describe().trim()).toBeTruthy();
      expect(cond.describeFail().trim()).toBeTruthy();
      expect(cond.describe()).not.toBe(cond.describeFail());
    }
  });
});

describe("profile drives the plan", () => {
  it("adds payment steps when payments are needed", () => {
    const without = buildPlan({
      ...COMMERCIAL_SAAS,
      needs: { ...COMMERCIAL_SAAS.needs, payments: false },
    });
    const with_ = buildPlan(COMMERCIAL_SAAS);
    expect(with_.steps.length).toBeGreaterThan(without.steps.length);
    expect(without.steps.map((s) => s.id)).not.toContain("c-payments-webhooks");
    expect(with_.steps.map((s) => s.id)).toContain("c-payments-webhooks");
  });

  it("adds group-only steps when the group grows", () => {
    const solo = buildPlan(FINAL_YEAR);
    const group = buildPlan({
      ...FINAL_YEAR,
      academic: { ...FINAL_YEAR.academic, group_size: 4 },
    });
    expect(solo.steps.map((s) => s.id)).not.toContain("module-ownership");
    expect(group.steps.map((s) => s.id)).toContain("module-ownership");
  });

  it("drops report steps when the brief doesn't ask for one", () => {
    const noReport = buildPlan({
      ...FINAL_YEAR,
      academic: { ...FINAL_YEAR.academic, deliverables: ["code"] },
    });
    expect(noReport.steps.map((s) => s.id)).not.toContain("project-report");
    expect(noReport.hidden.map((h) => h.step.id)).toContain("project-report");
  });
});

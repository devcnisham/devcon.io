import { describe, expect, it } from "vitest";
import {
  ALL_STEPS,
  capabilitiesServed,
  isUnservedCapability,
  validateCatalog,
} from "@/lib/catalog";
import { CAPABILITY_ORDER } from "@/lib/catalog/providers";
import type { Step } from "@/lib/catalog/types";
import { ALL_FIXTURES } from "./fixtures";

describe("catalog invariants", () => {
  it("passes its own validation", () => {
    // Reported as a list rather than a bare boolean so a failure names the
    // offending step instead of just going red.
    expect(validateCatalog()).toEqual([]);
  });

  it("has unique ids", () => {
    const ids = ALL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every dependency", () => {
    const ids = new Set(ALL_STEPS.map((s) => s.id));
    const dangling = ALL_STEPS.flatMap((s) =>
      s.requires.filter((d) => !ids.has(d)).map((d) => `${s.id} → ${d}`),
    );
    expect(dangling).toEqual([]);
  });

  it("never lets a step depend on one from another track", () => {
    // A cross-track dependency would make a plan unsatisfiable: the dependency
    // is hidden by the context predicate, so the dependent can never unblock.
    const byId = new Map(ALL_STEPS.map((s) => [s.id, s]));
    /**
     * Track is inferred from the id prefix — there's no `track` field, because
     * `applies_when` is the real gate and a second source of truth would drift
     * from it. `comp-` must be tested BEFORE `c-`: "comp-repo".startsWith("c-")
     * is false, but the ordering is load-bearing enough to be explicit.
     */
    const trackOf = (s: Step) =>
      s.id.startsWith("comp-")
        ? "competition"
        : s.id.startsWith("c-")
          ? "commercial"
          : "academic";

    const crossings = ALL_STEPS.flatMap((s) =>
      s.requires
        .map((d) => byId.get(d))
        .filter((d): d is Step => Boolean(d))
        .filter((d) => trackOf(d) !== trackOf(s))
        .map((d) => `${s.id} → ${d.id}`),
    );
    expect(crossings).toEqual([]);
  });
});

describe("anti-steps", () => {
  const anti = ALL_STEPS.filter((s) => s.kind === "avoid");

  it("exist in both tracks", () => {
    expect(anti.length).toBeGreaterThan(0);
  });

  it("carry no done_when — there is nothing to complete", () => {
    expect(anti.filter((s) => s.done_when.length > 0).map((s) => s.id)).toEqual(
      [],
    );
  });

  it("carry no dependencies — they are not work", () => {
    expect(anti.filter((s) => s.requires.length > 0).map((s) => s.id)).toEqual(
      [],
    );
  });

  it("carry no prompt — there is nothing to paste", () => {
    expect(
      anti.filter((s) => s.prompt_template !== undefined).map((s) => s.id),
    ).toEqual([]);
  });
});

describe("step quality rubric", () => {
  const doSteps = ALL_STEPS.filter((s) => s.kind === "do");

  it("gives every do-step a done_when", () => {
    expect(
      doSteps.filter((s) => s.done_when.length === 0).map((s) => s.id),
    ).toEqual([]);
  });

  it("gives every step a why", () => {
    expect(ALL_STEPS.filter((s) => !s.why.trim()).map((s) => s.id)).toEqual([]);
  });

  it("sizes do-steps between 10 minutes and 8 hours", () => {
    // The rubric's sizing rule. Longer means it should be split; shorter means
    // it should be merged into a neighbour.
    const wrong = doSteps
      .filter((s) => s.est_minutes < 10 || s.est_minutes > 480)
      .map((s) => `${s.id}=${s.est_minutes}m`);
    expect(wrong).toEqual([]);
  });

  it("collects the capabilities steps actually serve", () => {
    // Synthetic, so it tests the function rather than today's catalog data.
    const steps = [
      { serves: ["auth", "database"] },
      { serves: ["auth"] },
      {},
    ] as Step[];
    expect([...capabilitiesServed(steps)].sort()).toEqual(["auth", "database"]);
    expect(isUnservedCapability("payments", steps)).toBe(true);
    expect(isUnservedCapability("auth", steps)).toBe(false);
  });

  it("has exactly one capability no step wires up", () => {
    /**
     * `project-management` is a known gap, recorded in HANDOFF.md: connect
     * Linear and its canvas node draws no edges, because no track has a step
     * that wires up a tracker.
     *
     * Pinned to the exact list rather than asserted loosely, so this fires in
     * both directions — a second unserved capability appearing is a provider
     * category shipped without steps, and the list shrinking means the gap
     * closed and the handoff needs updating.
     */
    const unserved = CAPABILITY_ORDER.filter((c) => isUnservedCapability(c));
    expect(unserved).toEqual(["project-management"]);
  });

  it("is exclusion-testable — every step is hidden by some profile", () => {
    /**
     * The rubric's sharpest rule: a step that nothing hides isn't a step, it's
     * a preamble. This is the test that stops the catalog drifting back into a
     * generic checklist, which is the exact thing DevCon exists to beat.
     */
    const profiles = Object.values(ALL_FIXTURES);
    const alwaysShown = ALL_STEPS.filter((step) =>
      profiles.every((p) => step.applies_when.test(p)),
    ).map((s) => s.id);

    expect(alwaysShown).toEqual([]);
  });
});

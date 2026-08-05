import { describe, expect, it } from "vitest";
import type { DevconEvent, EventType } from "@/lib/telemetry/events";
import {
  buildFunnel,
  rankCatalogIssues,
  unhiddenSteps,
} from "@/lib/telemetry/funnel";

let seq = 0;
function ev(
  type: EventType,
  project: string,
  stepId?: string,
  ts = ++seq * 1000,
): DevconEvent {
  return { id: `e${seq}`, ts, session: "s1", project, type, stepId };
}

/** One project that copied a prompt and never finished the step. */
function copiedButNotDone(project: string, stepId: string): DevconEvent[] {
  return [
    ev("plan_generated", project),
    ev("step_reached", project, stepId),
    ev("step_opened", project, stepId),
    ev("prompt_copied", project, stepId),
  ];
}

function copiedAndDone(
  project: string,
  stepId: string,
  gapMs = 60_000,
): DevconEvent[] {
  const base = ++seq * 1000;
  return [
    ev("plan_generated", project, undefined, base),
    ev("step_reached", project, stepId, base + 1),
    ev("prompt_copied", project, stepId, base + 2),
    ev("step_completed", project, stepId, base + 2 + gapMs),
  ];
}

describe("the diagnostic signal", () => {
  it("counts copied-but-not-completed separately from not-copied", () => {
    /**
     * The entire reason prompt_copied and step_completed are separate events.
     * Someone who copied and didn't finish had the prompt in hand — that's a
     * broken step, not a bored user. Collapsing the two makes it invisible.
     */
    const events = [
      ...copiedButNotDone("p1", "s1"),
      ...copiedButNotDone("p2", "s1"),
      ...copiedAndDone("p3", "s1"),
    ];
    const step = buildFunnel(events).steps.find((s) => s.stepId === "s1");

    expect(step?.copied).toBe(3);
    expect(step?.completed).toBe(1);
    expect(step?.copiedNotCompleted).toBe(2);
  });

  it("does not count a step nobody copied as a prompt failure", () => {
    const events = [ev("plan_generated", "p1"), ev("step_reached", "p1", "s1")];
    const step = buildFunnel(events).steps.find((s) => s.stepId === "s1");
    expect(step?.reached).toBe(1);
    expect(step?.copiedNotCompleted).toBe(0);
  });

  it("counts distinct attempts, not clicks", () => {
    // Copying the same prompt three times is one person trying once.
    const events = [
      ev("plan_generated", "p1"),
      ev("prompt_copied", "p1", "s1"),
      ev("prompt_copied", "p1", "s1"),
      ev("prompt_copied", "p1", "s1"),
    ];
    expect(
      buildFunnel(events).steps.find((s) => s.stepId === "s1")?.copied,
    ).toBe(1);
  });

  it("measures the median copy-to-complete gap", () => {
    const events = [
      ...copiedAndDone("p1", "s1", 60_000),
      ...copiedAndDone("p2", "s1", 120_000),
      ...copiedAndDone("p3", "s1", 180_000),
    ];
    expect(
      buildFunnel(events).steps.find((s) => s.stepId === "s1")
        ?.medianCopyToComplete,
    ).toBe(120_000);
  });
});

describe("north star", () => {
  it("is shipped over plans generated, not over all events", () => {
    const events = [
      ev("plan_generated", "p1"),
      ev("plan_generated", "p2"),
      ev("plan_generated", "p3"),
      ev("plan_generated", "p4"),
      ev("shipped", "p1"),
    ];
    const s = buildFunnel(events);
    expect(s.plansGenerated).toBe(4);
    expect(s.shipped).toBe(1);
    expect(s.shipRate).toBe(0.25);
  });

  it("counts a project once even if events repeat", () => {
    // Guards the denominator. A double-counted plan_generated halves the ship
    // rate, and a wrong number that looks credible is worse than none.
    const events = [
      ev("plan_generated", "p1"),
      ev("plan_generated", "p1"),
      ev("shipped", "p1"),
      ev("shipped", "p1"),
    ];
    const s = buildFunnel(events);
    expect(s.plansGenerated).toBe(1);
    expect(s.shipped).toBe(1);
    expect(s.shipRate).toBe(1);
  });

  it("returns 0 rather than dividing by zero", () => {
    expect(buildFunnel([]).shipRate).toBe(0);
  });
});

describe("catalog fix ranking", () => {
  it("ignores steps below the sample threshold", () => {
    // One person's bad afternoon must not top the fix list.
    const events = [...copiedButNotDone("p1", "s1")];
    expect(rankCatalogIssues(buildFunnel(events))).toEqual([]);
  });

  it("ranks a step nobody finishes after copying", () => {
    const events = [
      ...copiedButNotDone("p1", "s1"),
      ...copiedButNotDone("p2", "s1"),
      ...copiedButNotDone("p3", "s1"),
      ...copiedButNotDone("p4", "s1"),
    ];
    const issues = rankCatalogIssues(buildFunnel(events));
    expect(issues[0]?.stepId).toBe("s1");
    expect(issues[0]?.reason).toMatch(/copied the prompt but never finished/i);
  });

  it("puts a broken prompt above a merely skipped step", () => {
    /**
     * Weighting matters: copy-without-completion is the least ambiguous
     * evidence that the step itself failed, so it must outrank a skip, which
     * may just mean the step didn't apply.
     */
    const broken = [1, 2, 3, 4].flatMap((n) =>
      copiedButNotDone(`b${n}`, "broken"),
    );
    const skipped = [1, 2, 3, 4].flatMap((n) => [
      ev("plan_generated", `k${n}`),
      ev("step_reached", `k${n}`, "skipped"),
      ev("step_skipped", `k${n}`, "skipped"),
    ]);
    const issues = rankCatalogIssues(buildFunnel([...broken, ...skipped]));
    const rank = (id: string) => issues.findIndex((i) => i.stepId === id);
    expect(rank("broken")).toBeLessThan(rank("skipped"));
  });

  it("stays quiet when a step is working", () => {
    const events = [1, 2, 3, 4].flatMap((n) => copiedAndDone(`p${n}`, "good"));
    expect(rankCatalogIssues(buildFunnel(events))).toEqual([]);
  });

  it("does not penalise a step for a low open rate if people acted on it", () => {
    /**
     * Regression. Copying or completing is engagement, and `step_opened` only
     * fires in the Prompts section — so a step completed from the task list
     * scored 0.5 on "nobody opened it" and was reported as broken. Working
     * steps in the fix list make the fix list worthless.
     */
    const events = [1, 2, 3, 4].flatMap((n) => copiedAndDone(`p${n}`, "acted"));
    const issues = rankCatalogIssues(buildFunnel(events));
    expect(issues.map((i) => i.stepId)).not.toContain("acted");
  });

  it("still flags a step nobody reached past, opened, or copied", () => {
    const events = [1, 2, 3, 4].flatMap((n) => [
      ev("plan_generated", `p${n}`),
      ev("step_reached", `p${n}`, "ignored"),
    ]);
    const issues = rankCatalogIssues(buildFunnel(events));
    expect(issues.map((i) => i.stepId)).toContain("ignored");
    expect(issues[0]?.reason).toMatch(/never opened it/i);
  });
});

describe("un-hidden steps", () => {
  it("counts them as automatic predicate bug reports", () => {
    // A step un-hidden repeatedly has a wrong applies_when — a catalog bug
    // filed without anyone writing it up.
    const events = [
      ev("step_unhidden", "p1", "wrong"),
      ev("step_unhidden", "p2", "wrong"),
      ev("step_unhidden", "p3", "other"),
    ];
    const result = unhiddenSteps(events);
    expect(result[0]).toEqual({ stepId: "wrong", count: 2 });
    expect(result[1]).toEqual({ stepId: "other", count: 1 });
  });

  it("returns nothing when no step was un-hidden", () => {
    expect(unhiddenSteps([ev("plan_generated", "p1")])).toEqual([]);
  });
});

describe("determinism", () => {
  it("produces identical output for identical input", () => {
    // A ranking that shifts on its own is a ranking nobody trusts.
    const events = [1, 2, 3, 4].flatMap((n) => copiedButNotDone(`p${n}`, "s1"));
    expect(JSON.stringify(buildFunnel(events))).toBe(
      JSON.stringify(buildFunnel(events)),
    );
  });
});

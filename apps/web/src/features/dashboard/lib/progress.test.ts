import { describe, expect, it } from "vitest";
import {
  currentPhase,
  currentTask,
  overallProgress,
  phaseProgress,
  type Phase,
} from "./progress";

const phases: Phase[] = [
  {
    id: "p1",
    name: "Foundation",
    tasks: [
      { id: "t1", title: "Set up repo", done: true },
      { id: "t2", title: "Add CI", done: true },
    ],
  },
  {
    id: "p2",
    name: "Auth",
    tasks: [
      { id: "t3", title: "Login screen", done: true },
      { id: "t4", title: "Session handling", done: false },
      { id: "t5", title: "Password reset", done: false },
    ],
  },
  {
    id: "p3",
    name: "Billing",
    tasks: [{ id: "t6", title: "Stripe", done: false }],
  },
];

describe("phaseProgress", () => {
  it("reports a completed phase as 100", () => {
    expect(phaseProgress(phases[0])).toBe(100);
  });

  it("rounds a partial phase", () => {
    expect(phaseProgress(phases[1])).toBe(33);
  });

  it("reports an untouched phase as 0", () => {
    expect(phaseProgress(phases[2])).toBe(0);
  });

  it("treats a phase with no tasks as 0, not 100", () => {
    // An empty phase is unplanned, not finished — claiming 100 would be a lie.
    expect(phaseProgress({ id: "x", name: "Empty", tasks: [] })).toBe(0);
  });
});

describe("overallProgress", () => {
  it("counts tasks across every phase, not phases", () => {
    // 3 of 6 tasks are done.
    expect(overallProgress(phases)).toBe(50);
  });

  it("is 0 for no phases", () => {
    expect(overallProgress([])).toBe(0);
  });

  it("is 100 when everything is done", () => {
    expect(
      overallProgress([
        { id: "a", name: "A", tasks: [{ id: "1", title: "x", done: true }] },
      ])
    ).toBe(100);
  });

  it("never reports 100 while any task is open", () => {
    const many: Phase[] = [
      {
        id: "a",
        name: "A",
        tasks: [
          ...Array.from({ length: 199 }, (_, i) => ({
            id: `d${i}`,
            title: "done",
            done: true,
          })),
          { id: "open", title: "open", done: false },
        ],
      },
    ];

    expect(overallProgress(many)).toBeLessThan(100);
  });
});

describe("currentPhase", () => {
  it("is the first phase with unfinished work", () => {
    expect(currentPhase(phases)?.id).toBe("p2");
  });

  it("is null when everything is complete", () => {
    expect(
      currentPhase([
        { id: "a", name: "A", tasks: [{ id: "1", title: "x", done: true }] },
      ])
    ).toBeNull();
  });

  it("is null for no phases", () => {
    expect(currentPhase([])).toBeNull();
  });

  it("skips an empty phase rather than stalling on it", () => {
    const withEmpty: Phase[] = [
      { id: "empty", name: "Unplanned", tasks: [] },
      phases[1],
    ];

    expect(currentPhase(withEmpty)?.id).toBe("p2");
  });
});

describe("currentTask", () => {
  it("is the first incomplete task of the current phase", () => {
    expect(currentTask(phases)?.id).toBe("t4");
  });

  it("is null when everything is done", () => {
    expect(
      currentTask([
        { id: "a", name: "A", tasks: [{ id: "1", title: "x", done: true }] },
      ])
    ).toBeNull();
  });
});

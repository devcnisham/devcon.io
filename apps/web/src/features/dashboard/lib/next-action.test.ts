import { describe, expect, it } from "vitest";
import { nextAction, type NextActionInput } from "./next-action";
import type { Phase } from "./progress";

const phases: Phase[] = [
  {
    id: "p1",
    name: "Auth",
    tasks: [
      { id: "t1", title: "Login screen", done: true },
      { id: "t2", title: "Session handling", done: false },
    ],
  },
];

const base: NextActionInput = {
  phases,
  health: {
    hasTests: true,
    testsPassing: true,
    ciConfigured: true,
    lastDeploySucceeded: true,
    outdatedDependencies: 0,
    criticalVulnerabilities: 0,
    openIssues: 0,
    daysSinceLastCommit: 1,
  },
  hasRepository: true,
  hasDeployed: true,
};

describe("nextAction", () => {
  it("returns the current task when nothing is wrong", () => {
    const action = nextAction(base);

    expect(action.kind).toBe("task");
    expect(action.title).toContain("Session handling");
  });

  it("always returns exactly one action", () => {
    const action = nextAction(base);

    expect(action.title).toBeTruthy();
    expect(action.why).toBeTruthy();
  });

  it("a critical vulnerability outranks the current task", () => {
    const action = nextAction({
      ...base,
      health: { ...base.health, criticalVulnerabilities: 1 },
    });

    expect(action.kind).toBe("security");
  });

  it("failing tests outrank the current task", () => {
    const action = nextAction({
      ...base,
      health: { ...base.health, testsPassing: false },
    });

    expect(action.kind).toBe("fix-tests");
  });

  it("a vulnerability outranks failing tests", () => {
    const action = nextAction({
      ...base,
      health: {
        ...base.health,
        testsPassing: false,
        criticalVulnerabilities: 1,
      },
    });

    expect(action.kind).toBe("security");
  });

  it("asks for a repository before anything else when there is none", () => {
    const action = nextAction({ ...base, hasRepository: false });

    expect(action.kind).toBe("connect-repository");
  });

  it("suggests writing tests when there are none", () => {
    const action = nextAction({
      ...base,
      health: { ...base.health, hasTests: false, testsPassing: false },
    });

    expect(action.kind).toBe("add-tests");
  });

  it("suggests deploying once tasks are done but nothing has shipped", () => {
    const action = nextAction({
      ...base,
      hasDeployed: false,
      phases: [
        {
          id: "p1",
          name: "Auth",
          tasks: [{ id: "t1", title: "Login", done: true }],
        },
      ],
    });

    expect(action.kind).toBe("deploy");
  });

  it("celebrates when there is genuinely nothing to do", () => {
    const action = nextAction({
      ...base,
      phases: [
        {
          id: "p1",
          name: "Auth",
          tasks: [{ id: "t1", title: "Login", done: true }],
        },
      ],
    });

    expect(action.kind).toBe("plan-next");
  });

  it("asks for a plan when there are no phases at all", () => {
    const action = nextAction({ ...base, phases: [] });

    expect(action.kind).toBe("plan-next");
  });

  it("always explains why, in plain language", () => {
    const cases: NextActionInput[] = [
      base,
      { ...base, hasRepository: false },
      { ...base, health: { ...base.health, criticalVulnerabilities: 3 } },
      { ...base, phases: [] },
    ];

    for (const input of cases) {
      const action = nextAction(input);
      expect(action.why.length).toBeGreaterThan(10);
      expect(action.why).not.toMatch(/undefined|null|NaN/);
    }
  });
});

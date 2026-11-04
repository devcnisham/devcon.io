import { describe, expect, it } from "vitest";
import {
  WIZARD_STEPS,
  canAdvance,
  initialDraft,
  nextStep,
  previousStep,
  progress,
  stepsFor,
  type ProjectDraft,
} from "./wizard";

const base: ProjectDraft = {
  ...initialDraft(),
  name: "Devstep",
  type: "web-app",
  technologies: ["typescript"],
};

describe("stepsFor", () => {
  it("skips repository selection for a new project", () => {
    expect(stepsFor("new")).not.toContain("repository");
  });

  it("includes repository selection for an existing project", () => {
    expect(stepsFor("existing")).toContain("repository");
  });

  it("always starts at basics and ends at review", () => {
    for (const source of ["new", "existing"] as const) {
      const steps = stepsFor(source);
      expect(steps[0]).toBe("basics");
      expect(steps[steps.length - 1]).toBe("review");
    }
  });

  it("only ever contains known steps", () => {
    for (const step of stepsFor("existing")) {
      expect(WIZARD_STEPS).toContain(step);
    }
  });
});

describe("canAdvance — basics", () => {
  it("blocks an empty name", () => {
    expect(canAdvance("basics", { ...base, name: "" }).ok).toBe(false);
  });

  it("blocks a one-character name", () => {
    expect(canAdvance("basics", { ...base, name: "x" }).ok).toBe(false);
  });

  it("allows a valid name", () => {
    expect(canAdvance("basics", base).ok).toBe(true);
  });

  it("blocks an over-long description", () => {
    const result = canAdvance("basics", {
      ...base,
      description: "x".repeat(501),
    });

    expect(result.ok).toBe(false);
  });

  it("allows an empty description — it is optional", () => {
    expect(canAdvance("basics", { ...base, description: "" }).ok).toBe(true);
  });
});

describe("canAdvance — type and stack", () => {
  it("blocks when no type is chosen", () => {
    expect(canAdvance("type", { ...base, type: null }).ok).toBe(false);
  });

  it("blocks when no technology is chosen", () => {
    expect(canAdvance("stack", { ...base, technologies: [] }).ok).toBe(false);
  });

  it("allows one technology", () => {
    expect(canAdvance("stack", base).ok).toBe(true);
  });

  it("explains why it is blocked", () => {
    const result = canAdvance("stack", { ...base, technologies: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/technolog/i);
  });
});

describe("canAdvance — repository", () => {
  it("blocks an existing project with no repository picked", () => {
    expect(
      canAdvance("repository", {
        ...base,
        source: "existing",
        repository: null,
      }).ok
    ).toBe(false);
  });

  it("allows once a repository is picked", () => {
    expect(
      canAdvance("repository", {
        ...base,
        source: "existing",
        repository: "octocat/hello-world",
      }).ok
    ).toBe(true);
  });
});

describe("navigation", () => {
  it("advances through the new-project path", () => {
    expect(nextStep("basics", "new")).toBe("type");
    expect(nextStep("type", "new")).toBe("stack");
    expect(nextStep("stack", "new")).toBe("source");
    expect(nextStep("source", "new")).toBe("visibility");
  });

  it("routes an existing project through repository selection", () => {
    expect(nextStep("source", "existing")).toBe("repository");
    expect(nextStep("repository", "existing")).toBe("visibility");
  });

  it("stays put at the last step", () => {
    expect(nextStep("review", "new")).toBe("review");
  });

  it("goes back symmetrically", () => {
    expect(previousStep("type", "new")).toBe("basics");
    expect(previousStep("visibility", "existing")).toBe("repository");
    expect(previousStep("visibility", "new")).toBe("source");
  });

  it("stays put at the first step", () => {
    expect(previousStep("basics", "new")).toBe("basics");
  });
});

describe("progress", () => {
  it("reports position and total for the new-project path", () => {
    expect(progress("basics", "new")).toEqual({ current: 1, total: 6 });
  });

  it("counts the extra step for an existing project", () => {
    expect(progress("basics", "existing")).toEqual({ current: 1, total: 7 });
  });

  it("reaches the end at review", () => {
    const { current, total } = progress("review", "new");
    expect(current).toBe(total);
  });
});

describe("initialDraft", () => {
  it("starts as a new project with nothing chosen", () => {
    const draft = initialDraft();

    expect(draft.source).toBe("new");
    expect(draft.type).toBeNull();
    expect(draft.technologies).toEqual([]);
    expect(draft.visibility).toBe("private");
    expect(draft.status).toBe("active");
  });
});

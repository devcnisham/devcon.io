import { describe, expect, it } from "vitest";
import { HEALTH_BANDS, projectHealth, type HealthSignals } from "./health";

const healthy: HealthSignals = {
  testsPassing: true,
  hasTests: true,
  ciConfigured: true,
  lastDeploySucceeded: true,
  outdatedDependencies: 0,
  criticalVulnerabilities: 0,
  openIssues: 0,
  daysSinceLastCommit: 1,
};

describe("projectHealth", () => {
  it("scores a healthy project in the top band", () => {
    const result = projectHealth(healthy);

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.band).toBe("healthy");
  });

  it("never exceeds 100", () => {
    expect(projectHealth(healthy).score).toBeLessThanOrEqual(100);
  });

  it("never drops below 0", () => {
    const terrible = projectHealth({
      testsPassing: false,
      hasTests: false,
      ciConfigured: false,
      lastDeploySucceeded: false,
      outdatedDependencies: 500,
      criticalVulnerabilities: 50,
      openIssues: 500,
      daysSinceLastCommit: 999,
    });

    expect(terrible.score).toBeGreaterThanOrEqual(0);
  });

  it("penalises failing tests heavily", () => {
    const failing = projectHealth({ ...healthy, testsPassing: false });

    expect(failing.score).toBeLessThan(healthy.testsPassing ? 90 : 100);
    expect(failing.reasons).toContainEqual(
      expect.objectContaining({ label: expect.stringMatching(/test/i) })
    );
  });

  it("treats having no tests as worse than having failing tests", () => {
    // Failing tests tell you something. No tests tell you nothing.
    const noTests = projectHealth({
      ...healthy,
      hasTests: false,
      testsPassing: false,
    });
    const failingTests = projectHealth({ ...healthy, testsPassing: false });

    expect(noTests.score).toBeLessThan(failingTests.score);
  });

  it("flags a critical vulnerability regardless of everything else", () => {
    const result = projectHealth({ ...healthy, criticalVulnerabilities: 1 });

    expect(result.band).not.toBe("healthy");
    expect(result.reasons.some((r) => /vulnerab/i.test(r.label))).toBe(true);
  });

  it("lists no reasons when nothing is wrong", () => {
    expect(projectHealth(healthy).reasons).toEqual([]);
  });

  it("orders reasons by severity, worst first", () => {
    const result = projectHealth({
      ...healthy,
      criticalVulnerabilities: 2,
      outdatedDependencies: 3,
    });

    const weights = result.reasons.map((r) => r.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it("puts every band boundary in the right band", () => {
    for (const band of HEALTH_BANDS) {
      expect(band.min).toBeLessThanOrEqual(band.max);
    }
  });

  it("counts a long silence against the project", () => {
    const stale = projectHealth({ ...healthy, daysSinceLastCommit: 120 });

    expect(stale.score).toBeLessThan(projectHealth(healthy).score);
  });
});

/**
 * Project health as a single score with its reasons.
 *
 * A number alone is useless to a new developer — "62/100" prompts "so what?".
 * Every deduction carries a label and a weight, so the dashboard can show what
 * is wrong and in what order to fix it.
 *
 * Weights are deliberate, not tuned: they encode what actually endangers a
 * project, worst first.
 */

export type HealthSignals = {
  hasTests: boolean;
  testsPassing: boolean;
  ciConfigured: boolean;
  lastDeploySucceeded: boolean;
  outdatedDependencies: number;
  criticalVulnerabilities: number;
  openIssues: number;
  daysSinceLastCommit: number;
};

export type HealthBand = "healthy" | "fair" | "at-risk" | "critical";

export const HEALTH_BANDS: Array<{
  band: HealthBand;
  min: number;
  max: number;
}> = [
  { band: "healthy", min: 85, max: 100 },
  { band: "fair", min: 65, max: 84 },
  { band: "at-risk", min: 40, max: 64 },
  { band: "critical", min: 0, max: 39 },
];

export type HealthReason = {
  label: string;
  detail: string;
  weight: number;
};

export type HealthResult = {
  score: number;
  band: HealthBand;
  reasons: HealthReason[];
};

function bandFor(score: number): HealthBand {
  return (
    HEALTH_BANDS.find((b) => score >= b.min && score <= b.max)?.band ??
    "critical"
  );
}

export function projectHealth(signals: HealthSignals): HealthResult {
  const reasons: HealthReason[] = [];

  // A known-exploitable dependency outranks everything else.
  if (signals.criticalVulnerabilities > 0) {
    reasons.push({
      label: "Critical vulnerabilities",
      detail: `${signals.criticalVulnerabilities} dependency ${
        signals.criticalVulnerabilities === 1 ? "issue needs" : "issues need"
      } patching`,
      weight: 40,
    });
  }

  // No tests is worse than failing tests: failing tests tell you something,
  // no tests tell you nothing at all.
  if (!signals.hasTests) {
    reasons.push({
      label: "No tests",
      detail: "Nothing verifies this project's behaviour",
      weight: 30,
    });
  } else if (!signals.testsPassing) {
    reasons.push({
      label: "Tests failing",
      detail: "The suite is red — fix it before shipping",
      weight: 25,
    });
  }

  if (!signals.lastDeploySucceeded) {
    reasons.push({
      label: "Last deploy failed",
      detail: "Production may be behind, or broken",
      weight: 20,
    });
  }

  if (!signals.ciConfigured) {
    reasons.push({
      label: "No CI",
      detail: "Nothing checks a change before it merges",
      weight: 15,
    });
  }

  if (signals.outdatedDependencies > 0) {
    reasons.push({
      label: "Outdated dependencies",
      detail: `${signals.outdatedDependencies} behind their latest release`,
      weight: Math.min(10, signals.outdatedDependencies),
    });
  }

  if (signals.openIssues > 0) {
    reasons.push({
      label: "Open issues",
      detail: `${signals.openIssues} awaiting attention`,
      weight: Math.min(8, Math.ceil(signals.openIssues / 3)),
    });
  }

  // Long silences usually mean abandoned, not finished.
  if (signals.daysSinceLastCommit > 30) {
    reasons.push({
      label: "No recent activity",
      detail: `${signals.daysSinceLastCommit} days since the last commit`,
      weight: Math.min(12, Math.floor(signals.daysSinceLastCommit / 30) * 4),
    });
  }

  reasons.sort((a, b) => b.weight - a.weight);

  const deductions = reasons.reduce(
    (total, reason) => total + reason.weight,
    0
  );
  const score = Math.max(0, Math.min(100, 100 - deductions));

  return { score, band: bandFor(score), reasons };
}

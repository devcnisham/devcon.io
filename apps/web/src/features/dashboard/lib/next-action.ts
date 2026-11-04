import type { HealthSignals } from "./health";
import { currentTask, type Phase } from "./progress";

/**
 * The single most important thing to do next.
 *
 * This is the product's core promise to a new developer: not a list of
 * everything that could be done, but one ranked answer to "what now?".
 *
 * The order below is the opinion. It is deliberately not configurable — a
 * developer who does not yet know the process cannot be asked to rank these
 * for themselves.
 */

export type NextActionKind =
  | "connect-repository"
  | "security"
  | "fix-tests"
  | "add-tests"
  | "task"
  | "deploy"
  | "plan-next";

export type NextAction = {
  kind: NextActionKind;
  title: string;
  /** Plain-language justification, shown under the title. */
  why: string;
  href?: string;
};

export type NextActionInput = {
  phases: Phase[];
  health: HealthSignals;
  hasRepository: boolean;
  hasDeployed: boolean;
};

export function nextAction(input: NextActionInput): NextAction {
  const { phases, health, hasRepository, hasDeployed } = input;

  // Nothing else can be assessed without the code.
  if (!hasRepository) {
    return {
      kind: "connect-repository",
      title: "Connect a repository",
      why: "devstep reads your code to understand the project. Until a repository is connected, everything else here is guesswork.",
      href: "/settings/project",
    };
  }

  // A known-exploitable dependency is the only thing that outranks broken code.
  if (health.criticalVulnerabilities > 0) {
    const count = health.criticalVulnerabilities;
    return {
      kind: "security",
      title: `Patch ${count} critical ${count === 1 ? "vulnerability" : "vulnerabilities"}`,
      why: "A known vulnerability is being shipped to your users. This is the one thing worth interrupting other work for.",
    };
  }

  if (health.hasTests && !health.testsPassing) {
    return {
      kind: "fix-tests",
      title: "Fix the failing tests",
      why: "A red suite means every later change is guesswork — you cannot tell what you broke from what was already broken.",
    };
  }

  if (!health.hasTests) {
    return {
      kind: "add-tests",
      title: "Write your first test",
      why: "Nothing currently verifies this project works. One test on the most important behaviour is worth more than a hundred later.",
    };
  }

  const task = currentTask(phases);
  if (task) {
    return {
      kind: "task",
      title: task.title,
      why: "This is the next unfinished step in your current phase. Finishing it in order keeps the plan honest.",
      href: "/projects",
    };
  }

  // Everything planned is done.
  if (!hasDeployed) {
    return {
      kind: "deploy",
      title: "Deploy for the first time",
      why: "Your planned work is finished and the checks are green. Shipping it is how you find out what you actually built.",
    };
  }

  return {
    kind: "plan-next",
    title: "Plan the next feature",
    why: "Nothing is outstanding and the project is healthy. Decide what to build next and devstep will break it into steps.",
    href: "/projects",
  };
}

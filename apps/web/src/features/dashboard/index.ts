/**
 * Public surface of the dashboard feature.
 *
 * Phase 0.5: progress, health scoring, and next-action ranking are complete and
 * tested. Panels render the true state of a project with no data — which is
 * mostly "nothing known yet", and saying so is the correct answer.
 */

export {
  ProjectDashboard,
  type DashboardData,
} from "./components/project-dashboard";
export { NextActionCard } from "./components/next-action-card";
export { HealthCard } from "./components/health-card";
export { DashboardPanel } from "./components/dashboard-panel";

export {
  overallProgress,
  phaseProgress,
  currentPhase,
  currentTask,
  type Phase,
  type Task,
} from "./lib/progress";

export {
  projectHealth,
  HEALTH_BANDS,
  type HealthSignals,
  type HealthResult,
  type HealthBand,
  type HealthReason,
} from "./lib/health";

export {
  nextAction,
  type NextAction,
  type NextActionKind,
  type NextActionInput,
} from "./lib/next-action";

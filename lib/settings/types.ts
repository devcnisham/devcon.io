import type { AgentTarget } from "../engine/prompt";

export interface Prefs {
  /**
   * Hours a week the builder realistically has. Drives the on-track / behind
   * calculation, so it is not cosmetic — a student with 4h/week and one with
   * 20h/week get genuinely different advice from the same plan.
   */
  hoursPerWeek: number;
  /** Which agent prompts are written for by default. */
  defaultAgent: AgentTarget;
  /** Show estimates and mark weights, or hide the numbers. */
  showEstimates: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  hoursPerWeek: 10,
  defaultAgent: "claude-code",
  showEstimates: true,
};

/**
 * Editable slice of the profile.
 *
 * Only fields a builder would legitimately change after intake. `context` is
 * absent on purpose — switching track mid-project would swap the whole
 * catalog underneath them, which is a new project, not a setting.
 */
export interface ProfileOverrides {
  one_liner?: string;
  deadline_date?: string | null;
  deliverables?: ("code" | "report" | "demo" | "viva")[];
  must_run_locally?: boolean;
  tech_constraints?: string | null;
  has_rubric?: boolean;
  group_size?: number;
}

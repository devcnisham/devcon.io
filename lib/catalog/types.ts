// Core catalog types. See docs/v1.0.0-solo-team-plan.md

import type { Capability } from "./providers";

export type Context = "academic" | "competition" | "commercial";
export type Phase = "foundation" | "core" | "harden" | "deliver";
export type StepKind = "do" | "avoid";
export type Criticality = "must" | "should" | "nice";
export type Deliverable = "code" | "report" | "demo" | "viva";
export type SkillLevel = "first-time" | "some-experience" | "professional";

export const PHASE_ORDER: Phase[] = ["foundation", "core", "harden", "deliver"];

export interface ProjectProfile {
  /** The highest-leverage field. Set explicitly at project creation, never inferred. */
  context: Context;
  one_liner: string;

  needs: {
    auth: boolean;
    payments: boolean;
    file_upload: boolean;
    realtime: boolean;
    email: boolean;
    ai: boolean;
    handles_pii: boolean;
  };

  /** Populated only when context === "academic". */
  academic: {
    deadline_date: string | null;
    deliverables: Deliverable[];
    must_run_locally: boolean;
    /** Stack mandated by the brief, e.g. "Java". Null when unconstrained. */
    tech_constraints: string | null;
    has_rubric: boolean;
    group_size: number;
  };

  /** Populated only when context === "commercial". */
  commercial: {
    has_paying_users: boolean;
    is_client_work: boolean;
    handoff_required: boolean;
    /** Live and serving real traffic, versus pre-launch. */
    is_live: boolean;
  };

  builder: {
    skill_level: SkillLevel;
    solo_or_team: "solo" | "team";
  };
}

/**
 * A predicate that can explain itself.
 *
 * Raw `(p) => boolean` cannot say WHY it failed, and "why was this hidden?"
 * is the entire trust feature. So conditions are composable, self-describing
 * nodes and `explain()` walks the tree to find the failing leaf.
 */
export interface Condition {
  kind: "leaf" | "all" | "any" | "not";
  test(p: ProjectProfile): boolean;
  /** Reads true: "your project takes payments" */
  describe(): string;
  /** Reads false: "your project doesn't take payments" */
  describeFail(): string;
  children?: Condition[];
}

export interface DoneWhen {
  text: string;
}

export interface Step {
  id: string;
  title: string;
  kind: StepKind;
  phase: Phase;
  /** Ordering within a phase. Lower runs first. */
  weight: number;
  criticality: Criticality;
  applies_when: Condition;
  /** Step ids that must complete first. Ignored for kind: "avoid". */
  requires: string[];
  why: string;
  done_when: DoneWhen[];
  /** Absent for kind: "avoid" — there is nothing to paste. */
  prompt_template?: string;
  est_minutes: number;
  /** Percentage of final grade, when the brief supplies a rubric. */
  mark_weight?: number;
  /**
   * Capabilities this step actually wires up.
   *
   * Catalog data, not inference — it decides which connected service a step is
   * drawn against on the canvas. Deriving it from the title or the `needs`
   * predicate would be a guess, and a wrong edge on a graph reads as a fact.
   */
  serves?: Capability[];
}

export interface HiddenStep {
  step: Step;
  /** Generated from the failing predicate, never hand-written. */
  reason: string;
}

export interface Plan {
  steps: Step[];
  antiSteps: Step[];
  hidden: HiddenStep[];
}

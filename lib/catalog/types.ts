// Core catalog types. See docs/v1.0.0-solo-team-plan.md

import type { Capability } from "./providers";

export type Context = "academic" | "competition" | "commercial";
export type Phase = "foundation" | "core" | "harden" | "deliver";
export type StepKind = "do" | "avoid";
export type Criticality = "must" | "should" | "nice";
export type Deliverable = "code" | "report" | "demo" | "viva";
export type SkillLevel = "first-time" | "some-experience" | "professional";
/** What the submission portal asks for. Competition's answer to `Deliverable`. */
export type Submission = "repo" | "video" | "writeup" | "live-demo";

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

  /** Populated only when context === "competition". */
  competition: {
    /**
     * Hours left in the event, or null when it isn't time-boxed.
     *
     * A snapshot taken at project creation, not a live clock — there is no
     * backend to tick it. It gates the triage step, which only makes sense for
     * someone who joined late or is entering the last stretch.
     */
    hours_remaining: number | null;
    submission: Submission[];
    /** Sponsor prizes being targeted. Each usually mandates a specific service. */
    sponsor_tracks: string[];
    /** Judges score against published criteria. */
    has_judging_criteria: boolean;
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

/**
 * Who can actually do this step.
 *
 * Verifying the competition prompts against a real repo found that six of the
 * fifteen selected steps were not agent work at all, and every one of them
 * still shipped a "paste this into your coding agent" prompt. `comp-read-judging`
 * asked an agent to check that every judging criterion was answered — while
 * never supplying the criteria, because the profile only carries a boolean.
 *
 * The product's claim is a context-rich prompt per step. For a third of that
 * track the claim was false, and no wording fixes it: the agent is missing
 * information, or the task is not typing at all.
 *
 * - `agent` — the prompt already carries everything needed. Default.
 * - `needs-input` — an agent CAN do it, but only after a human supplies
 *   something DevCon cannot know: the judging criteria, the sponsor's rules,
 *   what the demo shows. The prompt is generated once those are filled in.
 * - `human` — nobody's agent can do this. Rehearsing out loud, recording a
 *   video, getting four people to push. Shows a checklist and no prompt.
 */
export type StepExecution = "agent" | "needs-input" | "human";

/** One thing a `needs-input` step must be told before its prompt is worth having. */
export interface StepInput {
  key: string;
  /** Shown above the field. */
  label: string;
  /** Shown inside it — a concrete example, not a restatement of the label. */
  placeholder: string;
  /** Longer fields get a textarea. */
  multiline?: boolean;
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
  /**
   * When this step's prompt was last run through a real agent and produced
   * working output.
   *
   * The catalog rubric's bar, recorded rather than asserted. `docs/gaps-plan.md`
   * claimed the engine already excluded unverified steps and that the work
   * "gates itself" — it did not, and there was no field to gate on. This is it.
   *
   * Absent means never verified, which is the honest default for a catalog
   * nobody has run. It deliberately does NOT filter plans: a plan of only
   * verified steps would today be an empty plan, and hiding the gap is worse
   * than showing it. The UI surfaces it; the engine ignores it.
   */
  verification?: Verification;
  /** Who can do this. Defaults to `agent` — see StepExecution. */
  execution?: StepExecution;
  /** Required when `execution === "needs-input"`. Ignored otherwise. */
  inputs?: StepInput[];
}

/** Defaulted here so callers never branch on `undefined`. */
export function executionOf(step: Step): StepExecution {
  return step.execution ?? "agent";
}

/** Whether pasting this into a coding agent is a reasonable thing to offer. */
export function hasPrompt(step: Step): boolean {
  // Anti-steps are not work, so there is nothing to paste for them either.
  return step.kind === "do" && executionOf(step) !== "human";
}

export interface Verification {
  /** ISO date of the most recent passing run. */
  verified_at: string;
  /**
   * Agents that ran it and produced working output.
   *
   * The rubric asks for two, because one agent's tolerance for an ambiguous
   * instruction is not evidence about agents in general. One entry means
   * half-verified, and the UI says so rather than rounding up.
   */
  agents: string[];
  /** What the run actually produced, so a later reader can judge the claim. */
  notes?: string;
}

/** The rubric's bar: two independent agents, against a real repo. */
export const VERIFICATION_BAR = 2;

export function isVerified(step: Step): boolean {
  return (step.verification?.agents.length ?? 0) >= VERIFICATION_BAR;
}

export function verificationState(
  step: Step,
): "unverified" | "partial" | "verified" {
  const n = step.verification?.agents.length ?? 0;
  if (n === 0) return "unverified";
  return n >= VERIFICATION_BAR ? "verified" : "partial";
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

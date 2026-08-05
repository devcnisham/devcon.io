import type { ProjectProfile } from "@/lib/catalog/types";

/**
 * A profile that selects nothing.
 *
 * Not a sample and not a default — every field is the value that makes its
 * predicate false, so `buildPlan` returns zero steps and the canvas shows its
 * empty state. It exists so the hooks in the canvas don't have to become
 * conditional on whether a repo is loaded, which is the kind of change that
 * turns one missing project into a crash rather than an empty screen.
 *
 * `context` has to be *something*. "commercial" is the least wrong: it's the
 * only track whose steps all key off facts a scan can actually establish, so
 * if this ever did leak into a rendered plan it would produce nothing about
 * rubrics or vivas for a project that has neither.
 */
export const EMPTY_PROFILE: ProjectProfile = {
  context: "commercial",
  one_liner: "",
  needs: {
    auth: false,
    payments: false,
    file_upload: false,
    realtime: false,
    email: false,
    ai: false,
    handles_pii: false,
  },
  academic: {
    deadline_date: null,
    deliverables: [],
    must_run_locally: false,
    tech_constraints: null,
    has_rubric: false,
    group_size: 1,
  },
  competition: {
    hours_remaining: null,
    submission: [],
    sponsor_tracks: [],
    has_judging_criteria: false,
  },
  commercial: {
    has_paying_users: false,
    is_client_work: false,
    handoff_required: false,
    is_live: false,
  },
  builder: { skill_level: "some-experience", solo_or_team: "solo" },
};

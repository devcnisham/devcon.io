import type { ProjectProfile } from "@/lib/catalog/types";

/** Academic fixtures still need the block; none of it applies to them. */
const NOT_COMMERCIAL: ProjectProfile["commercial"] = {
  has_paying_users: false,
  is_client_work: false,
  handoff_required: false,
  is_live: false,
};

/**
 * Fixture profiles spanning the space.
 *
 * These used to drive the UI as well, so the canvas had something to render
 * before intake existed. It has intake now — a folder picker, a file drop, a
 * public GitHub repo, and the local dev route — so the app ships no sample
 * project at all and these are test data only.
 *
 * They stay because the engine tests need profiles that differ along every
 * axis a predicate reads: context, needs, group size, deliverables. Without
 * that spread, the exclusion-testability rule in catalog.test.ts — no step is
 * shown by every profile — has nothing to test against.
 */

export const FINAL_YEAR_SOLO: ProjectProfile = {
  context: "academic",
  one_liner: "A library management system for my final year project",
  needs: {
    auth: true,
    payments: false,
    file_upload: false,
    realtime: false,
    email: false,
    ai: false,
    handles_pii: true,
  },
  academic: {
    deadline_date: "2026-11-15",
    deliverables: ["code", "report", "demo", "viva"],
    must_run_locally: true,
    tech_constraints: null,
    has_rubric: true,
    group_size: 1,
  },
  commercial: NOT_COMMERCIAL,
  builder: { skill_level: "first-time", solo_or_team: "solo" },
};

export const GROUP_COURSEWORK: ProjectProfile = {
  context: "academic",
  one_liner: "A campus event booking app, group of four",
  needs: {
    auth: true,
    payments: false,
    file_upload: true,
    realtime: false,
    email: true,
    ai: false,
    handles_pii: true,
  },
  academic: {
    deadline_date: "2026-12-01",
    deliverables: ["code", "report", "demo"],
    must_run_locally: true,
    tech_constraints: "Java",
    has_rubric: true,
    group_size: 4,
  },
  commercial: NOT_COMMERCIAL,
  builder: { skill_level: "some-experience", solo_or_team: "team" },
};

/** No rubric, no viva, no local-run requirement — a personal side project. */
export const PERSONAL_PROJECT: ProjectProfile = {
  context: "academic",
  one_liner: "A habit tracker I want to actually finish",
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
    deliverables: ["code"],
    must_run_locally: false,
    tech_constraints: null,
    has_rubric: false,
    group_size: 1,
  },
  commercial: NOT_COMMERCIAL,
  builder: { skill_level: "first-time", solo_or_team: "solo" },
};

export const FIXTURES = {
  FINAL_YEAR_SOLO,
  GROUP_COURSEWORK,
  PERSONAL_PROJECT,
} as const;

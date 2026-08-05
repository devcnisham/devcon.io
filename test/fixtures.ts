import type { ProjectProfile } from "@/lib/catalog/types";
import { FIXTURES } from "@/lib/fixtures/profiles";

/**
 * Profiles spanning the space, for snapshotting plans and proving the
 * exclusion rule.
 *
 * The app fixtures are all academic. Selection is only meaningfully tested
 * when profiles differ along the axes the predicates actually read — context,
 * needs, group size, deliverables — so the commercial ones are defined here
 * rather than shipped in the app.
 */

const NO_COMMERCIAL: ProjectProfile["commercial"] = {
  has_paying_users: false,
  is_client_work: false,
  handoff_required: false,
  is_live: false,
};

const NO_ACADEMIC: ProjectProfile["academic"] = {
  deadline_date: null,
  deliverables: [],
  must_run_locally: false,
  tech_constraints: null,
  has_rubric: false,
  group_size: 1,
};

const NO_NEEDS: ProjectProfile["needs"] = {
  auth: false,
  payments: false,
  file_upload: false,
  realtime: false,
  email: false,
  ai: false,
  handles_pii: false,
};

export const COMMERCIAL_SAAS: ProjectProfile = {
  context: "commercial",
  one_liner: "A paid SaaS with auth, payments and AI",
  needs: {
    ...NO_NEEDS,
    auth: true,
    payments: true,
    email: true,
    ai: true,
    handles_pii: true,
  },
  academic: NO_ACADEMIC,
  commercial: { ...NO_COMMERCIAL, has_paying_users: true },
  builder: { skill_level: "professional", solo_or_team: "solo" },
};

export const COMMERCIAL_CLIENT_WORK: ProjectProfile = {
  context: "commercial",
  one_liner: "A client build that gets handed over",
  needs: { ...NO_NEEDS, auth: true },
  academic: NO_ACADEMIC,
  commercial: {
    has_paying_users: false,
    is_client_work: true,
    handoff_required: true,
    is_live: false,
  },
  builder: { skill_level: "professional", solo_or_team: "team" },
};

/** Minimal commercial: nothing switched on beyond the core feature. */
export const COMMERCIAL_BARE: ProjectProfile = {
  context: "commercial",
  one_liner: "A bare commercial project",
  needs: NO_NEEDS,
  academic: NO_ACADEMIC,
  commercial: NO_COMMERCIAL,
  builder: { skill_level: "first-time", solo_or_team: "solo" },
};

export const ALL_FIXTURES: Record<string, ProjectProfile> = {
  ...FIXTURES,
  COMMERCIAL_SAAS,
  COMMERCIAL_CLIENT_WORK,
  COMMERCIAL_BARE,
};

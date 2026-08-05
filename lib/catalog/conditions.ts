import type {
  Condition,
  Context,
  Deliverable,
  ProjectProfile,
  Submission,
} from "./types";

/** "a academic project" is the kind of slip that makes a user trust the rest less. */
export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function leaf(
  test: (p: ProjectProfile) => boolean,
  describe: string,
  describeFail: string,
): Condition {
  return {
    kind: "leaf",
    test,
    describe: () => describe,
    describeFail: () => describeFail,
  };
}

// ---------------------------------------------------------------- leaves

export const always = (): Condition =>
  leaf(() => true, "this applies to every project", "this never applies");

export const context = (c: Context): Condition =>
  leaf(
    (p) => p.context === c,
    `this is ${article(c)} ${c} project`,
    `this isn't ${article(c)} ${c} project`,
  );

type NeedKey = keyof ProjectProfile["needs"];

/** Both directions written out. Deriving the negative from the positive with
 *  string surgery is unreadable and breaks the moment a label is reworded. */
const NEED_LABEL: Record<NeedKey, { yes: string; no: string }> = {
  auth: { yes: "needs people to log in", no: "doesn't need anyone to log in" },
  payments: { yes: "takes payments", no: "doesn't take payments" },
  file_upload: {
    yes: "handles file uploads",
    no: "doesn't handle file uploads",
  },
  realtime: {
    yes: "needs realtime updates",
    no: "doesn't need realtime updates",
  },
  email: { yes: "sends email", no: "doesn't send email" },
  ai: { yes: "uses AI", no: "doesn't use AI" },
  handles_pii: {
    yes: "handles personal data",
    no: "doesn't handle personal data",
  },
};

export const needs = (k: NeedKey): Condition =>
  leaf(
    (p) => p.needs[k],
    `your project ${NEED_LABEL[k].yes}`,
    `your project ${NEED_LABEL[k].no}`,
  );

export const deliverable = (d: Deliverable): Condition =>
  leaf(
    (p) => p.academic.deliverables.includes(d),
    `your brief asks for a ${d}`,
    `your brief doesn't ask for a ${d}`,
  );

export const mustRunLocally = (): Condition =>
  leaf(
    (p) => p.academic.must_run_locally,
    "this gets marked on someone else's machine",
    "nobody else has to run this locally",
  );

export const hasRubric = (): Condition =>
  leaf(
    (p) => p.academic.has_rubric,
    "you have a marking rubric",
    "you haven't supplied a marking rubric",
  );

export const hasTechConstraints = (): Condition =>
  leaf(
    (p) => p.academic.tech_constraints !== null,
    "your brief mandates a stack",
    "your brief doesn't mandate a stack",
  );

export const isGroup = (): Condition =>
  leaf(
    (p) => p.academic.group_size > 1,
    "this is a group project",
    "you're working solo",
  );

export const isSolo = (): Condition =>
  leaf(
    (p) => p.academic.group_size <= 1,
    "you're working solo",
    "this is a group project",
  );

// ------------------------------------------------ competition-track leaves

const SUBMISSION_LABEL: Record<Submission, string> = {
  repo: "a repo link",
  video: "a demo video",
  writeup: "a written submission",
  "live-demo": "a live, reachable deployment",
};

export const submission = (s: Submission): Condition =>
  leaf(
    (p) => p.competition.submission.includes(s),
    `your submission needs ${SUBMISSION_LABEL[s]}`,
    `your submission doesn't need ${SUBMISSION_LABEL[s]}`,
  );

export const hasSponsorTracks = (): Condition =>
  leaf(
    (p) => p.competition.sponsor_tracks.length > 0,
    "you're going for sponsor prizes",
    "you're not going for any sponsor prizes",
  );

export const hasJudgingCriteria = (): Condition =>
  leaf(
    (p) => p.competition.has_judging_criteria,
    "the judges publish their criteria",
    "you haven't supplied any judging criteria",
  );

/** Null hours means "not time-boxed", which must NOT read as "no time left". */
export const underHours = (n: number): Condition =>
  leaf(
    (p) =>
      p.competition.hours_remaining !== null &&
      p.competition.hours_remaining <= n,
    `you have ${n} hours or less left`,
    `you have more than ${n} hours left`,
  );

// ------------------------------------------------- commercial-track leaves

export const hasPayingUsers = (): Condition =>
  leaf(
    (p) => p.commercial.has_paying_users,
    "you have paying users",
    "nobody is paying you yet",
  );

export const isClientWork = (): Condition =>
  leaf(
    (p) => p.commercial.is_client_work,
    "you're building this for a client",
    "this is your own product, not client work",
  );

export const needsHandoff = (): Condition =>
  leaf(
    (p) => p.commercial.handoff_required,
    "someone else takes this over at the end",
    "nobody else has to take this over",
  );

export const isLive = (): Condition =>
  leaf(
    (p) => p.commercial.is_live,
    "this is already live",
    "this isn't live yet",
  );

export const isTeam = (): Condition =>
  leaf(
    (p) => p.builder.solo_or_team === "team",
    "you're working as a team",
    "you're working solo",
  );

// ----------------------------------------------------------- combinators

/**
 * Combinator describeFail() is a fallback only. The real explanation comes
 * from `firstFailure()` in the engine, which walks the tree WITH the profile
 * and returns the specific leaf that failed — a combinator has no profile in
 * scope, so it cannot know which of its children was the culprit.
 */
export const all = (...children: Condition[]): Condition => ({
  kind: "all",
  children,
  test: (p) => children.every((c) => c.test(p)),
  describe: () => children.map((c) => c.describe()).join(" and "),
  describeFail: () => children.map((c) => c.describeFail()).join(" or "),
});

export const any = (...children: Condition[]): Condition => ({
  kind: "any",
  children,
  test: (p) => children.some((c) => c.test(p)),
  describe: () => children.map((c) => c.describe()).join(" or "),
  describeFail: () => children.map((c) => c.describeFail()).join(" and "),
});

export const not = (child: Condition): Condition => ({
  kind: "not",
  children: [child],
  test: (p) => !child.test(p),
  describe: () => child.describeFail(),
  describeFail: () => child.describe(),
});

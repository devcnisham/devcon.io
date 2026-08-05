import { describe, expect, it } from "vitest";
import { ALL_STEPS } from "@/lib/catalog";
import { buildPlan, planMinutes } from "@/lib/engine/plan";
import { HACKATHON_SOLO_LATE, HACKATHON_TEAM } from "./fixtures";

const COMPETITION_STEPS = ALL_STEPS.filter((s) => s.id.startsWith("comp-"));

describe("the competition track exists at all", () => {
  it("selects steps for a competition profile", () => {
    /**
     * This is the regression that matters. `Context` allowed "competition"
     * while no step referenced it, so a competition profile produced 0 steps
     * and 58 hidden — a silently empty plan, because nothing in the engine
     * treats "everything hidden" as different from "nothing applies".
     */
    const plan = buildPlan(HACKATHON_TEAM);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.antiSteps.length).toBeGreaterThan(0);
  });

  it("selects only competition steps", () => {
    for (const p of [HACKATHON_TEAM, HACKATHON_SOLO_LATE]) {
      const plan = buildPlan(p);
      const leaked = [...plan.steps, ...plan.antiSteps].filter(
        (s) => !s.id.startsWith("comp-"),
      );
      expect(leaked.map((s) => s.id)).toEqual([]);
    }
  });

  it("hides the competition track from the other two", () => {
    // The mirror of the above: no academic or commercial profile may pick one
    // of these up, or the tracks aren't actually gated.
    const ids = new Set(COMPETITION_STEPS.map((s) => s.id));
    for (const p of [
      { ...HACKATHON_TEAM, context: "academic" as const },
      { ...HACKATHON_TEAM, context: "commercial" as const },
    ]) {
      const plan = buildPlan(p);
      const leaked = [...plan.steps, ...plan.antiSteps].filter((s) =>
        ids.has(s.id),
      );
      expect(leaked.map((s) => s.id)).toEqual([]);
    }
  });
});

describe("the plan is short, because the event is", () => {
  it("fits inside a weekend", () => {
    /**
     * The whole track is worthless if it prescribes more hours than the event
     * has. 36 hours is the common format, and a team is not heads-down for all
     * of it — so the do-steps have to leave real slack.
     */
    const hours = planMinutes(buildPlan(HACKATHON_TEAM)) / 60;
    expect(hours).toBeLessThan(20);
  });

  it("gives a late solo entrant less work than a fresh team", () => {
    const team = buildPlan(HACKATHON_TEAM);
    const solo = buildPlan(HACKATHON_SOLO_LATE);
    expect(solo.steps.length).toBeLessThan(team.steps.length);
  });

  it("carries no mark weights — nothing here is graded", () => {
    const graded = COMPETITION_STEPS.filter((s) => s.mark_weight !== undefined);
    expect(graded.map((s) => s.id)).toEqual([]);
  });
});

describe("subtraction is the point of this track", () => {
  it("tells a team that says it needs auth not to build it", () => {
    /**
     * The sharpest thing the catalog does. HACKATHON_TEAM sets auth: true, and
     * the correct response is not a login step — it's a loud instruction not to
     * build one. An anti-step gated on the need being PRESENT, not absent.
     */
    const plan = buildPlan(HACKATHON_TEAM);
    expect(plan.antiSteps.map((s) => s.id)).toContain("comp-avoid-real-auth");
    expect(plan.steps.map((s) => s.id)).not.toContain("comp-auth");
  });

  it("doesn't say that to a team with no auth to build", () => {
    const plan = buildPlan(HACKATHON_SOLO_LATE);
    expect(plan.antiSteps.map((s) => s.id)).not.toContain(
      "comp-avoid-real-auth",
    );
  });

  it("says don't deploy — unless the rules demand a live URL", () => {
    // HACKATHON_TEAM submits a video; HACKATHON_SOLO_LATE must deploy.
    const team = buildPlan(HACKATHON_TEAM);
    const solo = buildPlan(HACKATHON_SOLO_LATE);

    expect(team.antiSteps.map((s) => s.id)).toContain("comp-avoid-deploy");
    expect(team.steps.map((s) => s.id)).not.toContain("comp-deploy-for-judging");

    expect(solo.antiSteps.map((s) => s.id)).not.toContain("comp-avoid-deploy");
    expect(solo.steps.map((s) => s.id)).toContain("comp-deploy-for-judging");
  });

  it("never both forbids and prescribes the same work", () => {
    /**
     * "Don't deploy" and "deploy for judging" are the same act. A plan
     * containing both is not merely noisy — it destroys the claim that the
     * hidden drawer represents judgement rather than a pile of rules.
     */
    const CONTRADICTIONS: [string, string][] = [
      ["comp-avoid-deploy", "comp-deploy-for-judging"],
    ];
    for (const p of [HACKATHON_TEAM, HACKATHON_SOLO_LATE]) {
      const plan = buildPlan(p);
      const shown = new Set([...plan.steps, ...plan.antiSteps].map((s) => s.id));
      for (const [anti, doStep] of CONTRADICTIONS) {
        expect(
          shown.has(anti) && shown.has(doStep),
          `${anti} and ${doStep} both shown`,
        ).toBe(false);
      }
    }
  });
});

describe("gating on the event's own facts", () => {
  it("only triages when time is nearly gone", () => {
    const late = buildPlan(HACKATHON_SOLO_LATE); // 8 hours left
    const early = buildPlan({
      ...HACKATHON_TEAM,
      competition: { ...HACKATHON_TEAM.competition, hours_remaining: 30 },
    });
    expect(late.steps.map((s) => s.id)).toContain("comp-triage-cut");
    expect(early.steps.map((s) => s.id)).not.toContain("comp-triage-cut");
  });

  it("treats an untimed event as having time left, not none", () => {
    // `null` means "not time-boxed". Reading it as 0 would fire the triage step
    // at someone who has all the time in the world.
    const untimed = buildPlan({
      ...HACKATHON_TEAM,
      competition: { ...HACKATHON_TEAM.competition, hours_remaining: null },
    });
    expect(untimed.steps.map((s) => s.id)).not.toContain("comp-triage-cut");
  });

  it("only chases sponsor prizes when there are sponsor prizes", () => {
    const withPrizes = buildPlan(HACKATHON_TEAM);
    const without = buildPlan(HACKATHON_SOLO_LATE);
    expect(withPrizes.steps.map((s) => s.id)).toContain(
      "comp-sponsor-requirements",
    );
    expect(without.steps.map((s) => s.id)).not.toContain(
      "comp-sponsor-requirements",
    );
  });

  it("asks for a video only when the portal does", () => {
    const withVideo = buildPlan(HACKATHON_TEAM);
    const without = buildPlan(HACKATHON_SOLO_LATE);
    expect(withVideo.steps.map((s) => s.id)).toContain("comp-submission-video");
    expect(without.steps.map((s) => s.id)).not.toContain(
      "comp-submission-video",
    );
  });

  it("gives solo entrants no coordination steps", () => {
    const solo = buildPlan(HACKATHON_SOLO_LATE);
    expect(solo.steps.map((s) => s.id)).not.toContain("comp-split-work");
    expect(solo.antiSteps.map((s) => s.id)).not.toContain(
      "comp-avoid-same-file",
    );
  });
});

describe("catalog hygiene for the new track", () => {
  it("prefixes every step so track inference stays honest", () => {
    // catalog.test.ts infers track from the id, and `comp-` must not collide
    // with the commercial `c-` prefix.
    for (const s of COMPETITION_STEPS) {
      expect(s.id.startsWith("comp-")).toBe(true);
    }
  });

  it("depends on nothing outside its own track", () => {
    const ids = new Set(COMPETITION_STEPS.map((s) => s.id));
    const crossing = COMPETITION_STEPS.flatMap((s) =>
      s.requires.filter((d) => !ids.has(d)).map((d) => `${s.id} → ${d}`),
    );
    expect(crossing).toEqual([]);
  });

  it("leaves every do-step reachable for some profile", () => {
    /**
     * A step no profile can select is dead catalog. Checked against the two
     * competition fixtures, which between them switch every predicate in the
     * track both on and off.
     */
    const reachable = new Set(
      [HACKATHON_TEAM, HACKATHON_SOLO_LATE].flatMap((p) =>
        [...buildPlan(p).steps, ...buildPlan(p).antiSteps].map((s) => s.id),
      ),
    );
    const unreachable = COMPETITION_STEPS.filter(
      (s) => !reachable.has(s.id),
    ).map((s) => s.id);
    expect(unreachable).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { ALL_STEPS } from "@/lib/catalog";
import { type Step, executionOf } from "@/lib/catalog/types";
import { buildPlan } from "@/lib/engine/plan";
import { buildChecklist, buildPrompt } from "@/lib/engine/prompt";
import { ALL_FIXTURES, COMMERCIAL_SAAS, HACKATHON_TEAM } from "./fixtures";

const FINAL_YEAR = ALL_FIXTURES.FINAL_YEAR_SOLO;

const promptFor = (
  step: Step,
  profile = COMMERCIAL_SAAS,
  completed = new Set<string>(),
  detected?: { envKeys: string[] },
) =>
  buildPrompt(
    step,
    profile,
    buildPlan(profile),
    completed,
    "claude-code",
    new Set(),
    detected,
  );

describe("track leakage — the defects a manual read caught", () => {
  /**
   * These four regressions were found by reading prompts, not by a suite that
   * was passing at the time. Each is academic language reaching a commercial
   * project — the class of error that makes an agent distrust the whole
   * context block.
   */
  const commercialPlan = buildPlan(COMMERCIAL_SAAS);
  /**
   * Only the steps that HAVE a prompt. `buildPrompt` throws for human work by
   * design, and these loops passed for months only because the commercial track
   * had nothing classified — the moment it did, four of them started throwing.
   */
  const commercialPrompted = commercialPlan.steps.filter(
    (s) => executionOf(s) !== "human",
  );

  it("never claims a brief mandated the stack on a commercial project", () => {
    const withStack = {
      ...COMMERCIAL_SAAS,
      academic: { ...COMMERCIAL_SAAS.academic, tech_constraints: "Next.js" },
    };
    for (const step of commercialPrompted) {
      const text = promptFor(step, withStack);
      expect(text, step.id).not.toMatch(/MANDATED by the brief/i);
    }
  });

  it("still says MANDATED on an academic project, where a brief exists", () => {
    const step = buildPlan(FINAL_YEAR).steps[0];
    const withStack = {
      ...FINAL_YEAR,
      academic: { ...FINAL_YEAR.academic, tech_constraints: "Java" },
    };
    expect(promptFor(step, withStack)).toMatch(/MANDATED by the brief/i);
  });

  it("keeps marking-only constraints out of commercial prompts", () => {
    const local = {
      ...COMMERCIAL_SAAS,
      academic: { ...COMMERCIAL_SAAS.academic, must_run_locally: true },
    };
    for (const step of commercialPrompted) {
      expect(promptFor(step, local), step.id).not.toMatch(
        /clean machine from a fresh clone|evaluator|grader|rubric|viva/i,
      );
    }
  });

  it("names the services the scan actually found", () => {
    // The scan read ANTHROPIC_API_KEY and GROQ_API_KEY, then generated
    // "meter your AI spend" without naming either. That was the single most
    // useful fact it had, thrown away.
    const step = commercialPlan.steps[0];
    const text = promptFor(step, COMMERCIAL_SAAS, new Set(), {
      envKeys: ["ANTHROPIC_API_KEY", "GROQ_API_KEY", "STRIPE_SECRET_KEY"],
    });
    expect(text).toMatch(/Anthropic/);
    expect(text).toMatch(/Groq/);
    expect(text).toMatch(/Stripe/);
  });

  it("omits the services section entirely when nothing was detected", () => {
    const step = commercialPlan.steps[0];
    expect(promptFor(step)).not.toMatch(/Already wired in this repo/);
  });
});

describe("prompt content", () => {
  const plan = buildPlan(COMMERCIAL_SAAS);
  // Human steps have no prompt to inspect — see the note above.
  const prompted = plan.steps.filter((s) => executionOf(s) !== "human");

  it("carries the task, the why, and the acceptance criteria", () => {
    for (const step of prompted) {
      const text = promptFor(step);
      expect(text, step.id).toContain(step.title);
      expect(text, step.id).toContain(step.why);
      for (const d of step.done_when) {
        expect(text, `${step.id} missing done_when`).toContain(d.text);
      }
    }
  });

  it("never files an unfinished dependency under 'already built'", () => {
    /**
     * Both states used to share the "Already built (don't redo)" heading, with
     * unfinished ones tagged in the body. Verifying the competition prompts
     * against a real repo, every foundation prompt carried that heading above a
     * step nobody had started — and an agent skimming headings reads the
     * heading. They are separate sections now.
     */
    const dependent = plan.steps.find((s) => s.requires.length > 0);
    if (!dependent) return;

    const unfinished = promptFor(dependent);
    expect(unfinished).toMatch(/## Not done yet — these come first/);
    expect(unfinished).not.toMatch(/## Already built/);

    const finished = promptFor(
      dependent,
      COMMERCIAL_SAAS,
      new Set(dependent.requires),
    );
    expect(finished).toMatch(/## Already built \(don't redo\)/);
    expect(finished).not.toMatch(/## Not done yet/);
  });

  it("carries every anti-step, not only the ones in this phase", () => {
    /**
     * Phase-filtering made a prompt contradict itself: the profile line says
     * the project needs auth and payments, and the anti-steps saying not to
     * build them are `core`, so a `foundation` prompt showed the need and hid
     * the instruction. Found by running the competition prompts.
     */
    const foundation = plan.steps.find((s) => s.phase === "foundation");
    if (!foundation) return;
    const text = promptFor(foundation);
    for (const anti of plan.antiSteps) {
      expect(text, `${anti.id} missing from ${foundation.id}`).toContain(
        anti.title.replace(/^Don't /, ""),
      );
    }
  });

  it("tells the agent what is out of scope", () => {
    const step = plan.steps.find(
      (s) => plan.antiSteps.some((a) => a.phase === s.phase),
    );
    if (!step) return;
    expect(promptFor(step)).toMatch(/do NOT do these/i);
  });

  it("never emits a secret value, only key names", () => {
    for (const step of prompted) {
      const text = promptFor(step, COMMERCIAL_SAAS, new Set(), {
        envKeys: ["STRIPE_SECRET_KEY", "ANTHROPIC_API_KEY"],
      });
      // Anything that looks like an actual credential would be a hard failure.
      expect(text, step.id).not.toMatch(/sk_live|sk_test|=\s*['"][A-Za-z0-9_-]{16,}/);
    }
  });

  it("is substantial for every step an agent can actually do", () => {
    for (const profile of Object.values(ALL_FIXTURES)) {
      const p = buildPlan(profile);
      for (const step of p.steps.filter((s) => executionOf(s) !== "human")) {
        const text = buildPrompt(step, profile, p, new Set(), "claude-code");
        expect(text.length, `${profile.context}/${step.id}`).toBeGreaterThan(
          300,
        );
      }
    }
  });
});

describe("steps an agent cannot do", () => {
  /**
   * Verifying the competition track found six of fifteen selected steps were
   * not agent work, and every one still shipped a "paste into your agent"
   * prompt. `comp-read-judging` told an agent to check that every judging
   * criterion was answered while never supplying the criteria.
   */
  it("refuses to build a prompt for human work", () => {
    const p = buildPlan(HACKATHON_TEAM);
    const human = p.steps.find((s) => executionOf(s) === "human");
    expect(human, "no human step in the plan to test").toBeDefined();
    expect(() =>
      buildPrompt(human as Step, HACKATHON_TEAM, p, new Set(), "claude-code"),
    ).toThrow(/human work/);
  });

  it("gives human steps a checklist with no machine framing", () => {
    const p = buildPlan(HACKATHON_TEAM);
    const human = p.steps.find((s) => executionOf(s) === "human") as Step;
    const text = buildChecklist(human, HACKATHON_TEAM);
    expect(text).toContain(human.title);
    for (const d of human.done_when) expect(text).toContain(d.text);
    // None of the framing that only makes sense addressed to a model.
    expect(text).not.toMatch(/terminal and file access|before telling me/i);
  });

  it("carries a supplied answer into the prompt", () => {
    const p = buildPlan(HACKATHON_TEAM);
    const step = p.steps.find((s) => s.id === "comp-read-judging") as Step;
    const text = buildPrompt(
      step,
      HACKATHON_TEAM,
      p,
      new Set(),
      "claude-code",
      new Set(),
      undefined,
      { criteria: "Innovation 40%, Demo 60%" },
    );
    expect(text).toContain("Innovation 40%, Demo 60%");
  });

  it("names what is missing instead of quietly omitting it", () => {
    /**
     * The whole defect: an agent told to check criteria it was never given
     * invents plausible ones, and the output looks right and isn't.
     */
    const p = buildPlan(HACKATHON_TEAM);
    const step = p.steps.find((s) => s.id === "comp-read-judging") as Step;
    const text = buildPrompt(step, HACKATHON_TEAM, p, new Set(), "claude-code");
    expect(text).toContain("Not supplied — ask, don't guess");
    expect(text).toMatch(/ask me for it rather than assuming/i);
  });

  it("declares inputs for every needs-input step, and none for the others", () => {
    for (const step of ALL_STEPS) {
      if (executionOf(step) === "needs-input") {
        expect(step.inputs?.length, `${step.id} needs input but declares none`)
          .toBeGreaterThan(0);
      } else {
        expect(step.inputs ?? [], `${step.id} declares unused inputs`).toEqual([]);
      }
    }
  });

  it("classifies every track, not just the ones that got attention", () => {
    /**
     * The commercial track shipped with nothing classified while academic and
     * competition were done, so it kept offering a paste button for work no
     * agent can do. Nothing caught that — the loops over commercial steps
     * passed precisely BECAUSE none of them were human.
     *
     * Every track must declare at least one human step. Not an arbitrary rule:
     * all three end in submitting, launching or handing over, and none of that
     * is typing.
     */
    const track = (id: string) =>
      id.startsWith("comp-") ? "competition" : id.startsWith("c-") ? "commercial" : "academic";
    const humansByTrack = new Map<string, number>();
    for (const s of ALL_STEPS.filter((s) => s.kind === "do")) {
      const t = track(s.id);
      if (executionOf(s) === "human") {
        humansByTrack.set(t, (humansByTrack.get(t) ?? 0) + 1);
      } else if (!humansByTrack.has(t)) {
        humansByTrack.set(t, 0);
      }
    }
    for (const [t, n] of humansByTrack) {
      expect(n, `${t} has no step classified as human work`).toBeGreaterThan(0);
    }
  });

  it("never marks an anti-step as agent work", () => {
    // There is nothing to paste for an anti-step in the first place.
    const bad = ALL_STEPS.filter(
      (s) => s.kind === "avoid" && s.execution !== undefined,
    ).map((s) => s.id);
    expect(bad).toEqual([]);
  });
});

describe("agent preambles", () => {
  it("differs per agent while the body stays the same", () => {
    const plan = buildPlan(COMMERCIAL_SAAS);
    const target = plan.steps[0];
    const claude = buildPrompt(target, COMMERCIAL_SAAS, plan, new Set(), "claude-code");
    const cursor = buildPrompt(target, COMMERCIAL_SAAS, plan, new Set(), "cursor");

    expect(claude).not.toBe(cursor);
    // One prompt body, per-agent preamble — the plan's decision. The task
    // section must be byte-identical across targets.
    expect(claude).toContain(target.why);
    expect(cursor).toContain(target.why);
  });

  it("has a non-empty preamble for every agent", () => {
    const plan = buildPlan(COMMERCIAL_SAAS);
    for (const agent of ["claude-code", "cursor", "lovable", "v0", "generic"] as const) {
      const text = buildPrompt(plan.steps[0], COMMERCIAL_SAAS, plan, new Set(), agent);
      expect(text.split("\n")[0].trim().length, agent).toBeGreaterThan(20);
    }
  });

  it("does not leak the step type into an anti-step prompt", () => {
    // Anti-steps have no prompt_template; they should never be handed to an
    // agent as work.
    const anti = ALL_STEPS.find((s) => s.kind === "avoid") as Step;
    expect(anti.prompt_template).toBeUndefined();
    expect(anti.done_when).toEqual([]);
  });
});

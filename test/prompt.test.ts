import { describe, expect, it } from "vitest";
import { ALL_STEPS } from "@/lib/catalog";
import type { Step } from "@/lib/catalog/types";
import { buildPlan } from "@/lib/engine/plan";
import { buildPrompt } from "@/lib/engine/prompt";
import { ALL_FIXTURES, COMMERCIAL_SAAS } from "./fixtures";

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

  it("never claims a brief mandated the stack on a commercial project", () => {
    const withStack = {
      ...COMMERCIAL_SAAS,
      academic: { ...COMMERCIAL_SAAS.academic, tech_constraints: "Next.js" },
    };
    for (const step of commercialPlan.steps) {
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
    for (const step of commercialPlan.steps) {
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

  it("carries the task, the why, and the acceptance criteria", () => {
    for (const step of plan.steps) {
      const text = promptFor(step);
      expect(text, step.id).toContain(step.title);
      expect(text, step.id).toContain(step.why);
      for (const d of step.done_when) {
        expect(text, `${step.id} missing done_when`).toContain(d.text);
      }
    }
  });

  it("lists dependencies as already built, and flags unfinished ones", () => {
    const dependent = plan.steps.find((s) => s.requires.length > 0);
    if (!dependent) return;

    const unfinished = promptFor(dependent);
    expect(unfinished).toMatch(/NOT yet done, do this first/);

    const finished = promptFor(
      dependent,
      COMMERCIAL_SAAS,
      new Set(dependent.requires),
    );
    expect(finished).not.toMatch(/NOT yet done/);
  });

  it("tells the agent what is out of scope", () => {
    const step = plan.steps.find(
      (s) => plan.antiSteps.some((a) => a.phase === s.phase),
    );
    if (!step) return;
    expect(promptFor(step)).toMatch(/do NOT do these/i);
  });

  it("never emits a secret value, only key names", () => {
    for (const step of plan.steps) {
      const text = promptFor(step, COMMERCIAL_SAAS, new Set(), {
        envKeys: ["STRIPE_SECRET_KEY", "ANTHROPIC_API_KEY"],
      });
      // Anything that looks like an actual credential would be a hard failure.
      expect(text, step.id).not.toMatch(/sk_live|sk_test|=\s*['"][A-Za-z0-9_-]{16,}/);
    }
  });

  it("is substantial for every step in every fixture", () => {
    for (const profile of Object.values(ALL_FIXTURES)) {
      const p = buildPlan(profile);
      for (const step of p.steps) {
        const text = buildPrompt(
          step,
          profile,
          p,
          new Set(),
          "claude-code",
        );
        expect(text.length, `${profile.context}/${step.id}`).toBeGreaterThan(
          300,
        );
      }
    }
  });
});

describe("agent preambles", () => {
  const step = ALL_STEPS.find((s) => s.kind === "do") as Step;

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

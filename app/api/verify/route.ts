import { NextResponse } from "next/server";
import { buildPlan } from "@/lib/engine/plan";
import { buildPrompt } from "@/lib/engine/prompt";
import { profileFromDigest } from "@/lib/scan/profile";
import type { RepoDigest } from "@/lib/scan/types";

/**
 * Prompt verification against a real repo. DEVELOPMENT ONLY.
 *
 * The catalog rubric says a prompt isn't verified until it's been run against a
 * real repo. This is the machine-checkable half of that: it generates every
 * prompt for a scanned project and checks the factual claims inside them
 * against what the scan actually found.
 *
 * It cannot judge whether a prompt produces good code — that still needs a
 * human pasting it into an agent. What it catches is the failure that matters
 * more: a prompt confidently telling someone to build what they already have.
 */
const DEV_ONLY = process.env.NODE_ENV !== "production";

interface Finding {
  stepId: string;
  severity: "error" | "warning";
  problem: string;
}

export async function GET(request: Request) {
  if (!DEV_ONLY) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("path");
  if (!target) {
    return NextResponse.json(
      { error: "No path given", hint: "Pass ?path=/absolute/path/to/repo" },
      { status: 400 },
    );
  }

  // Reuse the scan route rather than duplicating its logic — if the scanner is
  // wrong, verification should be wrong in the same way and surface it.
  const scanRes = await fetch(
    `${url.origin}/api/scan?path=${encodeURIComponent(target)}`,
  );
  const digest: RepoDigest & { error?: string } = await scanRes.json();
  if (digest.error) return NextResponse.json(digest, { status: 400 });

  const { profile, alreadyDone } = profileFromDigest(digest);
  const plan = buildPlan(profile);
  const completed = new Set(alreadyDone.map((d) => d.stepId));

  const m = digest.markers;
  const findings: Finding[] = [];

  const prompts = plan.steps.map((step) => {
    const text = buildPrompt(
      step,
      profile,
      plan,
      completed,
      "claude-code",
      new Set(),
      { envKeys: digest.envKeys },
    );

    const isDone = completed.has(step.id);
    const flag = (severity: Finding["severity"], problem: string) =>
      findings.push({ stepId: step.id, severity, problem });

    // ---- Claim checks -------------------------------------------------
    // Each of these is a way the prompt could be confidently wrong.

    // 1. Telling someone to build something the repo already has.
    if (isDone && !/already|existing|in place/i.test(text)) {
      flag(
        "error",
        "step is satisfied by the repo but the prompt reads as build-from-scratch",
      );
    }

    // 2. Naming a stack the repo doesn't use.
    const stack = profile.academic.tech_constraints;
    if (stack && !text.includes(stack)) {
      flag("warning", `detected stack "${stack}" not mentioned in the prompt`);
    }

    // 3. Auth steps on a repo with auth already wired.
    if (m.authWired && /wire authentication/i.test(step.title) && !isDone) {
      flag("error", "auth is wired in the repo but the step isn't marked done");
    }

    // 4. Webhook steps where signature verification already exists.
    if (
      m.webhookSignatureVerified &&
      /webhook/i.test(step.title) &&
      !isDone &&
      /signature/i.test(text)
    ) {
      flag(
        "error",
        "webhook signature verification already present but the prompt asks for it",
      );
    }

    // 5. Legal pages that already exist.
    if (m.hasLegalPages && /privacy|terms/i.test(step.title) && !isDone) {
      flag("error", "legal pages exist in the repo but the step isn't done");
    }

    // 6. Dependencies referenced that aren't finished — the prompt says
    //    "already built" for something that isn't.
    for (const dep of step.requires) {
      if (!completed.has(dep) && /don't redo/i.test(text)) {
        const depStep = plan.steps.find((s) => s.id === dep);
        if (depStep && text.includes(`- ${depStep.title}\n`)) {
          flag(
            "error",
            `lists "${depStep.title}" under "already built" but it isn't complete`,
          );
        }
      }
    }

    // 7. Empty or stub content.
    if (step.kind === "do" && step.done_when.length === 0) {
      flag("error", "no done_when — nothing for the agent to verify against");
    }
    if (text.length < 300) {
      flag("warning", "prompt is suspiciously short — likely missing context");
    }

    // ---- Track-leak checks --------------------------------------------
    // Added after a manual read caught four defects this suite missed. Every
    // one of them was academic language appearing on a commercial project.

    // 8. Claiming a brief mandated the stack when there is no brief.
    if (profile.context !== "academic" && /MANDATED by the brief/i.test(text)) {
      flag(
        "error",
        "claims the stack was 'mandated by the brief' on a non-academic project",
      );
    }

    // 9. Marking constraints leaking into production work.
    if (
      profile.context !== "academic" &&
      /clean machine from a fresh clone|evaluator|grader|rubric|viva/i.test(text)
    ) {
      flag("error", "academic-only language in a commercial prompt");
    }

    // 10. The scan found real services but the prompt doesn't name them.
    if (digest.envKeys.length > 5 && !/Already wired in this repo/.test(text)) {
      flag(
        "warning",
        "scan detected services but the prompt names none of them",
      );
    }

    return {
      id: step.id,
      title: step.title,
      done: isDone,
      chars: text.length,
      text,
    };
  });

  return NextResponse.json({
    repo: digest.name,
    context: profile.context,
    steps: plan.steps.length,
    alreadyDone: alreadyDone.length,
    hidden: plan.hidden.length,
    markers: m,
    findings,
    prompts,
  });
}

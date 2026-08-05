import { article } from "../catalog/conditions";
import { PROVIDERS } from "../catalog/providers";
import type { Plan, ProjectProfile, Step } from "../catalog/types";

export type AgentTarget = "claude-code" | "cursor" | "lovable" | "v0" | "generic";

export const AGENT_LABEL: Record<AgentTarget, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  lovable: "Lovable",
  v0: "v0",
  generic: "Any agent",
};

/**
 * Agent-specific preamble.
 *
 * The plan's decision: one prompt body plus a per-agent preamble, rather than
 * N separately-authored prompts. These agents differ in what they can see and
 * do, not in what the task is — so only the framing changes.
 */
const PREAMBLE: Record<AgentTarget, string> = {
  "claude-code":
    "You have terminal and file access. Read the existing code before changing it, and run the verification commands yourself rather than assuming they pass.",
  cursor:
    "Use the open workspace as context. Prefer editing existing files over creating new ones, and show me a diff before applying wide changes.",
  lovable:
    "Build this inside the current project. Keep it to the screens named below — don't scaffold extra pages.",
  v0:
    "Generate only the component(s) described. Match the existing styling conventions rather than introducing a new design system.",
  generic:
    "Work inside the existing project. Don't restructure files that aren't mentioned.",
};

function stackLine(profile: ProjectProfile): string {
  const parts: string[] = [];
  if (profile.academic.tech_constraints) {
    // Only an academic brief can MANDATE a stack. On a commercial project the
    // same field is just the detected framework — calling that a mandate is a
    // claim the prompt has no basis for, and the kind of confident falsehood
    // that makes an agent distrust everything else in the context.
    parts.push(
      profile.context === "academic"
        ? `MANDATED by the brief: ${profile.academic.tech_constraints}. Do not substitute anything else.`
        : `Built on ${profile.academic.tech_constraints} — match the existing conventions rather than introducing another framework.`,
    );
  }
  // Academic-only. A commercial project deploys to a host; "must run on a
  // clean machine" is a marking constraint, not a production one.
  if (profile.context === "academic" && profile.academic.must_run_locally) {
    parts.push(
      "Must run on a clean machine from a fresh clone — no globally-installed tooling assumed, all versions pinned.",
    );
  }
  return parts.join(" ");
}

/** Readable phrases, not raw field names — "handles pii" reads like a bug. */
const NEED_PHRASE: Record<keyof ProjectProfile["needs"], string> = {
  auth: "users to sign in",
  payments: "payments",
  file_upload: "file uploads",
  realtime: "realtime updates",
  email: "transactional email",
  ai: "AI features",
  handles_pii: "handling of personal data",
};

function needsLine(profile: ProjectProfile): string {
  const on = (
    Object.keys(profile.needs) as (keyof ProjectProfile["needs"])[]
  ).filter((k) => profile.needs[k]);
  if (!on.length) return "nothing beyond the core feature";
  const phrases = on.map((k) => NEED_PHRASE[k]);
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`;
}

// `article` is shared with the condition DSL, which had the same bug in the
// hidden-drawer copy. Engine may import from catalog; the reverse would cycle.

/**
 * Name the services a repo is actually wired to, from its env key prefixes.
 *
 * The scan already reads these. Naming them turns "meter your AI spend" into
 * "meter your Anthropic and Groq spend", which is the difference between a
 * generic instruction and one an agent can act on without asking.
 */
const KEY_TO_SERVICE: [RegExp, string][] = [
  [/^CLERK_|^NEXT_PUBLIC_CLERK_/, "Clerk (auth)"],
  [/^SUPABASE_|^NEXT_PUBLIC_SUPABASE_/, "Supabase"],
  [/^DATABASE_URL$|^DIRECT_URL$/, "Postgres"],
  [/^STRIPE_/, "Stripe (payments)"],
  [/^RAZORPAY_|^NEXT_PUBLIC_RAZORPAY_/, "Razorpay (payments)"],
  [/^ANTHROPIC_/, "Anthropic (LLM)"],
  [/^GROQ_/, "Groq (LLM)"],
  [/^OPENAI_/, "OpenAI (LLM)"],
  [/^RESEND_|^EMAIL_FROM$/, "Resend (email)"],
  [/^SENTRY_|^NEXT_PUBLIC_SENTRY_/, "Sentry (errors)"],
  [/^NEXT_PUBLIC_POSTHOG_/, "PostHog (analytics)"],
  [/^WHATSAPP_/, "WhatsApp Business API"],
  [/^CRON_SECRET$/, "scheduled jobs"],
];

function namedServices(envKeys: string[]): string[] {
  const out = new Set<string>();
  for (const key of envKeys) {
    for (const [re, name] of KEY_TO_SERVICE) {
      if (re.test(key)) out.add(name);
    }
  }
  return [...out];
}

/**
 * Assemble the prompt for a step.
 *
 * This is TEMPLATE ASSEMBLY, not LLM personalisation. The plan specifies
 * `personalizeStep()` as an LLM job; that isn't wired yet. What this does is
 * still real and deterministic: it injects the actual profile, the actual
 * completed steps, the actual connected services and the actual anti-steps —
 * context a generic prompt would not carry.
 */
export function buildPrompt(
  step: Step,
  profile: ProjectProfile,
  plan: Plan,
  completed: Set<string>,
  agent: AgentTarget,
  connected: Set<string> = new Set(),
  /**
   * Services the SCAN found in the repo, as opposed to ones the user connected
   * by hand in Integrations. Without this the prompt for "meter AI spend" never
   * names Anthropic or Groq, even though the scan read both keys — the single
   * most useful fact it had, thrown away.
   */
  detected?: { envKeys: string[] },
): string {
  const done = plan.steps.filter((s) => completed.has(s.id));
  const deps = step.requires
    .map((id) => plan.steps.find((s) => s.id === id))
    .filter((s): s is Step => Boolean(s));

  const services = PROVIDERS.filter((p) => connected.has(p.id));
  const constraints = stackLine(profile);
  const detectedServices = detected ? namedServices(detected.envKeys) : [];

  /**
   * EVERY anti-step, not just the ones in this phase.
   *
   * Filtering by phase was an optimisation that produced a direct
   * contradiction. On the competition track the profile line says "it needs
   * users to sign in, payments" — because the builder said so — while the
   * anti-steps say don't build either. Those anti-steps are `core` phase, so a
   * `foundation` prompt showed the need and hid the instruction not to serve
   * it, and an agent reading it would go and build auth.
   *
   * There are at most eight of them and they are the most important thing the
   * catalog says. Repeating them costs a few lines per prompt and removes the
   * only place where a generated prompt argued with itself.
   */
  const relevantAnti = plan.antiSteps;

  const lines: string[] = [
    PREAMBLE[agent],
    "",
    "## Project",
    `${profile.one_liner}`,
    `This is ${article(profile.context)} ${profile.context} project. It needs ${needsLine(profile)}.`,
    constraints ? constraints : "",
    "",
    "## Task",
    `**${step.title}**`,
    "",
    step.why,
  ];

  /**
   * Dependencies, split by whether they are actually finished.
   *
   * They used to share one "Already built (don't redo)" heading, with unfinished
   * ones tagged "— NOT yet done" in the body. The heading and the body said
   * opposite things, and an agent skimming headings reads the heading. Verifying
   * the competition prompts, every foundation prompt carried
   * "## Already built (don't redo)" above a step that had not been started.
   */
  const builtDeps = deps.filter((d) => completed.has(d.id));
  const pendingDeps = deps.filter((d) => !completed.has(d.id));

  if (builtDeps.length) {
    lines.push(
      "",
      "## Already built (don't redo)",
      ...builtDeps.map((d) => `- ${d.title}`),
    );
  }

  if (pendingDeps.length) {
    lines.push(
      "",
      "## Not done yet — these come first",
      ...pendingDeps.map((d) => `- ${d.title}`),
      "If the work below depends on one of these, say so rather than building it as well.",
    );
  }

  if (done.length && done.length !== deps.length) {
    const others = done.filter((d) => !deps.some((x) => x.id === d.id));
    if (others.length) {
      lines.push(
        "",
        "## Also already done",
        ...others.slice(0, 8).map((d) => `- ${d.title}`),
      );
    }
  }

  if (detectedServices.length) {
    lines.push(
      "",
      "## Already wired in this repo",
      ...detectedServices.map((s) => `- ${s}`),
      "Use what's already here rather than introducing an alternative.",
    );
  }

  if (services.length) {
    lines.push(
      "",
      "## Services you chose in DevCon",
      ...services.map(
        (s) => `- ${s.name} — env: ${s.env_vars.map((v) => v.key).join(", ")}`,
      ),
      "Reference these by env var name. Never inline a key value.",
    );
  }

  if (step.done_when.length) {
    lines.push(
      "",
      "## Done when",
      ...step.done_when.map((d) => `- [ ] ${d.text}`),
      "",
      "Verify each of these before telling me it's finished.",
    );
  }

  if (relevantAnti.length) {
    lines.push(
      "",
      "## Out of scope — do NOT do these",
      ...relevantAnti.map((a) => `- ${a.title.replace(/^Don't /, "")} — ${a.why}`),
    );
  }

  lines.push(
    "",
    "## Budget",
    `This step is estimated at ${step.est_minutes} minutes${
      step.mark_weight ? ` and is worth ${step.mark_weight}% of the grade` : ""
    }. If your approach is going to take substantially longer, say so before starting.`,
  );

  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}

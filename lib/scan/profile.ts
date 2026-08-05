import type { ProjectProfile } from "../catalog/types";
import type { RepoDigest } from "./types";

/** Dependency-name signals. Deliberate, auditable, no LLM guessing. */
const SIGNALS = {
  auth: [
    "@clerk/",
    "next-auth",
    "@auth/",
    "lucia",
    "better-auth",
    "@auth0/",
    "@supabase/auth",
    "passport",
    "firebase",
  ],
  payments: ["stripe", "@lemonsqueezy/", "@paddle/", "@polar-sh/", "braintree"],
  email: ["resend", "nodemailer", "@sendgrid/", "postmark", "mailgun"],
  file_upload: [
    "uploadthing",
    "multer",
    "cloudinary",
    "@aws-sdk/client-s3",
    "busboy",
    "formidable",
  ],
  realtime: ["socket.io", "pusher", "ably", "partykit", "@supabase/realtime"],
  ai: [
    "@anthropic-ai/",
    "openai",
    "@google/generative-ai",
    "langchain",
    "ai",
    "ollama",
  ],
} as const;

/**
 * Env-key signals.
 *
 * Often stronger than dependency names, and decisive in a monorepo where the
 * root package.json is nearly empty. A key called STRIPE_SECRET_KEY is a
 * harder fact about intent than a package appearing in a lockfile.
 */
const ENV_SIGNALS = {
  auth: ["CLERK_", "AUTH0_", "NEXTAUTH_", "SUPABASE_ANON", "FIREBASE_"],
  payments: ["STRIPE_", "RAZORPAY_", "PADDLE_", "LEMONSQUEEZY_", "POLAR_"],
  email: ["RESEND_", "SENDGRID_", "POSTMARK_", "MAILGUN_", "SMTP_", "EMAIL_FROM"],
  file_upload: ["UPLOADTHING_", "CLOUDINARY_", "S3_", "AWS_ACCESS_KEY"],
  realtime: ["PUSHER_", "ABLY_", "SUPABASE_REALTIME"],
  ai: ["ANTHROPIC_", "OPENAI_", "GROQ_", "GOOGLE_GENERATIVE", "GEMINI_"],
} as const;

function hits(deps: string[], patterns: readonly string[]): boolean {
  return deps.some((d) => patterns.some((p) => d.startsWith(p) || d === p));
}

/** Signals a scan can see that don't map to a `needs` field, but matter. */
const EXTRA_SIGNALS: { label: string; keys: string[]; deps: string[] }[] = [
  { label: "error monitoring", keys: ["SENTRY_"], deps: ["@sentry/"] },
  {
    label: "product analytics",
    keys: ["POSTHOG_", "NEXT_PUBLIC_POSTHOG"],
    deps: ["posthog-js"],
  },
  { label: "scheduled jobs", keys: ["CRON_SECRET"], deps: [] },
  { label: "WhatsApp messaging", keys: ["WHATSAPP_"], deps: [] },
];

export interface Inference {
  profile: ProjectProfile;
  /** What each conclusion was based on, so nothing is a black box. */
  evidence: { field: string; because: string }[];
  /** Step ids the repo already satisfies, with the evidence for each. */
  alreadyDone: { stepId: string; because: string }[];
}

/**
 * Steps the repo shows evidence of having finished.
 *
 * Pre-ticking these is the difference between a plan that reads the project
 * and one that ignores it. Deliberately conservative: a false "done" hides
 * real work, which is worse than a false "todo" the user can tick themselves.
 */
function detectCompleted(
  digest: RepoDigest,
): { stepId: string; because: string }[] {
  const m = digest.markers;
  const done: { stepId: string; because: string }[] = [];
  const mark = (stepId: string, because: string) => done.push({ stepId, because });

  if (m.authWired) {
    mark("c-auth", "auth middleware is wired");
  }
  if (m.authWired && m.webhookRoutes.some((r) => /clerk|auth|user/i.test(r))) {
    mark("c-auth-db-sync", "an auth webhook route exists");
  }
  if (m.schemaModels > 5 && m.migrationCount > 0) {
    mark(
      "c-data-model",
      `${m.schemaModels} models and ${m.migrationCount} migrations`,
    );
  }
  if (m.webhookRoutes.some((r) => /stripe|razorpay|paddle|lemon/i.test(r))) {
    mark("c-payments-checkout", "a payment webhook route exists");
    if (m.webhookSignatureVerified) {
      mark("c-payments-webhooks", "webhook signature verification present");
    }
  }
  if (m.hasSubscriptionModel) {
    mark("c-entitlements", "a subscription model exists in the schema");
  }
  if (m.hasLegalPages) {
    mark("c-legal-pages", "privacy and terms pages exist");
  }
  if (m.hasErrorMonitoring) {
    mark("c-error-monitoring", "error monitoring is configured");
  }
  if (m.hasRateLimit) {
    mark("c-rate-limits", "rate limiting found in route handlers");
  }
  if (digest.envKeys.length > 5 && digest.skipped.length === 0) {
    mark("c-secrets", ".env.example lists key names, .env is not committed");
  }
  if (m.apiRoutes > 10) {
    mark("c-core-feature", `${m.apiRoutes} API routes exist`);
  }

  return done;
}

/**
 * Derive a profile from a repo digest.
 *
 * Deterministic and evidence-backed — every inference records what it saw.
 * The plan calls for an LLM pass here eventually; this is the honest floor
 * until then, and a floor the LLM should have to beat rather than replace.
 */
export function profileFromDigest(digest: RepoDigest): Inference {
  const deps = [...digest.dependencies, ...digest.devDependencies];
  const evidence: { field: string; because: string }[] = [];

  const note = (field: string, because: string) =>
    evidence.push({ field, because });

  const found = (key: keyof typeof SIGNALS): boolean => {
    const byDep = deps.filter((d) =>
      SIGNALS[key].some((p) => d.startsWith(p) || d === p),
    );
    const byEnv = digest.envKeys.filter((k) =>
      ENV_SIGNALS[key].some((p) => k.startsWith(p) || k === p),
    );
    if (byDep.length) note(key, `dependency ${byDep.slice(0, 3).join(", ")}`);
    if (byEnv.length) note(key, `env key ${byEnv.slice(0, 3).join(", ")}`);
    return byDep.length > 0 || byEnv.length > 0;
  };

  const needs = {
    auth: found("auth"),
    payments: found("payments"),
    file_upload: found("file_upload"),
    realtime: found("realtime"),
    email: found("email"),
    ai: found("ai"),
    handles_pii: false,
  };

  // Auth implies user records, which implies personal data. Stated rather than
  // silently assumed, because it turns on steps the builder should see a
  // reason for.
  needs.handles_pii = needs.auth;
  if (needs.auth) {
    note("handles_pii", "auth is present, so you're storing user records");
  }

  // Framework, for the mandated-stack line in prompts.
  let framework: string | null = null;
  if (hits(deps, ["next"])) framework = "Next.js";
  else if (hits(deps, ["react"])) framework = "React";
  else if (hits(deps, ["vue"])) framework = "Vue";
  else if (hits(deps, ["svelte"])) framework = "Svelte";
  else if (digest.configFiles.includes("requirements.txt")) framework = "Python";
  else if (digest.configFiles.includes("Cargo.toml")) framework = "Rust";
  else if (digest.configFiles.includes("go.mod")) framework = "Go";
  else if (digest.configFiles.includes("pom.xml")) framework = "Java";
  if (framework) note("stack", `detected ${framework}`);

  // How far along it is — drives which phase the plan starts in.
  const state =
    digest.fileCount < 10
      ? "idea-only"
      : digest.migrations.length || digest.directories.length > 8
        ? "partially-built"
        : "scaffold-exists";
  note(
    "state",
    `${digest.fileCount} files, ${digest.directories.length} directories, ${digest.migrations.length} migration files`,
  );

  if (digest.envKeys.length) {
    note("env", `${digest.envKeys.length} keys named in .env.example`);
  }
  if (digest.hasTests) note("tests", "test files or a test directory exist");
  if (digest.workspaces > 0) {
    note("structure", `monorepo — ${digest.workspaces} workspace packages`);
  }

  for (const sig of EXTRA_SIGNALS) {
    const k = digest.envKeys.filter((x) =>
      sig.keys.some((p) => x.startsWith(p)),
    );
    const d = deps.filter((x) => sig.deps.some((p) => x.startsWith(p)));
    if (k.length || d.length) {
      note(sig.label, [...k, ...d].slice(0, 2).join(", "));
    }
  }

  /**
   * Which track this belongs to.
   *
   * Payments, error monitoring or analytics mean a project with real users —
   * that is not coursework, and pretending otherwise would produce a plan
   * about writing a report for something that takes money.
   */
  const commercialSignals = [
    needs.payments && "payments",
    digest.envKeys.some((k) => k.startsWith("SENTRY_")) && "error monitoring",
    digest.envKeys.some((k) => k.includes("POSTHOG")) && "product analytics",
  ].filter(Boolean) as string[];

  const context = commercialSignals.length > 0 ? "commercial" : "academic";
  if (commercialSignals.length) {
    note("context", `commercial — found ${commercialSignals.join(", ")}`);
  }

  const profile: ProjectProfile = {
    context,
    one_liner: digest.name ?? "Imported project",
    needs,
    academic: {
      deadline_date: null,
      // Assumed, not detected — a repo can't tell you what the brief asks for.
      deliverables: ["code", "report", "demo"],
      must_run_locally: true,
      tech_constraints: framework,
      has_rubric: false,
      group_size: 1,
    },
    competition: {
      /**
       * Never inferred, always empty.
       *
       * A repo cannot tell you that you're at a hackathon, how long is left,
       * or which sponsor prizes you're entering — those are facts about an
       * event, not about code. The scan says nothing rather than guessing, and
       * a competition profile has to be set explicitly.
       */
      hours_remaining: null,
      submission: [],
      sponsor_tracks: [],
      has_judging_criteria: false,
    },
    commercial: {
      // Payments wired is the closest a scan gets to "someone might pay".
      // Whether anyone actually has is not visible from the filesystem.
      has_paying_users: false,
      // Neither of these is knowable from a repo — they're relationship facts.
      is_client_work: false,
      handoff_required: false,
      // A production deploy config isn't proof of live traffic, so this stays
      // false until the user says otherwise.
      is_live: false,
    },
    builder: {
      skill_level: "some-experience",
      solo_or_team: digest.workspaces > 2 ? "team" : "solo",
    },
  };

  const alreadyDone = detectCompleted(digest);
  if (alreadyDone.length) {
    note("completed", `${alreadyDone.length} steps already satisfied by the repo`);
  }

  return { profile, evidence, alreadyDone };
}

/** Fields a scan genuinely cannot know — surfaced so the user fills them in. */
export const UNKNOWABLE_FROM_SCAN = [
  "deadline",
  "deliverables the brief asks for",
  "marking rubric",
  "how many people are on it",
] as const;

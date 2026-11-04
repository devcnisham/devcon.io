import type { MergedDependencies } from "./dependencies";

/**
 * Works out what a project is, from evidence.
 *
 * Every conclusion carries a confidence score and the evidence behind it.
 * A dependency alone is weak — plenty of projects carry one they no longer
 * use. A dependency plus a config file plus a matching directory layout is
 * strong. Telling a new developer something wrong with certainty is worse than
 * telling them it is a guess, so the score is part of the output, never
 * discarded.
 */

export type Detection = {
  id: string;
  name: string;
  confidence: number;
  evidence: string[];
  /** The declared dependency range, when one exists. */
  version?: string | null;
  /** Configuration files that corroborated this detection. */
  configFiles?: string[];
};

/** Turns a score into words. Scores are for sorting; words are for people. */
export function confidenceLabel(score: number): string {
  if (score >= 0.9) return "certain";
  if (score >= 0.65) return "likely";
  if (score >= 0.35) return "possible";
  return "a guess";
}

type Signal = {
  /** How much this signal is worth on its own. */
  weight: number;
  describe: string;
};

function score(signals: Signal[]): { confidence: number; evidence: string[] } {
  // Diminishing returns: independent signals reinforce each other, but no
  // single one — and no pile of weak ones — reaches certainty on its own.
  let remaining = 1;
  for (const signal of signals) remaining *= 1 - signal.weight;

  return {
    confidence: Math.min(1, Number((1 - remaining).toFixed(3))),
    evidence: signals.map((signal) => signal.describe),
  };
}

const has = (paths: string[], pattern: RegExp) =>
  paths.some((path) => pattern.test(path));

type FrameworkRule = {
  id: string;
  name: string;
  /** First match wins for version reporting. */
  dependencies?: string[];
  configs?: RegExp;
  layout?: RegExp;
  /** Dropped when any of these more specific frameworks also matched. */
  supersededBy?: string[];
};

/**
 * Nineteen frameworks across seven ecosystems.
 *
 * Meta-frameworks list what they supersede: a SvelteKit project is not
 * "SvelteKit and Svelte". Reporting both is noise, and a beginner reading the
 * list cannot tell which one they are actually working in.
 */
const FRAMEWORKS: FrameworkRule[] = [
  // Node — meta-frameworks first, so their suppression targets are known.
  {
    id: "nextjs",
    name: "Next.js",
    dependencies: ["next"],
    configs: /(^|\/)next\.config\.[cm]?[jt]s$/,
    layout: /(^|\/)(app|pages)\/(page|layout)\.[cm]?[jt]sx?$/,
  },
  {
    id: "nuxt",
    name: "Nuxt",
    dependencies: ["nuxt"],
    configs: /(^|\/)nuxt\.config\.[cm]?[jt]s$/,
  },
  {
    id: "sveltekit",
    name: "SvelteKit",
    dependencies: ["@sveltejs/kit"],
    configs: /(^|\/)svelte\.config\.[cm]?js$/,
  },
  {
    id: "react-native",
    name: "React Native",
    dependencies: ["react-native", "expo"],
    configs: /(^|\/)(metro\.config\.[cm]?js|app\.json)$/,
  },
  {
    id: "electron",
    name: "Electron",
    dependencies: ["electron"],
    configs: /(^|\/)electron\.vite\.config\.[cm]?[jt]s$/,
  },
  {
    id: "tauri",
    name: "Tauri",
    dependencies: ["@tauri-apps/api", "tauri"],
    configs: /(^|\/)src-tauri\/tauri\.conf\.json$/,
    layout: /(^|\/)src-tauri\//,
  },
  {
    id: "nestjs",
    name: "NestJS",
    dependencies: ["@nestjs/core"],
    configs: /(^|\/)nest-cli\.json$/,
  },
  {
    id: "angular",
    name: "Angular",
    dependencies: ["@angular/core"],
    configs: /(^|\/)angular\.json$/,
  },
  { id: "express", name: "Express", dependencies: ["express"] },
  { id: "fastify", name: "Fastify", dependencies: ["fastify"] },

  // Base libraries — suppressed when a meta-framework above matched.
  {
    id: "react",
    name: "React",
    dependencies: ["react"],
    layout: /\.[jt]sx$/,
    supersededBy: ["nextjs", "react-native"],
  },
  {
    id: "vue",
    name: "Vue",
    dependencies: ["vue"],
    layout: /\.vue$/,
    supersededBy: ["nuxt"],
  },
  {
    id: "svelte",
    name: "Svelte",
    dependencies: ["svelte"],
    layout: /\.svelte$/,
    supersededBy: ["sveltekit"],
  },

  // Python
  {
    id: "django",
    name: "Django",
    dependencies: ["django"],
    layout: /(^|\/)manage\.py$/,
  },
  { id: "fastapi", name: "FastAPI", dependencies: ["fastapi"] },
  { id: "flask", name: "Flask", dependencies: ["flask"] },

  // PHP, Ruby, Java, Dart
  {
    id: "laravel",
    name: "Laravel",
    dependencies: ["laravel/framework"],
    layout: /(^|\/)artisan$/,
  },
  {
    id: "rails",
    name: "Ruby on Rails",
    dependencies: ["rails"],
    layout: /(^|\/)config\/routes\.rb$/,
  },
  {
    id: "spring",
    name: "Spring",
    dependencies: [
      "org.springframework.boot:spring-boot-starter",
      "org.springframework.boot:spring-boot-starter-web",
      "org.springframework:spring-core",
    ],
  },
  {
    id: "flutter",
    name: "Flutter",
    dependencies: ["flutter"],
    configs: /(^|\/)pubspec\.yaml$/,
    layout: /(^|\/)lib\/main\.dart$/,
  },
];

export function detectFrameworks(input: {
  dependencies: MergedDependencies;
  paths: string[];
}): Detection[] {
  const matched: Detection[] = [];

  for (const rule of FRAMEWORKS) {
    const signals: Signal[] = [];
    let version: string | null = null;

    for (const name of rule.dependencies ?? []) {
      if (!input.dependencies.has(name)) continue;

      // The declared range, not a resolved version: the lockfile that would
      // give the installed one may not be present, and reporting a guess as
      // fact is worse than reporting what the project asked for.
      version ??= input.dependencies.versionOf(name);
      signals.push({
        weight: 0.6,
        describe: `\`${name}\`${version ? ` ${version}` : ""} in dependencies`,
      });
    }

    const configFiles = rule.configs
      ? input.paths.filter((path) => rule.configs!.test(path))
      : [];

    for (const file of configFiles.slice(0, 2)) {
      signals.push({ weight: 0.7, describe: `configuration file \`${file}\`` });
    }

    if (rule.layout && input.paths.some((path) => rule.layout!.test(path))) {
      signals.push({ weight: 0.4, describe: "matching directory layout" });
    }

    if (signals.length === 0) continue;

    matched.push({
      id: rule.id,
      name: rule.name,
      version,
      configFiles,
      ...score(signals),
    });
  }

  const ids = new Set(matched.map((entry) => entry.id));
  const filtered = matched.filter((entry) => {
    const rule = FRAMEWORKS.find((r) => r.id === entry.id);
    return !rule?.supersededBy?.some((other) => ids.has(other));
  });

  return filtered.sort((a, b) => b.confidence - a.confidence);
}

export type Architecture = {
  style: "monorepo" | "single-app" | "unknown";
  layering: "feature-first" | "layer-first" | "flat" | "unknown";
  confidence: number;
  evidence: string[];
};

export function detectArchitecture(input: {
  paths: string[];
  manifestCount: number;
}): Architecture {
  const signals: Signal[] = [];
  let style: Architecture["style"] = "unknown";

  const workspaceDirs = /^(packages|apps|services)\//;
  if (has(input.paths, workspaceDirs)) {
    style = "monorepo";
    signals.push({ weight: 0.6, describe: "workspace directories present" });
  }

  if (input.manifestCount > 1) {
    style = "monorepo";
    signals.push({
      weight: 0.5,
      describe: `${input.manifestCount} package manifests`,
    });
  }

  if (style === "unknown" && input.manifestCount === 1) {
    style = "single-app";
    signals.push({ weight: 0.5, describe: "a single package manifest" });
  }

  // Feature-first groups by domain; layer-first groups by technical role.
  const featureFirst = input.paths.filter((p) =>
    /(^|\/)(features|modules|domains)\//.test(p)
  ).length;
  const layerFirst = input.paths.filter((p) =>
    /(^|\/)(controllers|models|views|services|repositories)\//.test(p)
  ).length;

  let layering: Architecture["layering"] = "unknown";
  if (featureFirst > 0 || layerFirst > 0) {
    layering = featureFirst >= layerFirst ? "feature-first" : "layer-first";
    signals.push({
      weight: 0.5,
      describe:
        layering === "feature-first"
          ? "code grouped by feature"
          : "code grouped by technical layer",
    });
  } else if (input.paths.some((p) => p.includes("/"))) {
    layering = "flat";
  }

  return { style, layering, ...score(signals) };
}

type FeatureRule = {
  id: string;
  name: string;
  dependencies?: string[];
  paths?: RegExp;
};

const FEATURES: FeatureRule[] = [
  {
    id: "auth",
    name: "Authentication",
    dependencies: [
      "next-auth",
      "@auth/core",
      "passport",
      "lucia",
      "@clerk/nextjs",
      "bcrypt",
      "argon2",
      "@node-rs/argon2",
    ],
    paths: /(^|\/)(login|signup|sign-in|sign-up|auth)(\/|\.)/,
  },
  {
    id: "payments",
    name: "Payments",
    dependencies: ["stripe", "@stripe/stripe-js", "braintree", "razorpay"],
    paths: /(^|\/)(checkout|billing|pricing|payments?)(\/|\.)/,
  },
  {
    id: "realtime",
    name: "Realtime",
    dependencies: ["socket.io", "ws", "pusher", "ably", "partykit"],
  },
  {
    id: "uploads",
    name: "File uploads",
    dependencies: ["multer", "uploadthing", "busboy", "@aws-sdk/client-s3"],
  },
  {
    id: "email",
    name: "Email",
    dependencies: ["resend", "nodemailer", "@sendgrid/mail", "postmark"],
  },
  {
    id: "background-jobs",
    name: "Background jobs",
    dependencies: ["bullmq", "@trigger.dev/sdk", "inngest", "celery", "agenda"],
  },
  {
    id: "ai",
    name: "AI",
    dependencies: [
      "openai",
      "@anthropic-ai/sdk",
      "@google/generative-ai",
      "langchain",
      "ai",
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    dependencies: [
      "posthog-js",
      "@vercel/analytics",
      "mixpanel-browser",
      "@segment/analytics-node",
    ],
  },
];

export function detectFeatures(input: {
  dependencies: MergedDependencies;
  paths: string[];
}): Detection[] {
  const found: Detection[] = [];

  for (const rule of FEATURES) {
    const signals: Signal[] = [];

    for (const name of rule.dependencies ?? []) {
      if (input.dependencies.has(name)) {
        signals.push({ weight: 0.7, describe: `\`${name}\` in dependencies` });
      }
    }

    if (rule.paths) {
      const matches = input.paths.filter((path) => rule.paths!.test(path));
      if (matches.length > 0) {
        signals.push({
          weight: 0.45,
          describe: `${matches.length} matching path${matches.length === 1 ? "" : "s"}, e.g. \`${matches[0]}\``,
        });
      }
    }

    if (signals.length === 0) continue;

    found.push({ id: rule.id, name: rule.name, ...score(signals) });
  }

  return found.sort((a, b) => b.confidence - a.confidence);
}

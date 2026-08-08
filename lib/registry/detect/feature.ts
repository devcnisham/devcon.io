import { type Feature, featureModule } from "../modules/feature";
import type { Detector, DetectorInput } from "../types";

/**
 * Infer features from what a repo contains.
 *
 * Everything here produces a *suggestion*, never a registry entry. Inference is
 * wrong often enough — a package installed and never used, a route scaffolded
 * and abandoned — that writing straight into the registry would make the
 * registry the thing nobody trusts. A person accepts or dismisses; only then
 * does it become real.
 *
 * Every rule carries the evidence it matched on, because "we think you have
 * Authentication" is not actionable and "next-auth is in your dependencies" is.
 */

interface Rule {
  /** Feature this suggests. */
  name: string;
  category: string;
  /** Dependency names. Prefix match, so "@clerk/" catches every Clerk package. */
  deps?: string[];
  /** Env var name prefixes. Often stronger evidence than a dependency. */
  envPrefixes?: string[];
  /** Path fragments, matched case-insensitively against every file path. */
  paths?: RegExp[];
}

/**
 * Ordered by how confident the signal is, not alphabetically — the dashboard
 * shows suggestions in this order and the strongest ones should be first.
 */
export const FEATURE_RULES: Rule[] = [
  {
    name: "Authentication",
    category: "Security",
    deps: [
      "next-auth",
      "@auth/",
      "@clerk/",
      "lucia",
      "better-auth",
      "@auth0/",
      "@supabase/auth",
      "passport",
      "firebase-auth",
    ],
    envPrefixes: ["CLERK_", "AUTH0_", "NEXTAUTH_", "AUTH_SECRET"],
  },
  {
    name: "Payments",
    category: "Commerce",
    deps: [
      "stripe",
      "@stripe/",
      "razorpay",
      "@lemonsqueezy/",
      "@paddle/",
      "@polar-sh/",
      "braintree",
    ],
    envPrefixes: ["STRIPE_", "RAZORPAY_", "PADDLE_", "LEMONSQUEEZY_", "POLAR_"],
  },
  {
    name: "AI",
    category: "Intelligence",
    deps: [
      "@anthropic-ai/",
      "openai",
      "@google/generative-ai",
      "langchain",
      "ollama",
      "groq-sdk",
      "ai",
    ],
    envPrefixes: [
      "ANTHROPIC_",
      "OPENAI_",
      "GROQ_",
      "GEMINI_",
      "GOOGLE_GENERATIVE",
    ],
  },
  {
    name: "Realtime",
    category: "Infrastructure",
    deps: [
      "socket.io",
      "socket.io-client",
      "pusher",
      "pusher-js",
      "ably",
      "partykit",
      "@supabase/realtime-js",
    ],
    envPrefixes: ["PUSHER_", "ABLY_"],
  },
  {
    name: "Email",
    category: "Communication",
    deps: [
      "resend",
      "nodemailer",
      "@sendgrid/",
      "postmark",
      "mailgun.js",
      "react-email",
      "@react-email/",
    ],
    envPrefixes: [
      "RESEND_",
      "SENDGRID_",
      "POSTMARK_",
      "MAILGUN_",
      "SMTP_",
      "EMAIL_FROM",
    ],
  },
  {
    name: "File Upload",
    category: "Content",
    deps: [
      "uploadthing",
      "@uploadthing/",
      "multer",
      "cloudinary",
      "@aws-sdk/client-s3",
      "busboy",
      "formidable",
    ],
    envPrefixes: ["UPLOADTHING_", "CLOUDINARY_", "S3_", "AWS_ACCESS_KEY"],
  },
  {
    name: "Database",
    category: "Infrastructure",
    deps: [
      "@prisma/client",
      "prisma",
      "drizzle-orm",
      "mongoose",
      "typeorm",
      "kysely",
      "@supabase/supabase-js",
    ],
    envPrefixes: ["DATABASE_URL", "DIRECT_URL", "SUPABASE_", "MONGODB_URI"],
    paths: [/(^|\/)schema\.prisma$/i, /(^|\/)migrations\//i],
  },
  {
    name: "Background Jobs",
    category: "Infrastructure",
    deps: [
      "bullmq",
      "bull",
      "agenda",
      "inngest",
      "@trigger.dev/",
      "graphile-worker",
    ],
    envPrefixes: ["CRON_SECRET"],
    paths: [/(^|\/)(jobs|workers|queues)\//i],
  },
  {
    name: "Error Monitoring",
    category: "Operations",
    deps: ["@sentry/", "bugsnag", "rollbar"],
    envPrefixes: ["SENTRY_"],
  },
  {
    name: "Analytics",
    category: "Operations",
    deps: [
      "posthog-js",
      "posthog-node",
      "@vercel/analytics",
      "mixpanel",
      "amplitude-js",
    ],
    envPrefixes: ["POSTHOG_", "NEXT_PUBLIC_POSTHOG", "MIXPANEL_"],
  },
  {
    name: "Search",
    category: "Content",
    deps: [
      "algoliasearch",
      "meilisearch",
      "typesense",
      "@elastic/elasticsearch",
      "flexsearch",
    ],
    envPrefixes: ["ALGOLIA_", "MEILI_", "TYPESENSE_"],
  },
  {
    name: "Admin Panel",
    category: "Product",
    paths: [/(^|\/)admin\//i],
  },
  {
    name: "Dashboard",
    category: "Product",
    paths: [/(^|\/)dashboard\//i],
  },
  {
    name: "Teams",
    category: "Product",
    paths: [/(^|\/)(teams|organizations|workspaces)\//i],
  },
  {
    name: "Notifications",
    category: "Communication",
    deps: ["novu", "@novu/", "web-push", "expo-notifications"],
    paths: [/(^|\/)notifications?\//i],
  },
  {
    name: "Internationalisation",
    category: "Content",
    deps: ["next-intl", "i18next", "react-i18next", "@lingui/"],
    paths: [/(^|\/)(locales|messages|i18n)\//i],
  },
];

/** Prefix match, so "@clerk/" catches "@clerk/nextjs" without listing each package. */
function matchDeps(deps: string[], patterns: string[]): string[] {
  return deps.filter((d) => patterns.some((p) => d === p || d.startsWith(p)));
}

function matchEnv(keys: string[], prefixes: string[]): string[] {
  return keys.filter((k) => prefixes.some((p) => k.startsWith(p)));
}

function matchPaths(files: string[], patterns: RegExp[]): string[] {
  return files.filter((f) => patterns.some((re) => re.test(f)));
}

export const featureDetector: Detector<Feature> = {
  module: "feature",

  detect(input: DetectorInput): Feature[] {
    const out: Feature[] = [];

    for (const rule of FEATURE_RULES) {
      const evidence: string[] = [];
      const files: string[] = [];

      const deps = rule.deps ? matchDeps(input.dependencies, rule.deps) : [];
      for (const d of deps.slice(0, 3)) evidence.push(`dependency ${d}`);

      const env = rule.envPrefixes
        ? matchEnv(input.envKeys, rule.envPrefixes)
        : [];
      for (const k of env.slice(0, 3)) evidence.push(`env key ${k}`);

      const paths = rule.paths ? matchPaths(input.files, rule.paths) : [];
      for (const p of paths.slice(0, 3)) {
        evidence.push(`path ${p}`);
        files.push(p);
      }

      if (!evidence.length) continue;

      /**
       * A directory alone is weak evidence — `admin/` might be one stub page.
       * A dependency or an env key is a decision someone made deliberately. So
       * a path-only match still suggests, but says less confidently why.
       */
      const pathOnly = !deps.length && !env.length;

      out.push(
        featureModule.hydrate({
          name: rule.name,
          category: rule.category,
          origin: "detected",
          review: "suggested",
          evidence,
          files: files.slice(0, 10),
          // Something is there, so it isn't "planned" — but a detector cannot
          // know whether it's finished. "building" is the honest floor.
          status: pathOnly ? "planned" : "building",
          tags: pathOnly ? ["low-confidence"] : [],
        }),
      );
    }

    return out;
  },
};

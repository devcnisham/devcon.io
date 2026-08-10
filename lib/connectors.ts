import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Services a project can be wired to.
 *
 * **Deliberately thin.** Free-tier numbers and quickstart steps rot faster than
 * this file will be maintained, so each entry carries only what it is for, the
 * free tier in one clause, the packages that prove it is installed, the
 * environment variable *names*, and the official link. Nothing restates a
 * provider's documentation.
 *
 * **No credentials, ever.** devcon does not ask for, display, store or write an
 * API key. It names the variables; you put the values in `.env.local`, which is
 * gitignored. A form that accepted a service key would be a credential surface
 * inside a tool whose second rule is that no secret enters the repo.
 */

export type Capability =
  | "source"
  | "database"
  | "auth"
  | "hosting"
  | "payments"
  | "email";

export interface Connector {
  id: string;
  name: string;
  capability: Capability;
  /** One line: what it does, then the free tier after a middle dot. */
  what: string;
  tier: string;
  /** Any of these in package.json means it is installed. */
  packages: string[];
  /** Names only. Never values. */
  env: string[];
  docs: string;
  /** Has an MCP server, so the agent can drive it directly. */
  mcp?: boolean;
  /** Tailwind classes for the letter tile. */
  tile: string;
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  source: "Source control",
  database: "Database",
  auth: "Authentication",
  hosting: "Hosting",
  payments: "Payments",
  email: "Email",
};

export const CONNECTORS: Connector[] = [
  {
    id: "github",
    name: "GitHub",
    capability: "source",
    what: "Where the code lives, and what a submission link points at",
    tier: "Unlimited public and private repos",
    packages: [],
    env: ["GITHUB_TOKEN"],
    docs: "https://docs.github.com/en/get-started",
    mcp: true,
    tile: "from-neutral-500 to-neutral-700",
  },
  {
    id: "supabase",
    name: "Supabase",
    capability: "database",
    what: "Postgres with auth and storage included",
    tier: "500MB database, 2 projects",
    packages: ["@supabase/supabase-js", "@supabase/ssr"],
    env: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    docs: "https://supabase.com/docs",
    mcp: true,
    tile: "from-emerald-500 to-emerald-700",
  },
  {
    id: "neon",
    name: "Neon",
    capability: "database",
    what: "Serverless Postgres with branching",
    tier: "0.5GB storage, 10 branches",
    packages: ["@neondatabase/serverless"],
    env: ["DATABASE_URL"],
    docs: "https://neon.com/docs",
    mcp: true,
    tile: "from-sky-400 to-sky-600",
  },
  {
    id: "turso",
    name: "Turso",
    capability: "database",
    what: "SQLite at the edge",
    tier: "500 databases, 9GB total",
    packages: ["@libsql/client"],
    env: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
    docs: "https://docs.turso.tech",
    tile: "from-amber-400 to-orange-600",
  },
  {
    id: "sqlite",
    name: "Local SQLite",
    capability: "database",
    what: "A file on disk — no account, no network",
    tier: "Free forever",
    packages: ["better-sqlite3", "node:sqlite"],
    env: [],
    docs: "https://nodejs.org/api/sqlite.html",
    tile: "from-rose-400 to-rose-600",
  },
  {
    id: "clerk",
    name: "Clerk",
    capability: "auth",
    what: "Drop-in sign-in UI",
    tier: "10,000 monthly active users",
    packages: ["@clerk/nextjs", "@clerk/clerk-react"],
    env: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    docs: "https://clerk.com/docs",
    mcp: true,
    tile: "from-violet-400 to-purple-600",
  },
  {
    id: "supabase-auth",
    name: "Supabase Auth",
    capability: "auth",
    what: "Comes free if you already use Supabase",
    tier: "50,000 monthly active users",
    packages: ["@supabase/auth-helpers-nextjs"],
    env: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    docs: "https://supabase.com/docs/guides/auth",
    tile: "from-amber-400 to-amber-600",
  },
  {
    id: "authjs",
    name: "Auth.js",
    capability: "auth",
    what: "Self-hosted, no vendor",
    tier: "Open source",
    packages: ["next-auth", "@auth/core"],
    env: ["AUTH_SECRET"],
    docs: "https://authjs.dev",
    tile: "from-indigo-400 to-violet-600",
  },
  {
    id: "vercel",
    name: "Vercel",
    capability: "hosting",
    what: "Deploys from a git push and gives you a URL to hand in",
    tier: "Hobby projects, non-commercial",
    packages: ["vercel"],
    env: ["VERCEL_OIDC_TOKEN"],
    docs: "https://vercel.com/docs",
    mcp: true,
    tile: "from-neutral-400 to-neutral-600",
  },
  {
    id: "resend",
    name: "Resend",
    capability: "email",
    what: "Sending email that arrives",
    tier: "3,000 emails a month",
    packages: ["resend"],
    env: ["RESEND_API_KEY"],
    docs: "https://resend.com/docs",
    tile: "from-zinc-300 to-zinc-500",
  },
  {
    id: "stripe",
    name: "Stripe",
    capability: "payments",
    what: "Taking money — rarely needed for a college project",
    tier: "Pay per transaction, no monthly fee",
    packages: ["stripe", "@stripe/stripe-js"],
    env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    docs: "https://docs.stripe.com",
    tile: "from-indigo-400 to-blue-600",
  },
];

export interface ConnectorState extends Connector {
  /** A package of this provider is in the project's dependencies. */
  installed: boolean;
}

/**
 * Which providers a project has actually installed.
 *
 * Read from `package.json` dependencies — evidence, not a checkbox. It says a
 * package is present. It does **not** say the thing works; only a runnable
 * check can say that.
 */
export async function detectConnectors(
  projectPath: string,
): Promise<ConnectorState[]> {
  let deps: Record<string, unknown> = {};
  try {
    const pkg = JSON.parse(
      await readFile(join(projectPath, "package.json"), "utf8"),
    );
    deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  } catch {
    deps = {};
  }

  return CONNECTORS.map((c) => ({
    ...c,
    installed: c.packages.some((p) => p in deps),
  }));
}

/** Same dull matching as the workspace filter: lowercase, all terms required. */
export function filterConnectors(
  list: ConnectorState[],
  rawQuery: string | undefined,
): { items: ConnectorState[]; query: string } {
  const query = (rawQuery ?? "").trim();
  if (!query) return { items: list, query: "" };

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const items = list.filter((c) => {
    const hay =
      `${c.name} ${c.what} ${c.tier} ${c.capability} ${c.env.join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  return { items, query };
}

const ORDER: Capability[] = [
  "database",
  "auth",
  "hosting",
  "source",
  "email",
  "payments",
];

export function byCapability(
  list: ConnectorState[],
): [Capability, ConnectorState[]][] {
  return ORDER.map((cap): [Capability, ConnectorState[]] => [
    cap,
    list.filter((c) => c.capability === cap),
  ]).filter(([, items]) => items.length > 0);
}

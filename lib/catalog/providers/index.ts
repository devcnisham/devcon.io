export type Capability =
  | "auth"
  | "database"
  | "payments"
  | "email"
  | "file-storage"
  | "llm"
  | "version-control"
  | "project-management";

export interface EnvVar {
  key: string;
  where_to_get: string;
}

/**
 * An MCP server entry for a provider.
 *
 * Two transports, kept apart in the type because they emit different config and
 * confusing them fails silently. A remote entry written without a `type` is read
 * as a stdio server, and the client skips it with "has a url but no type" —
 * config that looks correct in the panel and connects to nothing.
 */
export type McpServer = McpStdioServer | McpRemoteServer;

export interface McpStdioServer {
  transport: "stdio";
  name: string;
  /** Pasted into the agent's MCP config. Never contains a secret value. */
  command: string;
  args: string[];
  /**
   * Env var NAMES the server needs. Values stay with the user, always.
   *
   * Emitted as `${NAME}`, which MCP clients expand from the user's own
   * environment. The previous `<your NAME>` placeholder was worse than useless:
   * the server starts, then fails on its first authenticated call, so the config
   * reads as working right up until it doesn't.
   */
  env?: string[];
}

export interface McpRemoteServer {
  /** `sse` only where a service still exposes nothing else — it's deprecated. */
  transport: "http" | "sse";
  name: string;
  url: string;
  /**
   * Header templates, e.g. `{ Authorization: "Bearer ${GITHUB_TOKEN}" }`.
   * Names and `${…}` references only — same rule as `env`, no values.
   */
  headers?: Record<string, string>;
  /**
   * The server runs OAuth on first connect, so the config carries no key at all.
   * True for most hosted servers now, and the reason remote beats stdio here.
   */
  oauth?: boolean;
}

export interface Provider {
  id: string;
  capability: Capability;
  name: string;
  /** One line, shown on the card. */
  about: string;
  free_tier: string;
  tradeoffs: { pro: string[]; con: string[] };
  env_vars: EnvVar[];
  mcp_server?: McpServer;
  docs_url: string;
  /** Free tiers rot. Anything older than 90 days should be re-checked. */
  last_verified: string;
  /** Added by the builder, not from the catalog. Never claims verification. */
  custom?: boolean;
}

/** A service the builder added themselves, for anything the catalog misses. */
export function makeCustomProvider(input: {
  capability: Capability;
  name: string;
  about: string;
  envKeys: string[];
}): Provider {
  return {
    id: `custom:${input.capability}:${input.name.toLowerCase().replace(/\s+/g, "-")}`,
    capability: input.capability,
    name: input.name,
    about: input.about || "Added by you",
    free_tier: "—",
    tradeoffs: { pro: [], con: [] },
    env_vars: input.envKeys.map((key) => ({
      key,
      where_to_get: "Your own service",
    })),
    docs_url: "",
    last_verified: "",
    custom: true,
  };
}

export const CAPABILITY_LABEL: Record<Capability, string> = {
  database: "Database",
  auth: "Authentication",
  payments: "Payments",
  email: "Email",
  "file-storage": "File storage",
  llm: "AI / LLM",
  "version-control": "Version control",
  "project-management": "Project management",
};

/** Render order. Roughly the order a project needs them. */
export const CAPABILITY_ORDER: Capability[] = [
  "database",
  "auth",
  "payments",
  "email",
  "file-storage",
  "llm",
  "version-control",
  "project-management",
];

const V = "2026-08-04";

/**
 * Seed provider catalog. Free tiers are NOT YET VERIFIED — they have not been
 * re-checked against the live services, so `last_verified` is the seed date,
 * not a real audit.
 *
 * The `mcp_server` entries are the exception: every endpoint below was checked
 * against the vendor's own docs on 2026-08-05. That is a narrower claim than
 * `last_verified` makes, and deliberately not folded into it — three of the
 * five original entries were stale or dead, and a date covering both would
 * have hidden that.
 */
export const PROVIDERS: Provider[] = [
  // ------------------------------------------------------------- database
  {
    id: "supabase",
    capability: "database",
    name: "Supabase",
    about: "Postgres with auth and storage included",
    free_tier: "500MB database, 2 projects",
    tradeoffs: {
      pro: ["Real Postgres, not a custom API", "Auth and storage included"],
      con: ["Free projects pause when idle"],
    },
    env_vars: [
      { key: "NEXT_PUBLIC_SUPABASE_URL", where_to_get: "Project settings → API" },
      {
        key: "SUPABASE_SERVICE_ROLE_KEY",
        where_to_get: "Project settings → API (server only)",
      },
    ],
    mcp_server: {
      transport: "http",
      name: "supabase",
      // Hosted server. A personal access token used to be required and no
      // longer is — OAuth on first connect. `read_only=true` is deliberate:
      // an agent with write access to your database is not a default.
      url: "https://mcp.supabase.com/mcp?read_only=true",
      oauth: true,
    },
    docs_url: "https://supabase.com/docs",
    last_verified: V,
  },
  {
    id: "neon",
    capability: "database",
    name: "Neon",
    about: "Serverless Postgres with branching",
    free_tier: "0.5GB storage, 10 branches",
    tradeoffs: {
      pro: ["Database branching per PR", "Scales to zero"],
      con: ["Just the database — no auth or storage"],
    },
    env_vars: [
      { key: "DATABASE_URL", where_to_get: "Dashboard → Connection string" },
    ],
    mcp_server: {
      transport: "http",
      name: "neon",
      // The local stdio server was removed in Feb 2026 and the npm package is
      // deprecated — remote is the only supported path now.
      url: "https://mcp.neon.tech/mcp",
      oauth: true,
    },
    docs_url: "https://neon.tech/docs",
    last_verified: V,
  },
  {
    id: "turso",
    capability: "database",
    name: "Turso",
    about: "SQLite at the edge",
    free_tier: "500 databases, 9GB total",
    tradeoffs: {
      pro: ["Very fast reads", "Generous free tier"],
      con: ["SQLite semantics, not Postgres"],
    },
    env_vars: [
      { key: "TURSO_DATABASE_URL", where_to_get: "turso db show" },
      { key: "TURSO_AUTH_TOKEN", where_to_get: "turso db tokens create" },
    ],
    docs_url: "https://docs.turso.tech",
    last_verified: V,
  },
  {
    id: "sqlite-local",
    capability: "database",
    name: "Local SQLite",
    about: "A file on disk — no account, no network",
    free_tier: "Free forever",
    tradeoffs: {
      pro: ["Nothing to sign up for", "Perfect when it's marked locally"],
      con: ["No sharing, no hosting"],
    },
    env_vars: [],
    docs_url: "https://www.sqlite.org/docs.html",
    last_verified: V,
  },

  // ----------------------------------------------------------------- auth
  {
    id: "clerk",
    capability: "auth",
    name: "Clerk",
    about: "Drop-in sign-in UI",
    free_tier: "10,000 monthly active users",
    tradeoffs: {
      pro: ["Components you don't have to build", "Sessions handled properly"],
      con: ["Another vendor in the stack"],
    },
    env_vars: [
      {
        key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        where_to_get: "Dashboard → API keys",
      },
      { key: "CLERK_SECRET_KEY", where_to_get: "Dashboard → API keys" },
    ],
    mcp_server: {
      transport: "http",
      name: "clerk",
      // Streamable HTTP only — Clerk exposes no stdio server.
      url: "https://mcp.clerk.com/mcp",
      oauth: true,
    },
    docs_url: "https://clerk.com/docs",
    last_verified: V,
  },
  {
    id: "supabase-auth",
    capability: "auth",
    name: "Supabase Auth",
    about: "Comes free if you already use Supabase",
    free_tier: "50,000 monthly active users",
    tradeoffs: {
      pro: ["No extra service", "Row-level security ties to it"],
      con: ["You build the UI yourself"],
    },
    env_vars: [
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", where_to_get: "Project settings → API" },
    ],
    docs_url: "https://supabase.com/docs/guides/auth",
    last_verified: V,
  },
  {
    id: "authjs",
    capability: "auth",
    name: "Auth.js",
    about: "Self-hosted, no vendor",
    free_tier: "Open source",
    tradeoffs: {
      pro: ["No third party holds your users", "Explainable at a viva"],
      con: ["You own the session bugs"],
    },
    env_vars: [
      { key: "AUTH_SECRET", where_to_get: "npx auth secret" },
      { key: "AUTH_URL", where_to_get: "Your app's base URL" },
    ],
    docs_url: "https://authjs.dev",
    last_verified: V,
  },
  {
    id: "fake-login",
    capability: "auth",
    name: "Hardcoded login",
    about: "A login screen with no provider behind it",
    free_tier: "Free",
    tradeoffs: {
      pro: ["Zero setup", "Enough for most coursework"],
      con: ["Not remotely secure — never ship it"],
    },
    env_vars: [],
    docs_url: "",
    last_verified: V,
  },

  // ------------------------------------------------------------- payments
  {
    id: "stripe",
    capability: "payments",
    name: "Stripe",
    about: "The default, for good reason",
    free_tier: "No monthly fee; per-transaction",
    tradeoffs: {
      pro: ["Excellent test mode", "Every guide assumes it"],
      con: ["Webhooks are where the hours go"],
    },
    env_vars: [
      { key: "STRIPE_SECRET_KEY", where_to_get: "Developers → API keys" },
      {
        key: "STRIPE_WEBHOOK_SECRET",
        where_to_get: "Webhooks → signing secret",
      },
    ],
    mcp_server: {
      transport: "http",
      name: "stripe",
      // Hosted, OAuth. The stdio form took STRIPE_SECRET_KEY through the config
      // file — a live payments key, in the one place this product refuses to
      // put one.
      url: "https://mcp.stripe.com",
      oauth: true,
    },
    docs_url: "https://stripe.com/docs",
    last_verified: V,
  },
  {
    id: "lemonsqueezy",
    capability: "payments",
    name: "Lemon Squeezy",
    about: "Merchant of record — handles tax",
    free_tier: "No monthly fee; higher per-transaction",
    tradeoffs: {
      pro: ["Sales tax and VAT handled for you", "Much less setup"],
      con: ["Higher fees", "Less control over checkout"],
    },
    env_vars: [{ key: "LEMONSQUEEZY_API_KEY", where_to_get: "Settings → API" }],
    docs_url: "https://docs.lemonsqueezy.com",
    last_verified: V,
  },
  {
    id: "polar",
    capability: "payments",
    name: "Polar",
    about: "Merchant of record aimed at developers",
    free_tier: "No monthly fee",
    tradeoffs: {
      pro: ["Good developer experience", "Tax handled"],
      con: ["Younger, smaller ecosystem"],
    },
    env_vars: [
      { key: "POLAR_ACCESS_TOKEN", where_to_get: "Settings → Developers" },
    ],
    docs_url: "https://docs.polar.sh",
    last_verified: V,
  },
  {
    id: "paddle",
    capability: "payments",
    name: "Paddle",
    about: "Merchant of record, B2B leaning",
    free_tier: "No monthly fee",
    tradeoffs: {
      pro: ["Handles global tax", "Built for SaaS billing"],
      con: ["Approval process before you can sell"],
    },
    env_vars: [{ key: "PADDLE_API_KEY", where_to_get: "Developer tools → Authentication" }],
    docs_url: "https://developer.paddle.com",
    last_verified: V,
  },

  // ---------------------------------------------------------------- email
  {
    id: "resend",
    capability: "email",
    name: "Resend",
    about: "Simple API, React Email support",
    free_tier: "3,000 emails/month",
    tradeoffs: {
      pro: ["Cleanest API of the group", "Write templates in React"],
      con: ["Custom domain needs DNS work"],
    },
    env_vars: [{ key: "RESEND_API_KEY", where_to_get: "Dashboard → API keys" }],
    docs_url: "https://resend.com/docs",
    last_verified: V,
  },
  {
    id: "postmark",
    capability: "email",
    name: "Postmark",
    about: "Built for transactional deliverability",
    free_tier: "100 emails/month",
    tradeoffs: {
      pro: ["Best-in-class inbox placement"],
      con: ["Very small free tier"],
    },
    env_vars: [
      { key: "POSTMARK_SERVER_TOKEN", where_to_get: "Server → API tokens" },
    ],
    docs_url: "https://postmarkapp.com/developer",
    last_verified: V,
  },
  {
    id: "sendgrid",
    capability: "email",
    name: "SendGrid",
    about: "Long-established, broad feature set",
    free_tier: "100 emails/day",
    tradeoffs: {
      pro: ["Marketing and transactional in one"],
      con: ["Heavier API", "Stricter onboarding review"],
    },
    env_vars: [{ key: "SENDGRID_API_KEY", where_to_get: "Settings → API keys" }],
    docs_url: "https://docs.sendgrid.com",
    last_verified: V,
  },
  {
    id: "nodemailer-smtp",
    capability: "email",
    name: "SMTP direct",
    about: "Your own mail server or a university relay",
    free_tier: "Free if you have a relay",
    tradeoffs: {
      pro: ["No signup", "Often what a university already provides"],
      con: ["Deliverability is your problem"],
    },
    env_vars: [
      { key: "SMTP_HOST", where_to_get: "Your mail provider" },
      { key: "SMTP_USER", where_to_get: "Your mail provider" },
    ],
    docs_url: "https://nodemailer.com",
    last_verified: V,
  },

  // --------------------------------------------------------- file storage
  {
    id: "supabase-storage",
    capability: "file-storage",
    name: "Supabase Storage",
    about: "S3-compatible, tied to your auth",
    free_tier: "1GB",
    tradeoffs: {
      pro: ["Access rules share your auth", "No extra vendor"],
      con: ["Tied to Supabase"],
    },
    env_vars: [],
    docs_url: "https://supabase.com/docs/guides/storage",
    last_verified: V,
  },
  {
    id: "uploadthing",
    capability: "file-storage",
    name: "UploadThing",
    about: "Uploads for TypeScript apps, minimal setup",
    free_tier: "2GB",
    tradeoffs: {
      pro: ["Fastest path to working uploads", "Type-safe end to end"],
      con: ["Smaller free tier"],
    },
    env_vars: [{ key: "UPLOADTHING_TOKEN", where_to_get: "Dashboard → API keys" }],
    docs_url: "https://docs.uploadthing.com",
    last_verified: V,
  },
  {
    id: "cloudinary",
    capability: "file-storage",
    name: "Cloudinary",
    about: "Storage plus image transformation",
    free_tier: "25 credits/month",
    tradeoffs: {
      pro: ["Resizing and optimisation built in"],
      con: ["Credit model is hard to predict"],
    },
    env_vars: [
      { key: "CLOUDINARY_URL", where_to_get: "Dashboard → Account details" },
    ],
    mcp_server: {
      // SSE because that is all Cloudinary exposes. Deprecated transport, kept
      // rather than dropped — an sse entry that works beats no entry.
      transport: "sse",
      name: "cloudinary",
      url: "https://asset-management.mcp.cloudinary.com/sse",
      oauth: true,
    },
    docs_url: "https://cloudinary.com/documentation",
    last_verified: V,
  },
  {
    id: "local-disk",
    capability: "file-storage",
    name: "Local disk",
    about: "Write to a folder in the project",
    free_tier: "Free",
    tradeoffs: {
      pro: ["Nothing to configure", "Fine when it runs on one machine"],
      con: ["Doesn't survive most hosting"],
    },
    env_vars: [],
    docs_url: "",
    last_verified: V,
  },

  // ------------------------------------------------------------------ llm
  {
    id: "anthropic",
    capability: "llm",
    name: "Anthropic",
    about: "Claude — strong instruction following",
    free_tier: "Pay as you go",
    tradeoffs: {
      pro: ["Tool use for structured output", "Long context"],
      con: ["Metering cost is on you"],
    },
    env_vars: [
      { key: "ANTHROPIC_API_KEY", where_to_get: "console.anthropic.com → API keys" },
    ],
    docs_url: "https://docs.anthropic.com",
    last_verified: V,
  },
  {
    id: "openai",
    capability: "llm",
    name: "OpenAI",
    about: "GPT models, widest library support",
    free_tier: "Pay as you go",
    tradeoffs: {
      pro: ["Every tutorial assumes it"],
      con: ["Rate limits bite on new accounts"],
    },
    env_vars: [
      { key: "OPENAI_API_KEY", where_to_get: "platform.openai.com → API keys" },
    ],
    docs_url: "https://platform.openai.com/docs",
    last_verified: V,
  },
  {
    id: "google-ai",
    capability: "llm",
    name: "Google AI",
    about: "Gemini — has a real free tier",
    free_tier: "Free tier with rate limits",
    tradeoffs: {
      pro: ["Genuinely free to start — rare here"],
      con: ["Free tier rate limits are tight"],
    },
    env_vars: [
      { key: "GOOGLE_GENERATIVE_AI_API_KEY", where_to_get: "aistudio.google.com" },
    ],
    docs_url: "https://ai.google.dev/docs",
    last_verified: V,
  },
  {
    id: "ollama",
    capability: "llm",
    name: "Ollama",
    about: "Models running on your own machine",
    free_tier: "Free — runs locally",
    tradeoffs: {
      pro: ["No API key, no bill", "Works offline for a demo"],
      con: ["Needs a capable machine", "Weaker than hosted models"],
    },
    env_vars: [],
    docs_url: "https://ollama.com",
    last_verified: V,
  },

  // -------------------------------------------------------- version control
  {
    id: "github",
    capability: "version-control",
    name: "GitHub",
    about: "Repos, plus Issues if you want a tracker",
    free_tier: "Unlimited public and private repos",
    tradeoffs: {
      pro: ["Everyone already has an account", "Issues come free"],
      con: ["Actions minutes limited on free"],
    },
    env_vars: [
      { key: "GITHUB_TOKEN", where_to_get: "Settings → Developer settings → PAT" },
    ],
    mcp_server: {
      transport: "http",
      name: "github",
      // GitHub's own server. `@modelcontextprotocol/server-github` — what this
      // used to emit — is archived and unmaintained, so the old config
      // installed a dead package.
      url: "https://api.githubcopilot.com/mcp",
      oauth: true,
    },
    docs_url: "https://docs.github.com",
    last_verified: V,
  },
  {
    id: "gitlab",
    capability: "version-control",
    name: "GitLab",
    about: "Often what a university already runs",
    free_tier: "Unlimited repos, 400 CI minutes",
    tradeoffs: {
      pro: ["Self-hosted instances are common in universities"],
      con: [
        "Smaller ecosystem of integrations",
        "MCP server needs Premium or Ultimate — not on free",
      ],
    },
    env_vars: [{ key: "GITLAB_TOKEN", where_to_get: "Preferences → Access tokens" }],
    mcp_server: {
      transport: "http",
      name: "gitlab",
      // Swap the host for your own instance if the university self-hosts —
      // the path is the same.
      url: "https://gitlab.com/api/v4/mcp",
      oauth: true,
    },
    docs_url: "https://docs.gitlab.com",
    last_verified: V,
  },

  // ---------------------------------------------------- project management
  {
    id: "linear",
    capability: "project-management",
    name: "Linear",
    about: "Fast, opinionated issue tracker",
    free_tier: "250 issues, unlimited members",
    tradeoffs: {
      pro: ["Cleanest API of the trackers", "Very fast"],
      con: ["Issue cap on free"],
    },
    env_vars: [{ key: "LINEAR_API_KEY", where_to_get: "Settings → API" }],
    mcp_server: {
      transport: "http",
      name: "linear",
      // Native remote. The old entry shimmed through `mcp-remote` to the /sse
      // endpoint, which Linear is removing.
      url: "https://mcp.linear.app/mcp",
      oauth: true,
    },
    docs_url: "https://linear.app/docs",
    last_verified: V,
  },
  {
    id: "notion",
    capability: "project-management",
    name: "Notion",
    about: "Docs and tasks in one place",
    free_tier: "Unlimited pages, personal use",
    tradeoffs: {
      pro: ["Report drafting and tasks together"],
      con: ["Slower API", "Easy to outgrow as a tracker"],
    },
    env_vars: [{ key: "NOTION_API_KEY", where_to_get: "Integrations → New" }],
    mcp_server: {
      transport: "http",
      name: "notion",
      url: "https://mcp.notion.com/mcp",
      oauth: true,
    },
    docs_url: "https://developers.notion.com",
    last_verified: V,
  },
  {
    id: "github-issues",
    capability: "project-management",
    name: "GitHub Issues",
    about: "Zero new accounts if you're already there",
    free_tier: "Free with the repo",
    tradeoffs: {
      pro: ["No new signup", "Issues sit next to the code"],
      con: ["Thin as a project tracker"],
    },
    env_vars: [],
    docs_url: "https://docs.github.com/issues",
    last_verified: V,
  },
  {
    id: "devcon-internal",
    capability: "project-management",
    name: "DevCon only",
    about: "Keep tasks here, don't sync anywhere",
    free_tier: "Free",
    tradeoffs: {
      pro: ["Nothing to set up", "Right answer for most solo projects"],
      con: ["No sharing outside DevCon yet"],
    },
    env_vars: [],
    docs_url: "",
    last_verified: V,
  },
];

export function providersFor(capability: Capability): Provider[] {
  return PROVIDERS.filter((p) => p.capability === capability);
}

export type McpClient = "claude-code" | "cursor" | "vscode";

export const MCP_CLIENT_LABEL: Record<McpClient, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  vscode: "VS Code",
};

/** Where each client reads the file from, shown above the block. */
export const MCP_CLIENT_PATH: Record<McpClient, string> = {
  "claude-code": ".mcp.json",
  cursor: ".cursor/mcp.json",
  vscode: ".vscode/mcp.json",
};

/**
 * One server's entry.
 *
 * `type` is written on BOTH transports on purpose. It's required for remote
 * entries and optional for stdio, but being explicit means a block copied
 * between the three clients keeps working — VS Code wants it either way.
 */
function serverEntry(s: McpServer): Record<string, unknown> {
  if (s.transport === "stdio") {
    return {
      type: "stdio",
      command: s.command,
      args: s.args,
      ...(s.env?.length
        ? { env: Object.fromEntries(s.env.map((k) => [k, `\${${k}}`])) }
        : {}),
    };
  }
  return {
    type: s.transport,
    url: s.url,
    ...(s.headers ? { headers: s.headers } : {}),
  };
}

/**
 * Build the MCP config block for the connected providers.
 *
 * Emits env var NAMES only — never a value. What changed is that the names are
 * now `${NAME}` references the client resolves, rather than `<your NAME>` prose
 * the client pastes verbatim into an auth header.
 */
export function buildMcpConfig(
  connected: Set<string>,
  client: McpClient = "claude-code",
  providers: Provider[] = PROVIDERS,
): string {
  const servers: Record<string, unknown> = {};
  for (const p of providers) {
    if (!connected.has(p.id) || !p.mcp_server) continue;
    servers[p.mcp_server.name] = serverEntry(p.mcp_server);
  }
  // VS Code reads `servers`; Claude Code and Cursor read `mcpServers`.
  const root = client === "vscode" ? { servers } : { mcpServers: servers };
  return JSON.stringify(root, null, 2);
}

/**
 * The same servers as runnable `claude mcp add` commands.
 *
 * A JSON block still has to land in the right file at the right nesting level,
 * and that step is where a correct config most often stops working. These run
 * as-is.
 */
export function buildMcpCliCommands(
  connected: Set<string>,
  providers: Provider[] = PROVIDERS,
): string[] {
  const out: string[] = [];
  for (const p of providers) {
    const s = p.mcp_server;
    if (!connected.has(p.id) || !s) continue;

    if (s.transport === "stdio") {
      // `--env` must not sit directly before the server name — the CLI reads
      // the name as another KEY=value pair and rejects it. `--transport` in
      // between is what keeps this valid.
      const env = (s.env ?? []).map((k) => `--env ${k}=$${k} `).join("");
      out.push(
        `claude mcp add ${env}--transport stdio ${s.name} -- ${s.command} ${s.args.join(" ")}`,
      );
    } else {
      const headers = Object.entries(s.headers ?? {})
        .map(([h, v]) => ` --header "${h}: ${v}"`)
        .join("");
      out.push(
        `claude mcp add --transport ${s.transport} ${s.name} ${s.url}${headers}`,
      );
    }
  }
  return out;
}

/** Connected providers that still need a key in the environment before they run. */
export function mcpKeysNeeded(
  connected: Set<string>,
  providers: Provider[] = PROVIDERS,
): string[] {
  const keys = new Set<string>();
  for (const p of providers) {
    const s = p.mcp_server;
    if (!connected.has(p.id) || !s) continue;
    if (s.transport === "stdio") for (const k of s.env ?? []) keys.add(k);
    else
      for (const v of Object.values(s.headers ?? {})) {
        for (const m of v.matchAll(/\$\{([A-Z0-9_]+)\}/g)) keys.add(m[1]);
      }
  }
  return [...keys].sort();
}

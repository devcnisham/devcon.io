import type { FileSource } from "./source";
import { isReadable } from "./source";
import { parseGitRemote, type RepoDigest } from "./types";

const CONFIG_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  "vite.config.ts",
  "tailwind.config.ts",
  "tailwind.config.js",
  "biome.json",
  ".eslintrc.json",
  "docker-compose.yml",
  "Dockerfile",
  "requirements.txt",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
  "prisma/schema.prisma",
  "drizzle.config.ts",
];

/**
 * Only `.env.example` is ever read, and only for key names.
 *
 * Reading `.env` would put real secrets into the digest. `isReadable` in
 * source.ts is the enforcement; this list is only about which example file to
 * look for.
 */
const ENV_EXAMPLE_NAMES = [".env.example", ".env.sample", ".env.template"];

const dirname = (p: string) => p.split("/").slice(0, -1).join("/");
const basename = (p: string) => p.split("/").pop() ?? p;

function directoriesOf(paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/").slice(0, -1);
    // Two levels, matching what the filesystem walk used to collect. Deeper
    // adds noise without changing any inference that reads this list.
    for (let depth = 1; depth <= Math.min(2, parts.length); depth++) {
      dirs.add(parts.slice(0, depth).join("/"));
    }
  }
  dirs.delete("");
  return [...dirs].sort();
}

async function readJson(
  source: FileSource,
  path: string,
): Promise<Record<string, unknown> | null> {
  const raw = await source.read(path);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function anyMatches(
  source: FileSource,
  paths: string[],
  patterns: RegExp[],
): Promise<boolean> {
  for (const p of paths) {
    const raw = await source.read(p);
    if (raw && patterns.some((re) => re.test(raw))) return true;
  }
  return false;
}

/**
 * Evidence that work is already DONE, not merely that a dependency exists.
 *
 * The difference between "you have Clerk installed" and "auth is wired".
 * Without it every step reports as not-started, and the plan confidently tells
 * someone to build what they finished months ago.
 */
async function detectMarkers(source: FileSource, paths: string[]) {
  const routes = paths.filter((p) => basename(p) === "route.ts");
  const webhookRoutes = [
    ...new Set(
      routes
        .filter((p) => p.includes("webhook"))
        .map((p) => basename(dirname(p))),
    ),
  ];

  const pages = paths.filter((p) => basename(p) === "page.tsx");
  const hasLegalPages = pages.some((p) =>
    /(^|\/)(privacy|terms)(\/|$)/i.test(dirname(p)),
  );

  const middleware = paths.filter((p) => /(^|\/)middleware\.ts$/.test(p));

  const schemaFiles = paths.filter((p) => p.endsWith("schema.prisma"));
  let schemaModels = 0;
  let hasSubscriptionModel = false;
  for (const s of schemaFiles) {
    const raw = await source.read(s);
    if (!raw) continue;
    schemaModels = Math.max(
      schemaModels,
      (raw.match(/^model /gm) ?? []).length,
    );
    if (/^model (Subscription|Plan|Entitlement|Billing)/im.test(raw)) {
      hasSubscriptionModel = true;
    }
  }

  /**
   * Migration COUNT is directories under a migrations folder, not files.
   * Prisma names one directory per migration and puts a single .sql inside, so
   * counting files would report the same number for a very different history.
   */
  const migrationDirs = new Set(
    paths
      .filter((p) => /(^|\/)migrations\//.test(p))
      .map((p) => {
        const parts = p.split("/");
        const i = parts.lastIndexOf("migrations");
        return parts.slice(0, i + 2).join("/");
      }),
  );

  return {
    authWired:
      middleware.length > 0 &&
      (await anyMatches(source, middleware, [
        /clerkMiddleware|authMiddleware|withAuth|getServerSession|createServerClient/,
      ])),
    webhookRoutes,
    /** Signature checks may live in a lib, so an import counts as evidence. */
    webhookSignatureVerified: await anyMatches(
      source,
      routes.filter((p) => p.includes("webhook")),
      [
        /constructEvent|createHmac|svix|verifyHeader|timingSafeEqual|verify[A-Z]\w*Secret|validateWebhookSignature/,
      ],
    ),
    hasLegalPages,
    hasErrorMonitoring:
      paths.some((p) => /(^|\/)instrumentation\.ts$/.test(p)) ||
      paths.some((p) => /sentry/i.test(p)),
    hasRateLimit: await anyMatches(source, routes.slice(0, 60), [
      /ratelimit|rateLimit|Ratelimit/,
    ]),
    hasSubscriptionModel,
    schemaModels,
    migrationCount: migrationDirs.size,
    apiRoutes: routes.length,
  };
}

/**
 * Build a digest from any source.
 *
 * Pure with respect to the source: the same file listing and contents produce
 * the same digest whether they came from disk, a browser folder handle, a set
 * of dropped files, or the GitHub API. That is what stops four ingest paths
 * from becoming four subtly different scanners.
 */
export async function buildDigest(source: FileSource): Promise<RepoDigest> {
  const all = await source.list();
  const paths = all.filter((p) => !p.startsWith(".git/"));
  const skipped: string[] = [];

  const pkg = await readJson(source, "package.json");
  const dependencies = Object.keys(
    (pkg?.dependencies as Record<string, string>) ?? {},
  ).sort();
  const devDependencies = Object.keys(
    (pkg?.devDependencies as Record<string, string>) ?? {},
  ).sort();
  const scripts = Object.keys((pkg?.scripts as Record<string, string>) ?? {});

  /**
   * Workspace packages. A monorepo's root package.json is nearly empty, so
   * without this the strongest signals sit in files the scan never opened.
   */
  let workspaces = 0;
  const declared = pkg?.workspaces;
  if (Array.isArray(declared)) workspaces = declared.length;
  const pnpmWorkspace = await source.read("pnpm-workspace.yaml");
  if (pnpmWorkspace) {
    workspaces = Math.max(
      workspaces,
      (pnpmWorkspace.match(/^\s*-\s+\S+/gm) ?? []).length,
    );
  }
  // Nested package.json files are the ground truth when neither declaration is
  // present — a Turborepo with globs reports fewer than it has.
  const nestedPkgs = paths.filter(
    (p) => basename(p) === "package.json" && p !== "package.json",
  );
  workspaces = Math.max(workspaces, nestedPkgs.length);

  for (const nested of nestedPkgs.slice(0, 12)) {
    const sub = await readJson(source, nested);
    if (!sub) continue;
    for (const d of Object.keys(
      (sub.dependencies as Record<string, string>) ?? {},
    )) {
      if (!dependencies.includes(d)) dependencies.push(d);
    }
    for (const d of Object.keys(
      (sub.devDependencies as Record<string, string>) ?? {},
    )) {
      if (!devDependencies.includes(d)) devDependencies.push(d);
    }
  }
  dependencies.sort();
  devDependencies.sort();

  const configFiles = CONFIG_FILES.filter((f) => paths.includes(f));

  // Env example keys — NAMES ONLY. Anything after `=` is discarded here and
  // never enters the digest.
  let envKeys: string[] = [];
  for (const name of ENV_EXAMPLE_NAMES) {
    const raw = paths.includes(name) ? await source.read(name) : null;
    if (raw === null) continue;
    envKeys = raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split("=")[0].trim())
      .filter(Boolean);
    break;
  }

  // Reported, never read. The UI says so, which is the point.
  for (const p of paths) {
    if (!isReadable(p))
      skipped.push(`${p} (never read — may contain real secrets)`);
  }

  const migrations = paths
    .filter((p) => /\.(sql|prisma)$/i.test(p) || /(^|\/)migrations?\//i.test(p))
    .slice(0, 40);

  const hasTests =
    paths.some((p) => /\.(test|spec)\.[jt]sx?$/i.test(basename(p))) ||
    paths.some((p) => /(^|\/)(tests?|__tests__|spec|e2e)\//i.test(p));

  let gitRemote: RepoDigest["gitRemote"] = null;
  const raw = source.remote ? await source.remote() : null;
  if (raw) gitRemote = parseGitRemote(raw);

  return {
    root: source.label,
    name: (pkg?.name as string) ?? source.name,
    dependencies,
    devDependencies,
    workspaces,
    scripts,
    configFiles,
    directories: directoriesOf(paths).slice(0, 120),
    envKeys,
    migrations,
    fileCount: paths.length,
    hasGit: all.some((p) => p.startsWith(".git/")) || gitRemote !== null,
    gitRemote,
    hasReadme: paths.some((p) => /^readme\.md$/i.test(p)),
    hasTests,
    markers: await detectMarkers(source, paths),
    skipped,
  };
}

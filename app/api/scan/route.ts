import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { RepoDigest } from "@/lib/scan/types";

/**
 * Local repo scanner. DEVELOPMENT ONLY.
 *
 * This reads an arbitrary path off the host filesystem. That is acceptable on
 * a developer's own machine and unacceptable on a deployed server, where it
 * would be a file-read primitive for anyone who can reach the URL. The guard
 * below is the whole reason this is safe — do not remove it to "test in prod".
 */
const DEV_ONLY = process.env.NODE_ENV !== "production";

/** Directories that tell us nothing and would dominate the walk. */
const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  "vendor",
  "target",
  "__pycache__",
  ".venv",
]);

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
 * Reading `.env` would put real secrets into a response body. The plan states
 * this as a non-negotiable; this list is where it's enforced.
 */
const ENV_EXAMPLE_NAMES = [".env.example", ".env.sample", ".env.template"];

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

/** Walk two levels deep, counting files and collecting directory names. */
async function walk(
  root: string,
  dir: string,
  depth: number,
  acc: { dirs: string[]; files: number; migrations: string[]; tests: boolean },
): Promise<void> {
  if (depth > 2 || acc.files > 20000) return;

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example") {
      if (entry.isDirectory()) continue;
    }

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const rel = path.relative(root, full);
      acc.dirs.push(rel);
      if (/^(tests?|__tests__|spec|e2e)$/i.test(entry.name)) acc.tests = true;
      await walk(root, full, depth + 1, acc);
    } else {
      acc.files++;
      if (/\.(sql|prisma)$/i.test(entry.name) || /migration/i.test(dir)) {
        const rel = path.relative(root, full);
        if (acc.migrations.length < 40) acc.migrations.push(rel);
      }
      if (/\.(test|spec)\.[jt]sx?$/i.test(entry.name)) acc.tests = true;
    }
  }
}

/** Read a file only to test it against patterns. Contents never leave here. */
async function fileMatches(p: string, patterns: RegExp[]): Promise<boolean> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return patterns.some((re) => re.test(raw));
  } catch {
    return false;
  }
}

async function anyFileMatches(
  files: string[],
  patterns: RegExp[],
): Promise<boolean> {
  for (const f of files) {
    if (await fileMatches(f, patterns)) return true;
  }
  return false;
}

/** Find files by name under a root, bounded so a big repo can't stall the scan. */
async function findFiles(
  dir: string,
  name: string,
  depth = 0,
  found: string[] = [],
): Promise<string[]> {
  if (depth > 6 || found.length > 400) return found;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      await findFiles(path.join(dir, e.name), name, depth + 1, found);
    } else if (e.name === name) {
      found.push(path.join(dir, e.name));
    }
  }
  return found;
}

/**
 * Evidence that work is already DONE, not merely that a dependency exists.
 *
 * This is the difference between "you have Clerk installed" and "auth is
 * wired". Without it every step reports as not-started, and the plan confidently
 * tells someone to build what they finished months ago — which is the fastest
 * way for a tool like this to lose all credibility.
 */
async function detectMarkers(root: string, dirs: string[]) {
  // Where the app lives — monorepos hide it a level down.
  const appRoots = ["", "frontend", "web", "apps/web", "src"]
    .map((d) => path.join(root, d))
    .filter((_, i) => i === 0 || dirs.some((x) => x.startsWith(path.basename(_))));

  const routeFiles: string[] = [];
  for (const base of appRoots) {
    routeFiles.push(...(await findFiles(base, "route.ts")));
    if (routeFiles.length > 300) break;
  }

  // Dedupe: appRoots can overlap (root and frontend/), so the same route file
  // is found more than once.
  const uniqueRoutes = [...new Set(routeFiles)];
  const webhookRoutes = [
    ...new Set(
      uniqueRoutes
        .filter((f) => f.includes("webhook"))
        .map((f) => path.basename(path.dirname(f))),
    ),
  ];

  /**
   * Legal pages live ~4 levels deep (frontend/src/app/privacy), past the
   * 2-level walk. Detect from page files instead of the directory list.
   */
  const pageFiles: string[] = [];
  for (const base of appRoots) {
    pageFiles.push(...(await findFiles(base, "page.tsx")));
    if (pageFiles.length > 400) break;
  }
  const hasLegalPages = [...new Set(pageFiles)].some((f) =>
    /\/(privacy|terms)(\/|$)/i.test(path.dirname(f)),
  );

  const middlewareFiles: string[] = [];
  for (const base of appRoots) {
    for (const candidate of ["middleware.ts", "src/middleware.ts"]) {
      const p = path.join(base, candidate);
      if (await exists(p)) middlewareFiles.push(p);
    }
  }

  const schemaFiles = [
    path.join(root, "database/prisma/schema.prisma"),
    path.join(root, "prisma/schema.prisma"),
    path.join(root, "frontend/prisma/schema.prisma"),
  ].filter(Boolean);

  let schemaModels = 0;
  let hasSubscriptionModel = false;
  for (const s of schemaFiles) {
    try {
      const raw = await fs.readFile(s, "utf8");
      schemaModels = Math.max(
        schemaModels,
        (raw.match(/^model /gm) ?? []).length,
      );
      if (/^model (Subscription|Plan|Entitlement|Billing)/im.test(raw)) {
        hasSubscriptionModel = true;
      }
    } catch {
      /* schema may not exist */
    }
  }

  return {
    authWired:
      middlewareFiles.length > 0 &&
      (await anyFileMatches(middlewareFiles, [
        /clerkMiddleware|authMiddleware|withAuth|getServerSession|createServerClient/,
      ])),
    webhookRoutes,
    /** Signature checks may live in a lib, so an import counts as evidence. */
    webhookSignatureVerified: await anyFileMatches(
      uniqueRoutes.filter((f) => f.includes("webhook")),
      [
        /constructEvent|createHmac|svix|verifyHeader|timingSafeEqual|verify[A-Z]\w*Secret|validateWebhookSignature/,
      ],
    ),
    hasLegalPages,
    hasErrorMonitoring:
      (await exists(path.join(root, "frontend/instrumentation.ts"))) ||
      (await exists(path.join(root, "instrumentation.ts"))) ||
      dirs.some((d) => /sentry/i.test(d)),
    hasRateLimit: await anyFileMatches(uniqueRoutes.slice(0, 60), [
      /ratelimit|rateLimit|Ratelimit/,
    ]),
    hasSubscriptionModel,
    schemaModels,
    migrationCount: await countMigrations(root),
    apiRoutes: uniqueRoutes.length,
  };
}

/** Count migration directories directly — they sit deeper than the walk goes. */
async function countMigrations(root: string): Promise<number> {
  for (const rel of [
    "database/prisma/migrations",
    "prisma/migrations",
    "frontend/prisma/migrations",
    "migrations",
  ]) {
    try {
      const entries = await fs.readdir(path.join(root, rel), {
        withFileTypes: true,
      });
      const n = entries.filter((e) => e.isDirectory()).length;
      if (n > 0) return n;
    } catch {
      /* try the next location */
    }
  }
  return 0;
}

export async function GET(request: Request) {
  if (!DEV_ONLY) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const target = new URL(request.url).searchParams.get("path");
  if (!target) {
    return NextResponse.json(
      { error: "No path given", hint: "Pass ?path=/absolute/path/to/repo" },
      { status: 400 },
    );
  }

  const root = path.resolve(target.replace(/^~/, process.env.HOME ?? "~"));

  if (!(await exists(root))) {
    return NextResponse.json(
      { error: `Nothing at ${root}`, hint: "Check the path is absolute." },
      { status: 404 },
    );
  }

  const stat = await fs.stat(root);
  if (!stat.isDirectory()) {
    return NextResponse.json(
      { error: "That's a file, not a directory." },
      { status: 400 },
    );
  }

  const skipped: string[] = [];

  // package.json — names only, no versions, no private URLs.
  const pkg = await readJson(path.join(root, "package.json"));
  const dependencies = new Set(
    Object.keys((pkg?.dependencies as Record<string, string>) ?? {}),
  );
  const devDependencies = new Set(
    Object.keys((pkg?.devDependencies as Record<string, string>) ?? {}),
  );
  const scripts = Object.keys((pkg?.scripts as Record<string, string>) ?? {});

  /**
   * Monorepos keep their real dependencies in workspace packages, so a root-only
   * read returns almost nothing — which would make every dependency signal
   * silently fail on exactly the kind of project worth scanning.
   */
  let workspaces = 0;
  try {
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || IGNORE_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      const sub = await readJson(path.join(root, entry.name, "package.json"));
      if (!sub) continue;
      workspaces++;
      for (const d of Object.keys(
        (sub.dependencies as Record<string, string>) ?? {},
      ))
        dependencies.add(d);
      for (const d of Object.keys(
        (sub.devDependencies as Record<string, string>) ?? {},
      ))
        devDependencies.add(d);
    }
  } catch {
    skipped.push("workspace package.json scan");
  }

  // Config files present at root.
  const configFiles: string[] = [];
  for (const f of CONFIG_FILES) {
    if (await exists(path.join(root, f))) configFiles.push(f);
  }

  // Env example keys — NAMES ONLY. Anything after `=` is discarded here and
  // never enters the response.
  let envKeys: string[] = [];
  for (const name of ENV_EXAMPLE_NAMES) {
    const p = path.join(root, name);
    if (!(await exists(p))) continue;
    try {
      const raw = await fs.readFile(p, "utf8");
      envKeys = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.split("=")[0].trim())
        .filter(Boolean);
    } catch {
      skipped.push(name);
    }
    break;
  }
  if (await exists(path.join(root, ".env"))) {
    skipped.push(".env (never read — may contain real secrets)");
  }

  const acc = { dirs: [] as string[], files: 0, migrations: [] as string[], tests: false };
  await walk(root, root, 0, acc);

  const markers = await detectMarkers(root, acc.dirs);

  const digest: RepoDigest = {
    root,
    name: (pkg?.name as string) ?? path.basename(root),
    dependencies: [...dependencies].sort(),
    devDependencies: [...devDependencies].sort(),
    workspaces,
    scripts,
    configFiles,
    directories: acc.dirs.sort().slice(0, 120),
    envKeys,
    migrations: acc.migrations,
    fileCount: acc.files,
    hasGit: await exists(path.join(root, ".git")),
    hasReadme:
      (await exists(path.join(root, "README.md"))) ||
      (await exists(path.join(root, "readme.md"))),
    hasTests: acc.tests,
    markers,
    skipped,
  };

  return NextResponse.json(digest);
}

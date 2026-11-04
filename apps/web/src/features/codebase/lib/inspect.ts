/**
 * Turns a flat file index into a structural picture of a project.
 *
 * Classification only. Which *framework* a project uses is detection, and that
 * is a later step — nothing here guesses at Next.js versus Remix. This answers
 * the narrower question: what kind of file is each path?
 *
 * Order matters. A file can look like several things at once
 * (`components/button.test.tsx` is both), so the checks run most-specific
 * first and the first match wins.
 */

export const FILE_ROLES = [
  "package",
  "config",
  "env",
  "ci",
  "docker",
  "test",
  "database",
  "docs",
  "api",
  "route",
  "component",
  "source",
] as const;

export type FileRole = (typeof FILE_ROLES)[number];

const PACKAGE_FILES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "cargo.toml",
  "cargo.lock",
  "pyproject.toml",
  "requirements.txt",
  "poetry.lock",
  "pipfile",
  "pipfile.lock",
  "go.mod",
  "go.sum",
  "gemfile",
  "gemfile.lock",
  "composer.json",
  "composer.lock",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
]);

const CONFIG_FILES = new Set([
  "tsconfig.json",
  "jsconfig.json",
  "postcss.config.mjs",
  "postcss.config.js",
  ".editorconfig",
  ".nvmrc",
  ".npmrc",
  "components.json",
  "turbo.json",
  "vercel.json",
  "netlify.toml",
  "makefile",
  "renovate.json",
]);

const DOCKER_FILES = new Set([
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  ".dockerignore",
  "compose.yml",
  "compose.yaml",
]);

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).toLowerCase();
}

function segments(path: string): string[] {
  return path.toLowerCase().split("/").filter(Boolean);
}

export function classifyRole(path: string): FileRole {
  const name = fileName(path);
  const parts = segments(path);
  const lower = path.toLowerCase();

  if (PACKAGE_FILES.has(name)) return "package";

  // `.env`, `.env.local`, `.env.production` — but not `env.ts`.
  if (name === ".env" || name.startsWith(".env.")) return "env";

  if (
    (parts.includes(".github") && parts.includes("workflows")) ||
    name === ".gitlab-ci.yml" ||
    parts.includes(".circleci") ||
    name === "azure-pipelines.yml" ||
    name === "jenkinsfile"
  ) {
    return "ci";
  }

  if (DOCKER_FILES.has(name) || name.startsWith("dockerfile.")) return "docker";

  // Tests beat every structural role below: a component test is a test.
  if (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(name) ||
    /^test_.*\.py$/.test(name) ||
    /_test\.(go|py|rb)$/.test(name) ||
    parts.some((p) => ["test", "tests", "__tests__", "e2e", "spec"].includes(p))
  ) {
    return "test";
  }

  if (
    parts.some((p) =>
      ["migrations", "drizzle", "prisma", "supabase"].includes(p)
    ) ||
    name.endsWith(".prisma") ||
    name.endsWith(".sql")
  ) {
    return "database";
  }

  if (
    CONFIG_FILES.has(name) ||
    /\.config\.[cm]?[jt]s$/.test(name) ||
    /^\.(prettierrc|eslintrc|babelrc|swcrc)/.test(name) ||
    /^(eslint|tailwind|vite|vitest|next|nuxt|svelte|astro|rollup|webpack|jest|playwright|drizzle)\.config\./.test(
      name
    )
  ) {
    return "config";
  }

  if (name.endsWith(".md") || name.endsWith(".mdx") || parts.includes("docs")) {
    return "docs";
  }

  // API before route: `app/api/**/route.ts` is both, and "API" is the more
  // useful description.
  if (
    parts.includes("api") &&
    (parts.includes("app") || parts.includes("pages") || parts[0] === "api")
  ) {
    return "api";
  }

  if (/(^|\/)(app|pages)\//.test(lower)) {
    if (
      /\/(page|layout|template|loading|error|not-found|default)\.[cm]?[jt]sx?$/.test(
        lower
      )
    ) {
      return "route";
    }
    if (name === "route.ts" || name === "route.js") return "api";
    if (parts.includes("pages")) return "route";
  }

  if (parts.some((p) => ["components", "ui", "widgets"].includes(p))) {
    return "component";
  }

  return "source";
}

export type InspectedFile = { path: string; size: number };

export type InspectionSummary = {
  fileCount: number;
  totalBytes: number;
  counts: Record<FileRole, number>;
  topLevelFolders: string[];
  topExtensions: Array<{ extension: string; count: number }>;
  envFiles: string[];
  hasEnvFile: boolean;
  /** A project with a `.env` and no committed example is hard for a newcomer. */
  missingEnvExample: boolean;
  hasTests: boolean;
  hasCi: boolean;
  hasDocker: boolean;
  hasDocs: boolean;
};

export function inspectIndex(files: InspectedFile[]): InspectionSummary {
  const counts = Object.fromEntries(
    FILE_ROLES.map((role) => [role, 0])
  ) as Record<FileRole, number>;

  const folders = new Set<string>();
  const extensions = new Map<string, number>();
  const envFiles: string[] = [];

  for (const file of files) {
    const role = classifyRole(file.path);
    counts[role]++;

    if (role === "env") envFiles.push(file.path);

    const slash = file.path.indexOf("/");
    if (slash > 0) folders.add(file.path.slice(0, slash));

    const name = fileName(file.path);
    const dot = name.lastIndexOf(".");
    if (dot > 0) {
      const extension = name.slice(dot + 1);
      extensions.set(extension, (extensions.get(extension) ?? 0) + 1);
    }
  }

  const topExtensions = [...extensions.entries()]
    .map(([extension, count]) => ({ extension, count }))
    .sort((a, b) => b.count - a.count || a.extension.localeCompare(b.extension))
    .slice(0, 8);

  return {
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
    counts,
    topLevelFolders: [...folders].sort(),
    topExtensions,
    envFiles,
    hasEnvFile: envFiles.length > 0,
    missingEnvExample:
      envFiles.length > 0 &&
      !envFiles.some((path) => fileName(path).includes("example")),
    hasTests: counts.test > 0,
    hasCi: counts.ci > 0,
    hasDocker: counts.docker > 0,
    hasDocs: counts.docs > 0,
  };
}

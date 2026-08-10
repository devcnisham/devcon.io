import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * What a project is, read from its files.
 *
 * Every field here comes from something on disk — a lockfile, a dependency, a
 * directory that exists or does not. Nothing is inferred from a name and
 * nothing is asked of the user, because the whole premise of this tool is that
 * it reads what you actually built rather than what you said you built.
 *
 * Cheap on purpose: a handful of `stat` calls and one `package.json` read, so
 * a dashboard listing ten projects stays instant. Anything that needs a command
 * run belongs in the checker, behind its sandbox.
 */

export interface Detected {
  packageManager: string | null;
  framework: string | null;
  language: string | null;
  /** Things a project is expected to have. Absence is the interesting part. */
  hasGit: boolean;
  hasReadme: boolean;
  hasTests: boolean;
  hasCi: boolean;
  hasSpec: boolean;
  hasIgnore: boolean;
  /** A committed secret is the one gap that is urgent rather than untidy. */
  envCommitted: boolean;
}

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

/** First match wins, so the more specific framework is listed first. */
const FRAMEWORKS: [string, string][] = [
  ["next", "Next.js"],
  ["nuxt", "Nuxt"],
  ["@remix-run/react", "Remix"],
  ["astro", "Astro"],
  ["@sveltejs/kit", "SvelteKit"],
  ["expo", "Expo"],
  ["react-native", "React Native"],
  ["@angular/core", "Angular"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["express", "Express"],
  ["fastify", "Fastify"],
  ["hono", "Hono"],
  ["vite", "Vite"],
  ["react", "React"],
];

const LOCKFILES: [string, string][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

export async function detectProject(root: string): Promise<Detected> {
  const has = (rel: string) => exists(join(root, rel));

  const [hasGit, hasReadme, hasSpec, hasIgnore, tsconfig, ...testDirs] =
    await Promise.all([
      has(".git"),
      has("README.md"),
      has("SHIP.md"),
      has(".gitignore"),
      has("tsconfig.json"),
      has("test"),
      has("tests"),
      has("__tests__"),
      has("spec"),
    ]);

  const ci =
    (await has(".github/workflows")) ||
    (await has(".gitlab-ci.yml")) ||
    (await has(".circleci"));

  // A `.env` that git is tracking is a leaked secret, not a missing file. The
  // check is deliberately crude — the presence of the file plus no ignore rule
  // covering it — because a false positive here costs a glance and a false
  // negative costs a key.
  const envFile = (await has(".env")) || (await has(".env.local"));
  let ignored = false;
  if (envFile && hasIgnore) {
    try {
      const rules = await readFile(join(root, ".gitignore"), "utf8");
      ignored = /^\s*\.env/m.test(rules);
    } catch {
      ignored = false;
    }
  }

  let packageManager: string | null = null;
  for (const [file, name] of LOCKFILES) {
    if (await has(file)) {
      packageManager = name;
      break;
    }
  }

  let framework: string | null = null;
  let language: string | null = tsconfig ? "TypeScript" : null;
  try {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
    for (const [dep, name] of FRAMEWORKS) {
      if (dep in deps) {
        framework = name;
        break;
      }
    }
    if (!language) language = "JavaScript";
  } catch {
    // No package.json is not a failure. A Python or Go project is still a
    // project, and saying "unknown" is more honest than guessing.
  }

  return {
    packageManager,
    framework,
    language,
    hasGit,
    hasReadme,
    hasTests: testDirs.some(Boolean),
    hasCi: ci,
    hasSpec,
    hasIgnore,
    envCommitted: envFile && !ignored,
  };
}

export interface Gap {
  id: string;
  label: string;
  /** Urgent gaps are about losing something, not about tidiness. */
  urgent?: boolean;
}

/**
 * What this project is missing, in the order it will hurt.
 *
 * Derived from the repo rather than from a pre-written list of steps — a
 * catalog claims coverage it cannot verify, and this can only ever report what
 * it actually looked for.
 */
export function gaps(d: Detected): Gap[] {
  const out: Gap[] = [];
  if (d.envCommitted)
    out.push({
      id: "env",
      label: "An .env file is not covered by .gitignore",
      urgent: true,
    });
  if (!d.hasGit) out.push({ id: "git", label: "Not a git repository" });
  if (!d.hasIgnore) out.push({ id: "ignore", label: "No .gitignore" });
  if (!d.hasSpec) out.push({ id: "spec", label: "No SHIP.md" });
  if (!d.hasReadme) out.push({ id: "readme", label: "No README" });
  if (!d.hasTests) out.push({ id: "tests", label: "No tests" });
  if (!d.hasCi) out.push({ id: "ci", label: "No CI" });
  return out;
}

/** "Next.js · TypeScript · pnpm", skipping whatever could not be detected. */
export function stackLine(d: Detected): string {
  return [d.framework, d.language, d.packageManager]
    .filter(Boolean)
    .join(" · ");
}

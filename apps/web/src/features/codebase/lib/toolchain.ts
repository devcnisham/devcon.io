import type { Manifest } from "./dependencies";

/**
 * How a project is installed, built, and run.
 *
 * This is the part a new developer needs most: not "you are using pnpm" but
 * "type `pnpm run dev`". Every command carries where it came from — a script
 * the project declares is fact, a convention is an educated guess, and those
 * are not the same thing.
 *
 * Nothing is invented. If neither a script nor a convention exists, no command
 * is reported: a beginner running a command that does not exist is worse off
 * than one told there isn't one.
 */

export type CommandSource = "script" | "convention";

export type DetectedCommand = {
  command: string;
  source: CommandSource;
  /** What produced it — a script name, or the convention's reason. */
  from: string;
};

export type PackageManagerInfo = {
  name: string;
  lockFile: string | null;
  evidence: string[];
  /** More than one lockfile is a real problem, not a tie to break. */
  conflict: boolean;
  otherLockFiles: string[];
};

export type Toolchain = {
  packageManager: PackageManagerInfo | null;
  lockFile: string | null;
  runtimeConfig: string[];
  commands: {
    build: DetectedCommand | null;
    dev: DetectedCommand | null;
    production: DetectedCommand | null;
  };
};

/** Lockfile → package manager. Order is priority when several are present. */
const LOCKFILES: Array<{ file: string; manager: string }> = [
  { file: "bun.lockb", manager: "bun" },
  { file: "bun.lock", manager: "bun" },
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "package-lock.json", manager: "npm" },
  { file: "deno.lock", manager: "deno" },
  { file: "poetry.lock", manager: "poetry" },
  { file: "Pipfile.lock", manager: "pipenv" },
  { file: "uv.lock", manager: "uv" },
  { file: "Cargo.lock", manager: "cargo" },
  { file: "composer.lock", manager: "composer" },
  { file: "Gemfile.lock", manager: "bundler" },
  { file: "go.sum", manager: "go modules" },
  { file: "pubspec.lock", manager: "pub" },
];

const RUNTIME_CONFIG = [
  ".nvmrc",
  ".node-version",
  ".python-version",
  ".java-version",
  ".php-version",
  ".ruby-version",
  ".tool-versions",
  "tsconfig.json",
  "jsconfig.json",
  "deno.json",
  "deno.jsonc",
  "global.json",
  "rust-toolchain.toml",
  "rust-toolchain",
  "runtime.txt",
  "Procfile",
];

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

function detectPackageManager(
  paths: string[],
  manifests: Manifest[]
): PackageManagerInfo | null {
  const found = LOCKFILES.map((entry) => ({
    ...entry,
    path: paths.find((path) => baseName(path) === entry.file) ?? null,
  })).filter((entry) => entry.path !== null);

  // An explicit `packageManager` field is the project stating its intent, which
  // outranks whichever lockfile happens to be committed.
  const declared = manifests.find((manifest) => manifest.packageManager);
  const declaredName =
    declared?.packageManager && declared.packageManager !== "pip"
      ? declared.packageManager
      : null;

  if (found.length === 0 && !declaredName) return null;

  const primary = found[0] ?? null;
  const name = declaredName ?? primary?.manager ?? "unknown";

  const evidence: string[] = [];
  if (declaredName) evidence.push(`\`packageManager\` field: ${declaredName}`);
  if (primary) evidence.push(`lock file \`${primary.path}\``);

  // Only Node lockfiles genuinely conflict — a Go project with go.sum and a
  // Node tool alongside it is normal.
  const nodeLockfiles = found.filter((entry) =>
    ["npm", "pnpm", "yarn", "bun"].includes(entry.manager)
  );

  return {
    name,
    lockFile: primary?.path ?? null,
    evidence,
    conflict: nodeLockfiles.length > 1,
    otherLockFiles: found.slice(1).map((entry) => entry.path!),
  };
}

/** `npm run x`, but `yarn x` and `bun run x` — the runners differ. */
function scriptCommand(manager: string, script: string): string {
  if (manager === "yarn") return `yarn ${script}`;
  if (manager === "deno") return `deno task ${script}`;
  return `${manager} run ${script}`;
}

function fromScripts(
  scripts: Record<string, string>,
  manager: string,
  candidates: string[]
): DetectedCommand | null {
  for (const name of candidates) {
    if (scripts[name]) {
      return {
        command: scriptCommand(manager, name),
        source: "script",
        from: `\`${name}\` script: ${scripts[name]}`,
      };
    }
  }

  return null;
}

type Conventions = Partial<Record<"build" | "dev" | "production", string>>;

function conventionsFor(runtimeIds: string[], paths: string[]): Conventions {
  const has = (name: string) => paths.some((path) => baseName(path) === name);

  if (runtimeIds.includes("go")) {
    return { build: "go build ./...", dev: "go run .", production: "./app" };
  }

  if (runtimeIds.includes("rust")) {
    return {
      build: "cargo build --release",
      dev: "cargo run",
      production: "./target/release/app",
    };
  }

  if (runtimeIds.includes("python")) {
    if (has("manage.py")) {
      return {
        dev: "python manage.py runserver",
        production: "gunicorn config.wsgi",
      };
    }
    return {};
  }

  if (runtimeIds.includes("php") && has("artisan")) {
    return { dev: "php artisan serve" };
  }

  if (runtimeIds.includes("java")) {
    return has("pom.xml")
      ? { build: "mvn package", production: "java -jar target/app.jar" }
      : { build: "./gradlew build", production: "./gradlew bootRun" };
  }

  if (runtimeIds.includes("dotnet")) {
    return {
      build: "dotnet build",
      dev: "dotnet watch run",
      production: "dotnet run",
    };
  }

  return {};
}

export function detectToolchain(input: {
  paths: string[];
  manifests: Manifest[];
  runtimeIds: string[];
}): Toolchain {
  const packageManager = detectPackageManager(input.paths, input.manifests);
  const manager = packageManager?.name ?? "npm";

  const scripts = input.manifests.reduce<Record<string, string>>(
    (all, manifest) => ({ ...all, ...manifest.scripts }),
    {}
  );

  const conventions = conventionsFor(input.runtimeIds, input.paths);

  const pick = (
    scriptNames: string[],
    convention: string | undefined,
    why: string
  ): DetectedCommand | null =>
    fromScripts(scripts, manager, scriptNames) ??
    (convention
      ? { command: convention, source: "convention", from: why }
      : null);

  return {
    packageManager,
    lockFile: packageManager?.lockFile ?? null,
    runtimeConfig: input.paths.filter((path) =>
      RUNTIME_CONFIG.includes(baseName(path))
    ),
    commands: {
      build: pick(
        ["build", "compile"],
        conventions.build,
        "ecosystem convention"
      ),
      dev: pick(
        ["dev", "develop", "serve", "start:dev"],
        conventions.dev,
        "ecosystem convention"
      ),
      production: pick(
        ["start", "serve:prod", "start:prod"],
        conventions.production,
        "ecosystem convention"
      ),
    },
  };
}

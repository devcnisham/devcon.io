import type { Manifest } from "./dependencies";
import type { Detection } from "./detect";

/**
 * Which runtime executes this project.
 *
 * Distinct from language detection: a repository can be 96% TypeScript and run
 * on Bun. 1.4 answers what it is written in; this answers what runs it.
 *
 * Signals are ranked by how much they actually prove. A `package.json` says
 * "probably Node" — plenty of Bun and Deno projects have one. A `bun.lockb`
 * says "definitely Bun", because nothing else writes that file.
 */

export type RuntimeDetection = Detection & { version: string | null };

type VersionReader = (files: Record<string, string>) => string | null;

type RuntimeRule = {
  id: string;
  name: string;
  /** Strong signals — files only this runtime produces. */
  strong?: RegExp;
  /** Weak signals — present, but shared with other runtimes. */
  weak?: RegExp;
  /** Read a pinned version, in priority order. */
  versions?: VersionReader[];
};

const strip = (value: string) => value.trim().replace(/^v/, "");

/** Reads one value out of a JSON file without throwing on malformed input. */
function fromJson(
  file: string,
  pick: (json: Record<string, unknown>) => unknown
): VersionReader {
  return (files) => {
    const raw = files[file];
    if (!raw) return null;

    try {
      const value = pick(JSON.parse(raw) as Record<string, unknown>);
      return typeof value === "string" ? strip(value) : null;
    } catch {
      return null;
    }
  };
}

function fromPattern(file: string, pattern: RegExp): VersionReader {
  return (files) => {
    const raw = files[file];
    if (!raw) return null;

    const match = pattern.exec(raw);
    return match ? strip(match[1]) : null;
  };
}

function fromPlainFile(file: string): VersionReader {
  return (files) => (files[file] ? strip(files[file]) : null);
}

const RUNTIMES: RuntimeRule[] = [
  {
    id: "bun",
    name: "Bun",
    strong: /(^|\/)(bun\.lockb?|bunfig\.toml)$/,
    versions: [fromPlainFile(".bun-version")],
  },
  {
    id: "deno",
    name: "Deno",
    strong: /(^|\/)(deno\.jsonc?|deno\.lock)$/,
  },
  {
    id: "node",
    name: "Node.js",
    strong: /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.nvmrc)$/,
    weak: /(^|\/)package\.json$/,
    versions: [
      // A pinned .nvmrc beats an engines range: it is what the project
      // actually runs, not what it tolerates.
      fromPlainFile(".nvmrc"),
      fromJson("package.json", (json) => {
        const engines = json.engines as Record<string, unknown> | undefined;
        return engines?.node;
      }),
    ],
  },
  {
    id: "python",
    name: "Python",
    strong: /(^|\/)(pyproject\.toml|Pipfile|setup\.py|\.python-version)$/,
    weak: /(^|\/)requirements\.txt$/,
    versions: [
      fromPlainFile(".python-version"),
      fromPattern("pyproject.toml", /requires-python\s*=\s*"([^"]+)"/),
    ],
  },
  {
    id: "java",
    name: "Java",
    strong: /(^|\/)(pom\.xml|build\.gradle(\.kts)?|gradlew|\.java-version)$/,
    versions: [
      fromPlainFile(".java-version"),
      fromPattern("pom.xml", /<java\.version>([^<]+)<\/java\.version>/),
    ],
  },
  {
    id: "php",
    name: "PHP",
    strong: /(^|\/)(composer\.json|composer\.lock|\.php-version)$/,
    versions: [
      fromPlainFile(".php-version"),
      fromJson("composer.json", (json) => {
        const require = json.require as Record<string, unknown> | undefined;
        return require?.php;
      }),
    ],
  },
  {
    id: "go",
    name: "Go",
    strong: /(^|\/)(go\.mod|go\.sum)$/,
    versions: [fromPattern("go.mod", /^go\s+([0-9.]+)/m)],
  },
  {
    id: "rust",
    name: "Rust",
    strong: /(^|\/)(Cargo\.toml|Cargo\.lock|rust-toolchain(\.toml)?)$/,
    versions: [
      fromPattern("rust-toolchain.toml", /channel\s*=\s*"([^"]+)"/),
      fromPattern("Cargo.toml", /rust-version\s*=\s*"([^"]+)"/),
    ],
  },
  {
    id: "dotnet",
    name: ".NET",
    strong: /(^|\/)[^/]+\.(csproj|fsproj|vbproj|sln)$/,
    weak: /(^|\/)global\.json$/,
    versions: [
      fromJson("global.json", (json) => {
        const sdk = json.sdk as Record<string, unknown> | undefined;
        return sdk?.version;
      }),
    ],
  },
];

/**
 * Same diminishing-returns combination used for frameworks, so a runtime with
 * two independent signals outranks one with a single strong signal.
 */
function combine(weights: number[]): number {
  let remaining = 1;
  for (const weight of weights) remaining *= 1 - weight;

  return Math.min(1, Number((1 - remaining).toFixed(3)));
}

export function detectRuntimes(input: {
  paths: string[];
  manifests: Manifest[];
  /** Contents of the small files that pin a version. */
  versionFiles: Record<string, string>;
}): RuntimeDetection[] {
  const found: RuntimeDetection[] = [];

  for (const rule of RUNTIMES) {
    const weights: number[] = [];
    const evidence: string[] = [];

    const strongMatches = rule.strong
      ? input.paths.filter((path) => rule.strong!.test(path))
      : [];

    for (const file of strongMatches.slice(0, 2)) {
      weights.push(0.8);
      evidence.push(`\`${file}\``);
    }

    const weakMatches = rule.weak
      ? input.paths.filter((path) => rule.weak!.test(path))
      : [];

    for (const file of weakMatches.slice(0, 1)) {
      weights.push(0.35);
      evidence.push(`\`${file}\` (shared with other runtimes)`);
    }

    if (weights.length === 0) continue;

    let version: string | null = null;
    for (const read of rule.versions ?? []) {
      version = read(input.versionFiles);
      if (version) break;
    }

    if (version) evidence.push(`version ${version} pinned`);

    found.push({
      id: rule.id,
      name: rule.name,
      version,
      evidence,
      confidence: combine(weights),
    });
  }

  return found.sort((a, b) => b.confidence - a.confidence);
}

/** The runtime a developer would name if asked what this project runs on. */
export function primaryRuntime(
  runtimes: RuntimeDetection[]
): RuntimeDetection | null {
  return runtimes[0] ?? null;
}

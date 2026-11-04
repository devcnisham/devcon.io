/**
 * Reads dependency manifests across ecosystems.
 *
 * Deliberately tolerant: a malformed manifest returns null rather than
 * throwing. A project with a broken `package.json` is still worth
 * understanding, and a scan that dies on one bad file is useless.
 *
 * These parsers are approximations, not spec-complete implementations —
 * enough to answer "is this dependency present, and at roughly what version",
 * which is all detection needs.
 */

export type Ecosystem =
  "node" | "python" | "go" | "rust" | "php" | "ruby" | "dart" | "java";

export type Dependency = {
  name: string;
  version: string | null;
};

export type Manifest = {
  path: string;
  ecosystem: Ecosystem;
  dependencies: Dependency[];
  devDependencies: Dependency[];
  /** Kept apart: a peer dependency is a requirement on the host, not a choice. */
  peerDependencies: Dependency[];
  scripts: Record<string, string>;
  packageManager: string | null;
};

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).toLowerCase();
}

function toDependencies(record: unknown): Dependency[] {
  if (!record || typeof record !== "object") return [];

  return Object.entries(record as Record<string, unknown>).map(
    ([name, version]) => ({
      name,
      version: typeof version === "string" ? version : null,
    })
  );
}

function parsePackageJson(path: string, contents: string): Manifest | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(contents) as Record<string, unknown>;
  } catch {
    return null;
  }

  const packageManager =
    typeof json.packageManager === "string"
      ? json.packageManager.split("@")[0]
      : null;

  return {
    path,
    ecosystem: "node",
    dependencies: toDependencies(json.dependencies),
    devDependencies: toDependencies(json.devDependencies),
    peerDependencies: toDependencies(json.peerDependencies),
    scripts:
      json.scripts && typeof json.scripts === "object"
        ? (json.scripts as Record<string, string>)
        : {},
    packageManager,
  };
}

function parseRequirements(path: string, contents: string): Manifest {
  const dependencies: Dependency[] = [];

  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    // Blank lines, comments, and pip flags (-r, -e, --extra-index-url).
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;

    const match = /^([A-Za-z0-9._-]+)\s*(.*)$/.exec(line);
    if (!match) continue;

    dependencies.push({
      name: match[1].toLowerCase(),
      version: match[2].trim() || null,
    });
  }

  return {
    path,
    ecosystem: "python",
    dependencies,
    devDependencies: [],
    peerDependencies: [],
    scripts: {},
    packageManager: "pip",
  };
}

function parseGoMod(path: string, contents: string): Manifest {
  const dependencies: Dependency[] = [];
  const devDependencies: Dependency[] = [];
  let inBlock = false;

  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();

    if (line.startsWith("require (")) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ")") {
      inBlock = false;
      continue;
    }

    const body = inBlock
      ? line
      : line.startsWith("require ")
        ? line.slice("require ".length)
        : null;

    if (!body) continue;

    const match = /^([^\s]+)\s+([^\s]+)(\s+\/\/\s*indirect)?/.exec(body);
    if (!match) continue;

    const dependency = { name: match[1], version: match[2] };

    // Indirect dependencies are transitive — useful context, but not what the
    // project chose, so they are kept apart from direct ones.
    if (match[3]) devDependencies.push(dependency);
    else dependencies.push(dependency);
  }

  return {
    path,
    ecosystem: "go",
    dependencies,
    devDependencies,
    peerDependencies: [],
    scripts: {},
    packageManager: "go",
  };
}

function parseCargoToml(path: string, contents: string): Manifest {
  const dependencies: Dependency[] = [];
  const devDependencies: Dependency[] = [];
  let section: "dependencies" | "dev-dependencies" | null = null;

  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();

    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      const name = header[1];
      section =
        name === "dependencies"
          ? "dependencies"
          : name === "dev-dependencies"
            ? "dev-dependencies"
            : null;
      continue;
    }

    if (!section || !line || line.startsWith("#")) continue;

    const match = /^([A-Za-z0-9._-]+)\s*=\s*(.+)$/.exec(line);
    if (!match) continue;

    // Either `serde = "1.0"` or `tokio = { version = "1", … }`.
    const raw_value = match[2].trim();
    const version = raw_value.startsWith("{")
      ? (/version\s*=\s*"([^"]+)"/.exec(raw_value)?.[1] ?? null)
      : raw_value.replace(/^"|"$/g, "");

    const dependency = { name: match[1], version };
    if (section === "dependencies") dependencies.push(dependency);
    else devDependencies.push(dependency);
  }

  return {
    path,
    ecosystem: "rust",
    dependencies,
    devDependencies,
    peerDependencies: [],
    scripts: {},
    packageManager: "cargo",
  };
}

function parseComposerJson(path: string, contents: string): Manifest | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(contents) as Record<string, unknown>;
  } catch {
    return null;
  }

  return {
    path,
    ecosystem: "php",
    dependencies: toDependencies(json.require),
    devDependencies: toDependencies(json["require-dev"]),
    peerDependencies: [],
    scripts: {},
    packageManager: "composer",
  };
}

/**
 * Gemfiles are Ruby, so this reads `gem` declarations rather than evaluating
 * the file. Group blocks are not tracked — a gem is a gem.
 */
function parseGemfile(path: string, contents: string): Manifest {
  const dependencies: Dependency[] = [];

  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("gem ")) continue;

    const match = /^gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/.exec(
      line
    );
    if (!match) continue;

    dependencies.push({ name: match[1], version: match[2] ?? null });
  }

  return {
    path,
    ecosystem: "ruby",
    dependencies,
    devDependencies: [],
    peerDependencies: [],
    scripts: {},
    packageManager: "bundler",
  };
}

/**
 * Minimal YAML reader for the two blocks that matter. A dependency may be a
 * scalar (`http: ^1.2.0`) or a nested block (`flutter:\n  sdk: flutter`), and
 * both count as present.
 */
function parsePubspec(path: string, contents: string): Manifest {
  const dependencies: Dependency[] = [];
  const devDependencies: Dependency[] = [];
  let section: "deps" | "dev" | null = null;

  for (const raw of contents.split(/\r?\n/)) {
    if (/^dependencies:\s*$/.test(raw)) {
      section = "deps";
      continue;
    }
    if (/^dev_dependencies:\s*$/.test(raw)) {
      section = "dev";
      continue;
    }
    if (/^[a-zA-Z_]/.test(raw)) {
      section = null;
      continue;
    }
    if (!section) continue;

    // Exactly two spaces of indentation is a dependency name; deeper is its
    // configuration.
    const match = /^ {2}([A-Za-z0-9_]+):\s*(.*)$/.exec(raw);
    if (!match) continue;

    const dependency = { name: match[1], version: match[2].trim() || null };
    if (section === "deps") dependencies.push(dependency);
    else devDependencies.push(dependency);
  }

  return {
    path,
    ecosystem: "dart",
    dependencies,
    devDependencies,
    peerDependencies: [],
    scripts: {},
    packageManager: "pub",
  };
}

/** Maven coordinates, read without an XML parser. */
function parsePomXml(path: string, contents: string): Manifest {
  const dependencies: Dependency[] = [];

  for (const block of contents.match(/<dependency>[\s\S]*?<\/dependency>/g) ??
    []) {
    const group = /<groupId>([^<]+)<\/groupId>/.exec(block)?.[1];
    const artifact = /<artifactId>([^<]+)<\/artifactId>/.exec(block)?.[1];
    if (!group || !artifact) continue;

    dependencies.push({
      name: `${group}:${artifact}`,
      version: /<version>([^<]+)<\/version>/.exec(block)?.[1] ?? null,
    });
  }

  return {
    path,
    ecosystem: "java",
    dependencies,
    devDependencies: [],
    peerDependencies: [],
    scripts: {},
    packageManager: "maven",
  };
}

/** Gradle configurations, in either quote style. */
function parseGradle(path: string, contents: string): Manifest {
  const dependencies: Dependency[] = [];
  const devDependencies: Dependency[] = [];

  const pattern =
    /(implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly)\s+['"]([^'"]+)['"]/g;

  for (const match of contents.matchAll(pattern)) {
    const parts = match[2].split(":");
    const name = parts.slice(0, 2).join(":");
    const version = parts[2] ?? null;

    const dependency = { name, version };
    if (match[1].startsWith("test")) devDependencies.push(dependency);
    else dependencies.push(dependency);
  }

  return {
    path,
    ecosystem: "java",
    dependencies,
    devDependencies,
    peerDependencies: [],
    scripts: {},
    packageManager: "gradle",
  };
}

export function parseManifest(path: string, contents: string): Manifest | null {
  switch (fileName(path)) {
    case "package.json":
      return parsePackageJson(path, contents);
    case "requirements.txt":
      return parseRequirements(path, contents);
    case "go.mod":
      return parseGoMod(path, contents);
    case "cargo.toml":
      return parseCargoToml(path, contents);
    case "composer.json":
      return parseComposerJson(path, contents);
    case "gemfile":
      return parseGemfile(path, contents);
    case "pubspec.yaml":
      return parsePubspec(path, contents);
    case "pom.xml":
      return parsePomXml(path, contents);
    case "build.gradle":
    case "build.gradle.kts":
      return parseGradle(path, contents);
    default:
      return null;
  }
}

export type MergedDependencies = {
  ecosystems: Ecosystem[];
  all: Dependency[];
  /** Case-insensitive presence check, across every manifest and both kinds. */
  has(name: string): boolean;
  versionOf(name: string): string | null;
  scripts: Record<string, string>;
};

export function mergeDependencies(manifests: Manifest[]): MergedDependencies {
  const all: Dependency[] = [];
  const index = new Map<string, Dependency>();
  const ecosystems: Ecosystem[] = [];
  let scripts: Record<string, string> = {};

  for (const manifest of manifests) {
    if (!ecosystems.includes(manifest.ecosystem)) {
      ecosystems.push(manifest.ecosystem);
    }

    scripts = { ...scripts, ...manifest.scripts };

    for (const dependency of [
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
    ]) {
      all.push(dependency);
      index.set(dependency.name.toLowerCase(), dependency);
    }
  }

  return {
    ecosystems,
    all,
    scripts,
    has: (name) => index.has(name.toLowerCase()),
    versionOf: (name) => index.get(name.toLowerCase())?.version ?? null,
  };
}

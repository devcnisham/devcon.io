/**
 * Reads lock files to find out what is *actually* installed.
 *
 * A manifest says what the project asked for; a lock file says what that
 * resolved to, including everything pulled in indirectly. The difference
 * between the two is what makes "direct versus transitive" answerable.
 *
 * These are approximations, same as the manifest parsers — enough to list
 * names and resolved versions, not to reimplement each tool's resolver.
 */

export type LockedPackage = {
  name: string;
  version: string | null;
  /** Present only for dev dependencies, where the lock file records it. */
  dev: boolean;
};

export type Lockfile = {
  path: string;
  packages: LockedPackage[];
};

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** `node_modules/a/node_modules/@scope/b` → `@scope/b`. */
function packageNameFromPath(key: string): string | null {
  const marker = "node_modules/";
  const last = key.lastIndexOf(marker);
  if (last < 0) return null;

  const name = key.slice(last + marker.length);
  return name || null;
}

function parseNpmLock(path: string, contents: string): Lockfile | null {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(contents) as Record<string, unknown>;
  } catch {
    return null;
  }

  const packages: LockedPackage[] = [];
  const entries = json.packages as
    Record<string, { version?: string; dev?: boolean }> | undefined;

  if (entries) {
    for (const [key, value] of Object.entries(entries)) {
      // "" is the project itself, not a dependency.
      if (key === "") continue;

      const name = packageNameFromPath(key);
      if (!name) continue;

      packages.push({
        name,
        version: value.version ?? null,
        dev: value.dev === true,
      });
    }

    return { path, packages };
  }

  // lockfileVersion 1 used a flat `dependencies` map instead.
  const legacy = json.dependencies as
    Record<string, { version?: string; dev?: boolean }> | undefined;

  if (!legacy) return { path, packages: [] };

  for (const [name, value] of Object.entries(legacy)) {
    packages.push({
      name,
      version: value.version ?? null,
      dev: value.dev === true,
    });
  }

  return { path, packages };
}

function parseYarnLock(path: string, contents: string): Lockfile {
  const packages: LockedPackage[] = [];
  const seen = new Set<string>();
  let pending: string | null = null;

  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line || line.startsWith("#")) continue;

    // An entry header is unindented and ends with a colon.
    if (!line.startsWith(" ") && line.endsWith(":")) {
      const first = line
        .slice(0, -1)
        .split(",")[0]
        .trim()
        .replace(/^"|"$/g, "");

      // Strip the range, keeping any leading @scope.
      const at = first.lastIndexOf("@");
      pending = at > 0 ? first.slice(0, at) : first;
      continue;
    }

    const version = /^\s+version\s+"?([^"\s]+)"?/.exec(line);
    if (version && pending && !seen.has(pending)) {
      seen.add(pending);
      packages.push({ name: pending, version: version[1], dev: false });
      pending = null;
    }
  }

  return { path, packages };
}

function parsePnpmLock(path: string, contents: string): Lockfile {
  const packages: LockedPackage[] = [];
  let inPackages = false;

  for (const raw of contents.split(/\r?\n/)) {
    if (/^packages:\s*$/.test(raw)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^[a-zA-Z]/.test(raw)) break;
    if (!inPackages) continue;

    // `  react@19.2.8:` or `  '@scope/pkg@1.0.0':`
    const match = /^\s{2}'?([^'\s:]+)'?:\s*$/.exec(raw);
    if (!match) continue;

    const entry = match[1];
    const at = entry.lastIndexOf("@");
    if (at <= 0) continue;

    packages.push({
      name: entry.slice(0, at),
      version: entry.slice(at + 1),
      dev: false,
    });
  }

  return { path, packages };
}

function parseCargoLock(path: string, contents: string): Lockfile {
  const packages: LockedPackage[] = [];

  for (const block of contents.split("[[package]]").slice(1)) {
    const name = /name\s*=\s*"([^"]+)"/.exec(block)?.[1];
    if (!name) continue;

    packages.push({
      name,
      version: /version\s*=\s*"([^"]+)"/.exec(block)?.[1] ?? null,
      dev: false,
    });
  }

  return { path, packages };
}

function parseGoSum(path: string, contents: string): Lockfile {
  const versions = new Map<string, string>();

  for (const raw of contents.split(/\r?\n/)) {
    const match = /^(\S+)\s+(\S+?)(\/go\.mod)?\s+h1:/.exec(raw.trim());
    if (!match) continue;

    // Each module appears twice — once for its zip, once for its go.mod.
    versions.set(match[1], match[2]);
  }

  return {
    path,
    packages: [...versions].map(([name, version]) => ({
      name,
      version,
      dev: false,
    })),
  };
}

export function parseLockfile(path: string, contents: string): Lockfile | null {
  switch (baseName(path)) {
    case "package-lock.json":
      return parseNpmLock(path, contents);
    case "yarn.lock":
      return parseYarnLock(path, contents);
    case "pnpm-lock.yaml":
      return parsePnpmLock(path, contents);
    case "Cargo.lock":
      return parseCargoLock(path, contents);
    case "go.sum":
      return parseGoSum(path, contents);
    default:
      return null;
  }
}

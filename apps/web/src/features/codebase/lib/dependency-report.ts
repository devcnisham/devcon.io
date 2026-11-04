import type { Manifest } from "./dependencies";
import type { Lockfile, LockedPackage } from "./lockfiles";

/**
 * What a project depends on, split into what it chose and what came along.
 *
 * Direct dependencies are declared in a manifest. Everything else in the lock
 * file arrived because something else wanted it. That distinction matters to a
 * beginner looking at 900 packages and wondering what they did.
 */

export type DirectDependency = {
  name: string;
  /** The range the project asked for. */
  declared: string | null;
  /** What the lock file resolved it to, when there is one. */
  resolved: string | null;
  dev: boolean;
};

export type DeprecatedPackage = {
  name: string;
  reason: string;
  replacement: string | null;
};

/**
 * Widely-known retirements. Deliberately short and hand-checked: this is a
 * useful nudge, not an audit, and the report says so.
 */
const DEPRECATED: Record<
  string,
  { reason: string; replacement: string | null }
> = {
  request: {
    reason: "Deprecated in 2020 and no longer maintained",
    replacement: "the built-in fetch, or undici",
  },
  tslint: {
    reason: "Deprecated in favour of ESLint",
    replacement: "eslint with typescript-eslint",
  },
  "node-sass": {
    reason: "Deprecated; bindings break on new Node releases",
    replacement: "sass (Dart Sass)",
  },
  "@babel/polyfill": {
    reason: "Deprecated since Babel 7.4",
    replacement: "core-js with regenerator-runtime",
  },
  moment: {
    reason: "In maintenance mode; the authors recommend alternatives",
    replacement: "date-fns, Day.js, or Temporal",
  },
  enzyme: {
    reason: "Unmaintained and without React 18+ support",
    replacement: "@testing-library/react",
  },
  "left-pad": {
    reason: "Superseded by String.prototype.padStart",
    replacement: "padStart",
  },
  protractor: {
    reason: "Deprecated and no longer developed",
    replacement: "Playwright or Cypress",
  },
  "core-js@2": {
    reason: "Version 2 is unmaintained",
    replacement: "core-js 3",
  },
};

export type DependencyReport = {
  direct: DirectDependency[];
  directCount: number;
  runtimeCount: number;
  devCount: number;

  transitive: LockedPackage[];
  /** Null when there is no lock file — unknown is not the same as zero. */
  transitiveCount: number | null;
  /**
   * Unique package *names*, not lock file entries. npm can install several
   * versions of the same package at different depths; those collapse to one
   * here, which is the number a person means by "how many dependencies".
   */
  resolvedCount: number | null;
  hasLockfile: boolean;

  deprecated: DeprecatedPackage[];
  /** `partial` — a curated list, never a complete audit. */
  deprecationCheck: "partial";

  /**
   * Always `not-checked` until an advisory source is wired in. Reporting
   * "none found" from a hardcoded list would be false assurance.
   */
  vulnerabilityCheck: "not-checked";
  vulnerabilities: null;
};

export function buildDependencyReport(input: {
  manifests: Manifest[];
  lockfiles: Lockfile[];
}): DependencyReport {
  const declared = new Map<string, DirectDependency>();

  for (const manifest of input.manifests) {
    const add = (list: Manifest["dependencies"], dev: boolean) => {
      for (const dependency of list) {
        const key = dependency.name.toLowerCase();
        if (declared.has(key)) continue;

        declared.set(key, {
          name: dependency.name,
          declared: dependency.version,
          resolved: null,
          dev,
        });
      }
    };

    add(manifest.dependencies, false);
    add(manifest.devDependencies, true);
    add(manifest.peerDependencies, true);
  }

  const resolved = new Map<string, LockedPackage>();
  for (const lockfile of input.lockfiles) {
    for (const entry of lockfile.packages) {
      resolved.set(entry.name.toLowerCase(), entry);
    }
  }

  for (const dependency of declared.values()) {
    dependency.resolved =
      resolved.get(dependency.name.toLowerCase())?.version ?? null;
  }

  const hasLockfile = input.lockfiles.length > 0;

  const transitive = hasLockfile
    ? [...resolved.values()]
        .filter((entry) => !declared.has(entry.name.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const deprecated: DeprecatedPackage[] = [];
  for (const dependency of declared.values()) {
    const entry = DEPRECATED[dependency.name.toLowerCase()];
    if (entry) deprecated.push({ name: dependency.name, ...entry });
  }

  const direct = [...declared.values()];

  return {
    direct,
    directCount: direct.length,
    runtimeCount: direct.filter((d) => !d.dev).length,
    devCount: direct.filter((d) => d.dev).length,

    transitive,
    transitiveCount: hasLockfile ? transitive.length : null,
    resolvedCount: hasLockfile ? resolved.size : null,
    hasLockfile,

    deprecated: deprecated.sort((a, b) => a.name.localeCompare(b.name)),
    deprecationCheck: "partial",

    vulnerabilityCheck: "not-checked",
    vulnerabilities: null,
  };
}

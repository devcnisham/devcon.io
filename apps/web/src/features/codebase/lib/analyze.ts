import {
  mergeDependencies,
  parseManifest,
  type Manifest,
} from "./dependencies";
import {
  detectArchitecture,
  detectFeatures,
  detectFrameworks,
  type Architecture,
  type Detection,
} from "./detect";
import { fingerprint, type IndexSnapshot } from "./cache";
import { inspectIndex, type InspectionSummary } from "./inspect";
import { languageBreakdown, type LanguageBreakdown } from "./languages";
import { detectRuntimes, type RuntimeDetection } from "./runtimes";
import { detectToolchain, type Toolchain } from "./toolchain";
import { parseLockfile, type Lockfile } from "./lockfiles";
import {
  buildDependencyReport,
  type DependencyReport,
} from "./dependency-report";
import type { IndexedFile, ScanSource } from "./scan";

/**
 * Runs the engine over a completed scan: reads manifests, detects what the
 * project is, and fingerprints the index for a later incremental rescan.
 *
 * Manifests are the only files re-read here, and only the ones the index
 * already contains — detection never widens the scan.
 */

export type ProjectAnalysis = {
  summary: InspectionSummary;
  manifests: Manifest[];
  frameworks: Detection[];
  features: Detection[];
  architecture: Architecture;
  languages: LanguageBreakdown;
  runtimes: RuntimeDetection[];
  toolchain: Toolchain;
  dependencies: DependencyReport;
  snapshot: IndexSnapshot;
};

const MANIFEST_NAMES = new Set([
  "package.json",
  "requirements.txt",
  "go.mod",
  "cargo.toml",
  "composer.json",
  "gemfile",
  "pubspec.yaml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
]);

/**
 * Small files read purely to pin a runtime version. Kept to a short list so
 * detection never widens into a second pass over the project.
 */
/** Lock files are read to separate direct dependencies from transitive ones. */
const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "cargo.lock",
  "go.sum",
]);

const VERSION_FILES = new Set([
  ".nvmrc",
  ".python-version",
  ".java-version",
  ".php-version",
  ".bun-version",
  "global.json",
  "rust-toolchain.toml",
  "pyproject.toml",
]);

function isManifest(path: string): boolean {
  return MANIFEST_NAMES.has(
    path.slice(path.lastIndexOf("/") + 1).toLowerCase()
  );
}

export async function analyzeProject(
  source: ScanSource,
  indexed: IndexedFile[]
): Promise<ProjectAnalysis> {
  const paths = indexed.map((file) => file.path);
  const manifests: Manifest[] = [];
  const fingerprints: IndexSnapshot["files"] = [];
  const versionFiles: Record<string, string> = {};
  const lockfiles: Lockfile[] = [];

  for (const file of indexed) {
    const name = file.path.slice(file.path.lastIndexOf("/") + 1).toLowerCase();
    const wantsVersion = VERSION_FILES.has(name);
    const isLockfile = LOCKFILE_NAMES.has(name);

    if (!isManifest(file.path) && !wantsVersion && !isLockfile) continue;

    try {
      const contents = await source.readText(file.path);
      if (wantsVersion || isManifest(file.path)) versionFiles[name] = contents;

      const lockfile = isLockfile ? parseLockfile(file.path, contents) : null;
      if (lockfile) lockfiles.push(lockfile);

      const manifest = parseManifest(file.path, contents);
      if (manifest) manifests.push(manifest);

      fingerprints.push({
        path: file.path,
        hash: fingerprint(contents),
        size: file.size,
      });
    } catch {
      // A manifest that cannot be read is not worth failing the analysis over.
    }
  }

  // Files that were not re-read are fingerprinted from path and size, which is
  // enough to notice a change without a second full pass over the project.
  const fingerprinted = new Set(fingerprints.map((entry) => entry.path));

  for (const file of indexed) {
    if (fingerprinted.has(file.path)) continue;
    fingerprints.push({
      path: file.path,
      hash: fingerprint(`${file.path}:${file.size}`),
      size: file.size,
    });
  }

  const dependencies = mergeDependencies(manifests);
  const runtimes = detectRuntimes({ paths, manifests, versionFiles });

  return {
    summary: inspectIndex(indexed),
    manifests,
    frameworks: detectFrameworks({ dependencies, paths }),
    features: detectFeatures({ dependencies, paths }),
    architecture: detectArchitecture({
      paths,
      manifestCount: manifests.length,
    }),
    languages: languageBreakdown(indexed),
    runtimes,
    dependencies: buildDependencyReport({ manifests, lockfiles }),
    toolchain: detectToolchain({
      paths,
      manifests,
      runtimeIds: runtimes.map((runtime) => runtime.id),
    }),
    snapshot: { files: fingerprints },
  };
}

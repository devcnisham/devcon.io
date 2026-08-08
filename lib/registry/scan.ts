import type { FileSource } from "@/lib/scan/source";
import { featureDetector } from "./detect/feature";
import { type Feature, featureModule } from "./modules/feature";
import { ANNOTATABLE, parseAnnotations } from "./sources/annotations";
import { CONFIG_FILENAMES, parseFeatureConfig } from "./sources/config";
import type { DetectorInput, EntryOrigin, RegistryEntry } from "./types";

/**
 * Run every registration method over one repo and merge the results.
 *
 * Takes the same `FileSource` the profile scanner uses, so this works against a
 * browser folder handle, a public GitHub repo, dropped files or the dev-only
 * local path without knowing which it got.
 */

export interface RegistryScanResult {
  entries: Feature[];
  warnings: string[];
  stats: {
    declared: number;
    annotated: number;
    detected: number;
    filesRead: number;
  };
}

/**
 * Which origin wins when two sources describe the same feature.
 *
 * Higher survives. The ordering is the point: a person's explicit declaration
 * outranks a comment, a comment outranks a guess, and nothing outranks
 * something typed into the dashboard by hand. Getting this backwards would
 * mean a scan silently overwriting a decision someone made — the single
 * fastest way to make a registry untrustworthy.
 */
const PRECEDENCE: Record<EntryOrigin, number> = {
  manual: 4,
  declared: 3,
  annotated: 2,
  detected: 1,
};

export function outranks(a: EntryOrigin, b: EntryOrigin): boolean {
  return PRECEDENCE[a] > PRECEDENCE[b];
}

/**
 * Merge entries that resolve to the same id.
 *
 * Not a blind overwrite: the winner keeps its own fields, but inherits `files`
 * and `evidence` from the loser. A feature declared in config AND found by a
 * detector should still show you where the detector saw it — that's the part a
 * human wants when deciding whether the declaration is still accurate.
 */
export function mergeEntries(entries: Feature[]): Feature[] {
  const byId = new Map<string, Feature>();

  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      continue;
    }

    const [winner, loser] = outranks(entry.origin, existing.origin)
      ? [entry, existing]
      : [existing, entry];

    byId.set(entry.id, {
      ...winner,
      files: [...new Set([...winner.files, ...loser.files])],
      evidence:
        [
          ...new Set([...(winner.evidence ?? []), ...(loser.evidence ?? [])]),
        ].slice(0, 8) || undefined,
      tags: [...new Set([...winner.tags, ...loser.tags])],
    });
  }

  return [...byId.values()];
}

/** Bounded so a large repo can't stall the tab reading every source file. */
const MAX_ANNOTATION_FILES = 600;

export async function scanRegistry(
  source: FileSource,
  detectorInput: Omit<DetectorInput, "files">,
): Promise<RegistryScanResult> {
  const files = await source.list();
  const warnings: string[] = [];
  const all: Feature[] = [];
  let filesRead = 0;

  // --- method 3: the config file ------------------------------------------
  let declared = 0;
  for (const name of CONFIG_FILENAMES) {
    if (!files.includes(name)) continue;
    const raw = await source.read(name);
    if (raw === null) continue;
    filesRead++;
    const result = parseFeatureConfig(name, raw);
    warnings.push(...result.warnings);
    all.push(...result.features);
    declared += result.features.length;
    // First config file wins — two would be an ambiguity nobody asked for.
    break;
  }

  // --- method 2: comment annotations --------------------------------------
  let annotated = 0;
  const candidates = files.filter((f) => ANNOTATABLE.test(f));
  if (candidates.length > MAX_ANNOTATION_FILES) {
    warnings.push(
      `Only the first ${MAX_ANNOTATION_FILES} of ${candidates.length} source files were read for @feature annotations.`,
    );
  }
  for (const path of candidates.slice(0, MAX_ANNOTATION_FILES)) {
    const raw = await source.read(path);
    if (raw === null) continue;
    filesRead++;
    // Cheap reject before the line-by-line parse — most files have no
    // annotation and this skips them for the cost of one string search.
    if (!raw.includes("@feature")) continue;
    const hits = parseAnnotations(path, raw);
    all.push(...hits.map((h) => h.feature));
    annotated += hits.length;
  }

  // --- automatic detection ------------------------------------------------
  const detected = featureDetector.detect({ ...detectorInput, files });
  all.push(...detected);

  const merged = mergeEntries(all);

  // Validation is a report, not a throw. One malformed annotation should cost
  // that entry, not the whole scan.
  const entries: Feature[] = [];
  for (const entry of merged) {
    const problems = featureModule.validate(entry);
    if (problems.length) {
      warnings.push(`${entry.id}: ${problems.join("; ")}`);
      continue;
    }
    entries.push(entry);
  }

  return {
    entries,
    warnings,
    stats: { declared, annotated, detected: detected.length, filesRead },
  };
}

/** Registry-relevant fields from a digest, so callers don't rebuild it. */
export function detectorInputFrom(digest: {
  dependencies: string[];
  devDependencies: string[];
  envKeys: string[];
  directories: string[];
}): Omit<DetectorInput, "files"> {
  return {
    // devDependencies count: a project using `@sentry/` only in dev still has
    // error monitoring as a feature, and excluding them lost real signal.
    dependencies: [...digest.dependencies, ...digest.devDependencies],
    envKeys: digest.envKeys,
    directories: digest.directories,
  };
}

export type { RegistryEntry };

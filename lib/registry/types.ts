/**
 * The registry core. Deliberately knows nothing about features.
 *
 * Features are the first module, not the model. The whole point of this file is
 * that adding APIs, routes, database models, background jobs, components, env
 * vars or packages later is a new `RegistryModule` and a detector — not a
 * migration and not a second copy of the store, the sync engine and the UI.
 *
 * The rule that keeps that true: nothing below may mention a feature. If a
 * future module needs something added here, it has to be something every
 * module could want.
 */

/** Identifies a module. New modules add a value; nothing else changes. */
export type ModuleId =
  | "feature"
  // Declared now, unimplemented, so the shape of "more modules" is visible
  // rather than asserted. Each needs a module definition and a detector.
  | "api"
  | "route"
  | "model"
  | "job"
  | "prompt"
  | "component"
  | "env"
  | "integration"
  | "package";

/**
 * Where an entry came from. This is the field the dashboard groups by, and the
 * reason detection can be aggressive without being destructive.
 *
 * - `manual` — a person typed it. Never overwritten by a scan.
 * - `declared` — the project states it, in a config file or an SDK call.
 * - `annotated` — found in a comment above real code.
 * - `detected` — inferred from evidence, e.g. a dependency. A *suggestion*
 *   until accepted, because inference is wrong often enough that silently
 *   writing it into the registry would make the registry untrustworthy.
 */
export type EntryOrigin = "manual" | "declared" | "annotated" | "detected";

/** Only `detected` entries carry a review state. The rest are already real. */
export type ReviewState = "suggested" | "accepted" | "dismissed";

/**
 * Fields every registry entry has, whatever module it belongs to.
 *
 * A module extends this with its own; it never redefines these. Sync,
 * history, search, and the list UI are written against this and therefore work
 * for a module that doesn't exist yet.
 */
export interface RegistryEntry {
  id: string;
  module: ModuleId;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  owner?: string;
  version?: string;
  origin: EntryOrigin;
  /** Present only when `origin === "detected"`. */
  review?: ReviewState;
  /** What the detector saw. Absent for anything a person wrote. */
  evidence?: string[];
  /** Files this entry was found in or relates to. */
  files: string[];
  /** Entry ids this depends on. Not validated here — a module decides. */
  dependsOn: string[];
  createdAt: string;
  updatedAt: string;
  /**
   * Monotonic per entry, bumped on every write.
   *
   * The sync engine compares this, not timestamps. Two machines' clocks
   * disagree, and a conflict resolved by whichever laptop is set fast is not
   * resolved, it's lost.
   */
  revision: number;
}

/** One recorded change. Append-only — history that can be edited isn't history. */
export interface RegistryEvent {
  id: string;
  entryId: string;
  module: ModuleId;
  at: string;
  /** Field name → [before, after]. Absent on create and delete. */
  changes?: Record<string, [unknown, unknown]>;
  kind: "created" | "updated" | "deleted" | "accepted" | "dismissed";
  /** Who or what did it. "scanner", "sdk", "cli", or a person. */
  actor: string;
}

/**
 * A module's contract with the core.
 *
 * Everything module-specific lives behind this: what its statuses are, how to
 * validate one of its entries, how to find them in a repo. The store, the sync
 * engine and the list UI take a `RegistryModule` and work — that is the test of
 * whether this abstraction is real.
 */
export interface RegistryModule<T extends RegistryEntry = RegistryEntry> {
  id: ModuleId;
  /** Plural, for headings: "Features", "API endpoints". */
  label: string;
  /** Singular, for buttons: "feature". */
  singular: string;
  /** Ordered. The UI renders them in this order, so it is the lifecycle. */
  statuses: readonly string[];
  /** Reject an entry that would corrupt the registry. Empty means valid. */
  validate(entry: T): string[];
  /** Normalise anything user- or scanner-supplied into a complete entry. */
  hydrate(partial: Partial<T> & { name: string }): T;
}

/** A detector turns repo evidence into suggestions. One per module, at least. */
export interface Detector<T extends RegistryEntry = RegistryEntry> {
  module: ModuleId;
  /**
   * Pure: same input, same suggestions. No I/O — the caller has already read
   * the repo. That is what makes detection testable without a filesystem.
   */
  detect(input: DetectorInput): T[];
}

export interface DetectorInput {
  /** Dependency names from the manifest, no versions. */
  dependencies: string[];
  /** Every file path in the repo, relative, forward-slashed. */
  files: string[];
  /** Env var NAMES only. Never values — the scanner never reads them. */
  envKeys: string[];
  /** Directory names, two levels. */
  directories: string[];
  /** Read a file as text. Returns null for anything the scan refuses to read. */
  read?(path: string): string | null;
}

export const nowIso = (): string => new Date().toISOString();

/**
 * A stable id from a name.
 *
 * Deterministic on purpose: a re-scan has to produce the same id for the same
 * finding, or every scan duplicates everything it found last time. This is the
 * whole of duplicate prevention for detected entries.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

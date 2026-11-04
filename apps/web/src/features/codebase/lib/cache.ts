/**
 * Scan cache and incremental rescanning.
 *
 * A rescan of an unchanged project should cost almost nothing. Each file is
 * fingerprinted, and a rescan compares fingerprints to work out what actually
 * needs re-reading.
 *
 * Storage is an interface with an in-memory implementation. Persisting a
 * snapshot needs the database; the diffing logic does not, so it is built and
 * tested now.
 */

export type FileFingerprint = {
  path: string;
  hash: string;
  size: number;
};

export type IndexSnapshot = {
  files: FileFingerprint[];
};

/**
 * FNV-1a, 32-bit, with the length mixed in.
 *
 * Not cryptographic and not meant to be — this answers "did this file change
 * since we last looked", where a collision costs one unnecessary re-read. A
 * real hash would mean pulling in a crypto bundle for the browser to do work
 * that does not need it.
 */
export function fingerprint(contents: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < contents.length; i++) {
    hash ^= contents.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  // Length is appended so that two same-length collisions are still separated
  // when the strings differ in length.
  return `${hash.toString(36)}-${contents.length.toString(36)}`;
}

export type IndexDiff = {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
  /** Paths a rescan actually has to read. */
  needsWork: string[];
  isUnchanged: boolean;
};

export function diffIndex(
  previous: IndexSnapshot | null,
  next: IndexSnapshot
): IndexDiff {
  const before = new Map(
    (previous?.files ?? []).map((file) => [file.path, file.hash])
  );

  const added: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const file of next.files) {
    const previousHash = before.get(file.path);

    if (previousHash === undefined) added.push(file.path);
    else if (previousHash !== file.hash) changed.push(file.path);
    else unchanged.push(file.path);

    before.delete(file.path);
  }

  // Whatever is left in `before` was not seen this time.
  const removed = [...before.keys()];

  return {
    added,
    changed,
    removed,
    unchanged,
    needsWork: [...added, ...changed],
    isUnchanged:
      added.length === 0 && changed.length === 0 && removed.length === 0,
  };
}

export interface ScanCache {
  get(projectId: string): Promise<IndexSnapshot | null>;
  set(projectId: string, snapshot: IndexSnapshot): Promise<void>;
  clear(projectId: string): Promise<void>;
}

/**
 * Per-process cache. Correct for a single session; a shared implementation
 * backed by the database replaces it when projects persist.
 */
export class MemoryScanCache implements ScanCache {
  private snapshots = new Map<string, IndexSnapshot>();

  async get(projectId: string): Promise<IndexSnapshot | null> {
    return this.snapshots.get(projectId) ?? null;
  }

  async set(projectId: string, snapshot: IndexSnapshot): Promise<void> {
    this.snapshots.set(projectId, snapshot);
  }

  async clear(projectId: string): Promise<void> {
    this.snapshots.delete(projectId);
  }
}

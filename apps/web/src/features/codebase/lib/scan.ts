import { SAMPLE_BYTES, classifyFile, type SkipReason } from "./classify";
import { DEFAULT_IGNORES, createIgnore, parseGitignore } from "./ignore";

/**
 * Walks a project and builds an index of the files worth understanding.
 *
 * The filesystem is injected as a `ScanSource` rather than imported, so the
 * same scanner runs against the File System Access API in a browser, a
 * directory `<input>`, and a fake tree in tests.
 *
 * Failure policy: one unreadable file must never fail a scan. Errors are
 * collected and reported alongside the index — a project with a permission
 * problem in one directory is still worth understanding.
 */

export type ScanEntry = {
  path: string;
  size: number;
  isDirectory: boolean;
};

export type ScanSource = {
  /** Yields every entry, relative to the project root, using forward slashes. */
  walk(): AsyncIterable<ScanEntry>;
  /** First bytes of a file, for binary detection. */
  readSample(path: string): Promise<Uint8Array>;
  /** Full contents, used for `.gitignore`. */
  readText(path: string): Promise<string>;
};

export type IndexedFile = {
  path: string;
  size: number;
};

export type SkippedFile = {
  path: string;
  reason: SkipReason | "ignored";
};

export type ScanError = {
  path: string;
  message: string;
};

export type ScanProgress = {
  scanned: number;
  indexed: number;
  skipped: number;
  currentPath: string;
};

export type ScanResult = {
  indexed: IndexedFile[];
  skipped: SkippedFile[];
  errors: ScanError[];
  cancelled: boolean;
};

export type ScanOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void;
  /** Extra patterns, e.g. from a project setting. */
  extraIgnores?: string[];
};

export async function scanProject(
  source: ScanSource,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const { signal, onProgress, extraIgnores = [] } = options;

  const indexed: IndexedFile[] = [];
  const skipped: SkippedFile[] = [];
  const errors: ScanError[] = [];
  let cancelled = false;

  // The root .gitignore is read up front so its rules apply to the whole walk.
  let gitignorePatterns: string[] = [];
  try {
    gitignorePatterns = parseGitignore(await source.readText(".gitignore"));
  } catch {
    // No .gitignore is entirely normal — not an error worth reporting.
  }

  const ignore = createIgnore([
    ...DEFAULT_IGNORES,
    ...gitignorePatterns,
    ...extraIgnores,
  ]);

  let scanned = 0;

  for await (const entry of source.walk()) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    scanned++;

    if (ignore.ignores(entry.path, entry.isDirectory)) {
      skipped.push({ path: entry.path, reason: "ignored" });
      onProgress?.({
        scanned,
        indexed: indexed.length,
        skipped: skipped.length,
        currentPath: entry.path,
      });
      continue;
    }

    if (entry.isDirectory) {
      onProgress?.({
        scanned,
        indexed: indexed.length,
        skipped: skipped.length,
        currentPath: entry.path,
      });
      continue;
    }

    try {
      // Size and extension are checked first; the sample is only read when
      // those cannot decide, which keeps most binaries unopened.
      const cheap = classifyFile({ path: entry.path, size: entry.size });

      const classification =
        cheap.action === "skip"
          ? cheap
          : classifyFile({
              path: entry.path,
              size: entry.size,
              sample: (await source.readSample(entry.path)).slice(
                0,
                SAMPLE_BYTES
              ),
            });

      if (classification.action === "skip") {
        skipped.push({ path: entry.path, reason: classification.reason });
      } else {
        indexed.push({ path: entry.path, size: entry.size });
      }
    } catch (error) {
      errors.push({
        path: entry.path,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    onProgress?.({
      scanned,
      indexed: indexed.length,
      skipped: skipped.length,
      currentPath: entry.path,
    });
  }

  // A cancelled scan reports what it saw, but the caller is expected to
  // discard it — a partial index would misrepresent the project.
  return { indexed, skipped, errors, cancelled };
}

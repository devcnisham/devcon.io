/**
 * Where a repo's structure comes from.
 *
 * The scanner used to be the API route, which meant it could only ever read the
 * local filesystem — and that route is dev-only, because reading an arbitrary
 * path on a deployed server is a file-read primitive for anyone who can reach
 * the URL. So in production DevCon could not scan anything at all.
 *
 * Everything the digest needs is "list the paths" and "read one file as text".
 * Both are satisfiable by a local directory, a browser folder handle, a set of
 * dropped files, or a public GitHub repo. Naming that interface is what lets
 * one scanner serve all four, instead of four scanners drifting apart.
 */
export interface FileSource {
  /** Where this came from, for display. Never used to read anything. */
  readonly label: string;
  /** Project name, when the source knows it before the digest is built. */
  readonly name: string | null;
  /**
   * Every file path, relative to the repo root, forward-slashed.
   *
   * Directories are implied by the paths — a source doesn't report them
   * separately, because "which directories exist" differs between a filesystem
   * walk and a git tree, and the digest only ever wanted the derived set.
   */
  list(): Promise<string[]>;
  /** File contents as text, or null when absent or unreadable. */
  read(path: string): Promise<string | null>;
  /** The origin remote, when the source can know it without a network call. */
  remote?(): Promise<string | null>;
}

/** Directories that tell us nothing and would dominate any listing. */
export const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  ".vercel",
  "vendor",
  "target",
  "__pycache__",
  ".venv",
]);

/**
 * Files this scanner will never read, whatever a source offers.
 *
 * `.env` holds real secrets. Every source has to be able to list it — a
 * directory walk sees it, and the digest reports that it was skipped so the UI
 * can be honest — but nothing may read it. Enforced here, once, rather than in
 * each source, because a rule re-implemented four times is a rule that will be
 * got wrong in one of them.
 */
export const NEVER_READ = [/(^|\/)\.env$/, /(^|\/)\.env\.local$/, /(^|\/)\.env\.production$/];

export function isReadable(path: string): boolean {
  return !NEVER_READ.some((re) => re.test(path));
}

export function isIgnored(path: string): boolean {
  return path.split("/").some((seg) => IGNORE_DIRS.has(seg));
}

/** A source that reads a flat map of paths to contents. Used by the file-drop and tests. */
export function memorySource(
  files: Record<string, string>,
  label = "uploaded files",
  name: string | null = null,
): FileSource {
  return {
    label,
    name,
    list: async () => Object.keys(files).filter((p) => !isIgnored(p)),
    read: async (p) => (isReadable(p) ? (files[p] ?? null) : null),
  };
}

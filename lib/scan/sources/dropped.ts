import { type FileSource, isIgnored, isReadable } from "../source";

/**
 * Files the user dragged in.
 *
 * The universal fallback: works in Safari and Firefox, where the folder picker
 * doesn't exist, and for a repo that isn't on GitHub. Two paths reach it —
 * a whole folder via `<input webkitdirectory>`, which behaves almost as well as
 * the picker, or just `package.json` and `.env.example`, which is the minimum
 * that produces a useful profile.
 *
 * Be honest about the difference: with only two files there is no directory
 * structure, so completion detection finds nothing and every step reports as
 * not-started. `droppedCoverage` exists so the UI can say that rather than
 * quietly producing a worse plan.
 */

export type DropCoverage = "full" | "manifest-only";

export function droppedCoverage(files: File[]): DropCoverage {
  /**
   * A directory drop sets `webkitRelativePath`; loose files leave it empty.
   *
   * Read the RAW value, not `relPath` — that strips the chosen folder's own
   * name, so a flat repo dropped as a directory came back with no "/" left in
   * it and was misreported as manifest-only. The signal is that the browser
   * set the property at all.
   */
  const fromDirectory = files.some((f) =>
    Boolean((f as File & { webkitRelativePath?: string }).webkitRelativePath),
  );
  return fromDirectory || files.length > 8 ? "full" : "manifest-only";
}

function relPath(f: File): string {
  // `webkitRelativePath` is set by a directory input and empty for a loose file.
  const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!rel) return f.name;
  // Strip the chosen folder's own name so paths are repo-relative, matching
  // every other source. Without this, "package.json" is never found.
  const parts = rel.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : rel;
}

export function droppedSource(files: File[], label = "dropped files"): FileSource {
  const byPath = new Map<string, File>();
  for (const f of files) {
    const p = relPath(f);
    if (!isIgnored(p)) byPath.set(p, f);
  }

  const rootName = (() => {
    const first = files.find((f) =>
      (f as File & { webkitRelativePath?: string }).webkitRelativePath?.includes("/"),
    );
    const rel = (first as File & { webkitRelativePath?: string })?.webkitRelativePath;
    return rel ? rel.split("/")[0] : null;
  })();

  return {
    label: rootName ?? label,
    name: rootName,
    async list() {
      return [...byPath.keys()];
    },
    async read(path) {
      if (!isReadable(path)) return null;
      const f = byPath.get(path);
      if (!f) return null;
      try {
        return await f.text();
      } catch {
        return null;
      }
    },
    async remote() {
      // A browser file drop cannot include `.git/config` — the picker skips
      // dot-directories. No remote rather than a guessed one.
      return null;
    },
  };
}

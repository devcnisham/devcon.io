import type { FileSource } from "../source";

/**
 * A source backed by the dev-only scan route.
 *
 * The "Path" ingest tab talks to a server route rather than reading files
 * itself, so it had no `FileSource` to hand onward — which meant the registry
 * scanner worked from a folder, from GitHub and from dropped files, but not
 * from the one path a developer uses most while building this.
 *
 * Reads are one request each, which would be unacceptable over a network and is
 * fine over localhost. The route is dev-only and enforces the never-read rules
 * and the containment check itself, so this carries no security logic of its
 * own — restating it here would be a second place to get it wrong.
 */
export function devPathSource(rootPath: string): FileSource {
  let cache: string[] | null = null;

  return {
    label: rootPath,
    name: rootPath.split("/").filter(Boolean).pop() ?? rootPath,

    async list() {
      if (cache) return cache;
      try {
        const res = await fetch(
          `/api/scan/files?path=${encodeURIComponent(rootPath)}`,
        );
        if (!res.ok) {
          cache = [];
          return cache;
        }
        cache = ((await res.json()) as { files?: string[] }).files ?? [];
        return cache;
      } catch {
        cache = [];
        return cache;
      }
    },

    async read(file) {
      try {
        const res = await fetch(
          `/api/scan/files?path=${encodeURIComponent(rootPath)}&file=${encodeURIComponent(file)}`,
        );
        if (!res.ok) return null;
        return ((await res.json()) as { content: string | null }).content;
      } catch {
        return null;
      }
    },

    async remote() {
      // `.git/config` is listed by nodeSource, so this goes through the same
      // read path as anything else rather than needing its own endpoint.
      const cfg = await this.read(".git/config");
      if (!cfg) return null;
      return /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(cfg)?.[1] ?? null;
    },
  };
}

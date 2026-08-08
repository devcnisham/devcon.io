import { promises as fs } from "node:fs";
import path from "node:path";
import { type FileSource, IGNORE_DIRS, isReadable } from "../source";

/**
 * A directory on the machine running the server.
 *
 * Server-side only, and only ever reachable from the dev-only route — reading
 * an arbitrary path on a deployed host is a file-read primitive for anyone who
 * can reach the URL. The guard lives on the route; this file just does the walk.
 */

const MAX_FILES = 20000;
const MAX_DEPTH = 8;

export function nodeSource(root: string): FileSource {
  let cache: string[] | null = null;

  async function walk(
    dir: string,
    depth: number,
    out: string[],
  ): Promise<void> {
    if (depth > MAX_DEPTH || out.length > MAX_FILES) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (e.isDirectory()) {
        // `.git` is descended one level only — `.git/config` names the real
        // repository, and nothing else in there is worth the walk.
        if (e.name === ".git") {
          if (depth === 0) {
            try {
              await fs.access(path.join(full, "config"));
              out.push(".git/config");
            } catch {
              /* no config */
            }
          }
          continue;
        }
        if (IGNORE_DIRS.has(e.name)) continue;
        await walk(full, depth + 1, out);
      } else {
        out.push(rel);
      }
    }
  }

  return {
    label: root,
    name: path.basename(root),
    async list() {
      if (!cache) {
        const out: string[] = [];
        await walk(root, 0, out);
        cache = out;
      }
      return cache;
    },
    async read(rel) {
      if (!isReadable(rel)) return null;
      // Containment check: a path escaping the chosen root would turn a scan
      // into an arbitrary read, even on a developer's own machine.
      const full = path.resolve(root, rel);
      if (full !== root && !full.startsWith(root + path.sep)) return null;
      try {
        return await fs.readFile(full, "utf8");
      } catch {
        return null;
      }
    },
    async remote() {
      try {
        const cfg = await fs.readFile(
          path.join(root, ".git", "config"),
          "utf8",
        );
        return (
          /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(cfg)?.[1] ?? null
        );
      } catch {
        return null;
      }
    },
  };
}

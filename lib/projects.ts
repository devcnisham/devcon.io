import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { migrateLegacyStore } from "./workspace.ts";

/**
 * The projects you have opened.
 *
 * Stored at `~/.devcon/workspaces.json` — user-level, like `~/.gitconfig`, and
 * deliberately **never inside the project being tracked**. Writing a dotfile
 * into someone's repo means it lands in their diff, their commit and their
 * submission, and devcon's whole job is to keep that surface clean.
 *
 * Paths only. No file contents are copied out of a project and nothing is sent
 * anywhere; this is a list of places, not a cache of code.
 */

export interface Project {
  /** Absolute, resolved. The identity of the row. */
  path: string;
  /**
   * The workspace it belongs to.
   *
   * Optional because every row written before feature 003 has none. Those are
   * adopted once by `adoptOrphanProjects` rather than being filtered out —
   * silently hiding someone's project list behind a new concept would be the
   * worst possible introduction to it.
   */
  workspaceId?: string;
  /** Folder name, for display. */
  name: string;
  addedAt: number;
  lastOpenedAt: number;
}

/**
 * Renamed from `workspaces.json` by feature 003, which needed that filename for
 * the thing that actually is a workspace. `migrateLegacyStore` moves the old
 * file's contents here on first read and retires it as `.legacy` rather than
 * deleting it.
 */
export const STORE = join(homedir(), ".devcon", "projects.json");

/**
 * Which project the work page is showing.
 *
 * A separate file rather than a field on the list, so the list keeps the shape
 * it already has on disk and nobody's existing `workspaces.json` has to be
 * migrated or silently dropped.
 */
export const ACTIVE = join(homedir(), ".devcon", "active.json");

/** `~/code/app` → `/Users/you/code/app`. Typed paths usually start with `~`. */
export function expandHome(p: string, home = homedir()): string {
  const t = p.trim();
  if (t === "~") return home;
  if (t.startsWith("~/")) return join(home, t.slice(2));
  return t;
}

export type ImportError =
  | "empty"
  | "not-absolute"
  | "missing"
  | "not-a-directory";

export const IMPORT_MESSAGE: Record<ImportError, string> = {
  empty: "Enter the path to a project folder.",
  "not-absolute": "Use a full path, starting with / or ~.",
  missing: "Nothing exists at that path.",
  "not-a-directory": "That is a file, not a project folder.",
};

/**
 * Is this a folder devcon can open?
 *
 * Deliberately does **not** require a `SHIP.md` or a `package.json`. A student
 * importing a project that has neither is the entire point of Mode 1 — refusing
 * it would turn away exactly the person the mode exists for.
 */
export async function validatePath(
  raw: string,
): Promise<{ ok: true; path: string } | { ok: false; error: ImportError }> {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, error: "empty" };

  const expanded = expandHome(trimmed);
  if (!isAbsolute(expanded)) return { ok: false, error: "not-absolute" };

  const path = resolve(expanded);
  try {
    const s = await stat(path);
    if (!s.isDirectory()) return { ok: false, error: "not-a-directory" };
    return { ok: true, path };
  } catch {
    return { ok: false, error: "missing" };
  }
}

async function readStore(file: string): Promise<Project[]> {
  await migrateLegacyStore(join(dirname(file), "workspaces.json"), file);
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    // A hand-edited or half-written store must not take the page down with it.
    return Array.isArray(parsed)
      ? parsed.filter(
          (w): w is Project =>
            typeof w?.path === "string" && typeof w?.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}

async function writeStore(file: string, list: Project[]): Promise<void> {
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, `${JSON.stringify(list, null, 2)}\n`, "utf8");
}

/**
 * Most recently opened first, optionally only those in one workspace.
 *
 * Called with no workspace it returns everything, which is what the surfaces
 * that are about *this machine* rather than about a workspace still want.
 */
export async function listProjects(
  workspaceId?: string,
  file = STORE,
): Promise<Project[]> {
  const list = await readStore(file);
  const mine = workspaceId
    ? list.filter((p) => p.workspaceId === workspaceId)
    : list;
  return [...mine].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

/**
 * Give every unowned project to a workspace. Runs once and then does nothing.
 *
 * Rows written before feature 003 have no `workspaceId`. Rather than leaving
 * them invisible — a list that empties itself the day a new concept ships —
 * they are handed to the first workspace that asks.
 */
export async function adoptOrphanProjects(
  workspaceId: string,
  file = STORE,
): Promise<number> {
  const list = await readStore(file);
  const orphans = list.filter((p) => !p.workspaceId);
  if (orphans.length === 0) return 0;

  await writeStore(
    file,
    list.map((p) => (p.workspaceId ? p : { ...p, workspaceId })),
  );
  return orphans.length;
}

/**
 * Add a folder, or move it to the top if it is already there.
 *
 * Re-importing is not an error and must not create a second row — the path is
 * the identity.
 */
export async function addProject(
  path: string,
  workspaceId?: string,
  file = STORE,
  now = Date.now(),
): Promise<Project> {
  const list = await readStore(file);
  const existing = list.find((w) => w.path === path);

  const ws: Project = existing
    ? {
        ...existing,
        lastOpenedAt: now,
        workspaceId: existing.workspaceId ?? workspaceId,
      }
    : {
        path,
        name: basename(path) || path,
        workspaceId,
        addedAt: now,
        lastOpenedAt: now,
      };

  await writeStore(file, [ws, ...list.filter((w) => w.path !== path)]);
  return ws;
}

export async function removeProject(path: string, file = STORE): Promise<void> {
  const list = await readStore(file);
  await writeStore(
    file,
    list.filter((w) => w.path !== path),
  );
}

/** Whether a workspace still exists on disk, and whether it has a spec yet. */
export async function describeProject(
  w: Project,
): Promise<{ exists: boolean; hasSpec: boolean }> {
  const exists = await stat(w.path).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (!exists) return { exists: false, hasSpec: false };
  const hasSpec = await stat(join(w.path, "SHIP.md")).then(
    () => true,
    () => false,
  );
  return { exists, hasSpec };
}

/** Remember which project the work page should open. */
export async function setActive(path: string, file = ACTIVE): Promise<void> {
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, `${JSON.stringify({ path })}\n`, "utf8");
}

/**
 * The project the work page is showing, or null.
 *
 * Checked against the disk every time. A remembered path whose folder has
 * since been deleted would have the work page name a project that is not
 * there — the same class of claim this tool exists to catch.
 */
export async function getActive(
  file = ACTIVE,
  store = STORE,
): Promise<Project | null> {
  let path: string;
  try {
    path = JSON.parse(await readFile(file, "utf8"))?.path;
  } catch {
    return null;
  }
  if (typeof path !== "string" || !path) return null;

  const stillThere = await stat(path).then(
    (s) => s.isDirectory(),
    () => false,
  );
  if (!stillThere) return null;

  const list = await listProjects(undefined, store);
  return list.find((w) => w.path === path) ?? null;
}

/** Forgetting the open project clears it, rather than leaving a dangling row. */
export async function clearActiveIf(
  path: string,
  file = ACTIVE,
): Promise<void> {
  try {
    const current = JSON.parse(await readFile(file, "utf8"))?.path;
    if (current === path) await writeFile(file, "{}\n", "utf8");
  } catch {
    // No active file is the same as nothing to clear.
  }
}

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";

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

export interface Workspace {
  /** Absolute, resolved. The identity of the row. */
  path: string;
  /** Folder name, for display. */
  name: string;
  addedAt: number;
  lastOpenedAt: number;
}

export const STORE = join(homedir(), ".devcon", "workspaces.json");

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

async function readStore(file: string): Promise<Workspace[]> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    // A hand-edited or half-written store must not take the page down with it.
    return Array.isArray(parsed)
      ? parsed.filter(
          (w): w is Workspace =>
            typeof w?.path === "string" && typeof w?.name === "string",
        )
      : [];
  } catch {
    return [];
  }
}

async function writeStore(file: string, list: Workspace[]): Promise<void> {
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, `${JSON.stringify(list, null, 2)}\n`, "utf8");
}

/** Most recently opened first. */
export async function listWorkspaces(file = STORE): Promise<Workspace[]> {
  const list = await readStore(file);
  return [...list].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

/**
 * Add a folder, or move it to the top if it is already there.
 *
 * Re-importing is not an error and must not create a second row — the path is
 * the identity.
 */
export async function addWorkspace(
  path: string,
  file = STORE,
  now = Date.now(),
): Promise<Workspace> {
  const list = await readStore(file);
  const existing = list.find((w) => w.path === path);

  const ws: Workspace = existing
    ? { ...existing, lastOpenedAt: now }
    : { path, name: basename(path) || path, addedAt: now, lastOpenedAt: now };

  await writeStore(file, [ws, ...list.filter((w) => w.path !== path)]);
  return ws;
}

export async function removeWorkspace(
  path: string,
  file = STORE,
): Promise<void> {
  const list = await readStore(file);
  await writeStore(
    file,
    list.filter((w) => w.path !== path),
  );
}

/** Whether a workspace still exists on disk, and whether it has a spec yet. */
export async function describeWorkspace(
  w: Workspace,
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

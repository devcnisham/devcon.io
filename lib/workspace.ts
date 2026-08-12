import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * A workspace — feature 003, phase 0.
 *
 * The thing that owns projects and belongs to a person. Until now devcon kept
 * one flat list of folders with nothing above it, which was fine while there
 * was one user and no accounts; features 001 and 002 ended that.
 *
 * **The name had to be taken back first.** `lib/workspaces.ts` used
 * "workspace" to mean "a folder you opened", while every surface in `app/`
 * already called those *projects* — `ProjectCard`, `detectProject`, the
 * "projects" stat. Only the storage module disagreed, so it was renamed to
 * `lib/projects.ts` rather than inventing a second word for this.
 *
 * One personal workspace is created for you and that is usually the end of it.
 * Several are allowed because separating work from side projects is the first
 * thing anyone asks for, and retrofitting a one-to-many later means migrating
 * everyone. **Sharing one with another person is not this** — that is phase 26,
 * and nothing here has an invite, a role or a permission.
 */

export interface Workspace {
  id: string;
  /** The account that owns it. There is no sharing yet. */
  ownerId: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
}

export const WORKSPACES = join(homedir(), ".devcon", "workspaces.json");
export const ACTIVE_WORKSPACE = join(
  homedir(),
  ".devcon",
  "active-workspace.json",
);

export const MAX_WORKSPACE_NAME = 60;

export type WorkspaceError = "name-empty" | "name-long" | "not-found";

export const WORKSPACE_MESSAGE: Record<WorkspaceError, string> = {
  "name-empty": "Give the workspace a name.",
  "name-long": `Keep the name under ${MAX_WORKSPACE_NAME} characters.`,
  "not-found": "That workspace does not exist.",
};

export function normalizeWorkspaceName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

export function validateWorkspaceName(raw: string): WorkspaceError | null {
  const name = normalizeWorkspaceName(raw);
  if (!name) return "name-empty";
  if (name.length > MAX_WORKSPACE_NAME) return "name-long";
  return null;
}

function isWorkspace(w: unknown): w is Workspace {
  const r = w as Partial<Workspace> | null;
  return (
    typeof r?.id === "string" &&
    typeof r.ownerId === "string" &&
    typeof r.name === "string"
  );
}

/**
 * The old `workspaces.json` held folders, not workspaces.
 *
 * Feature 003 needs the filename, and the file already existed on every machine
 * that had run devcon — including one with a real project list in it. So the
 * legacy content is **moved** to `projects.json` rather than overwritten, and
 * only if `projects.json` is not already there. Idempotent, because both this
 * module and `lib/projects.ts` call it and either may be first.
 *
 * A legacy row is one with a `path`. A new row has an `id` and an `ownerId` and
 * no path, so the two shapes cannot be confused.
 */
export async function migrateLegacyStore(
  workspaces = WORKSPACES,
  projects = join(dirname(workspaces), "projects.json"),
): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(workspaces, "utf8");
  } catch {
    return; // Nothing to migrate. The ordinary case after the first run.
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return; // Unreadable is left alone rather than destroyed.
  }
  if (!Array.isArray(parsed)) return;

  const legacy = parsed.filter(
    (r) => typeof (r as { path?: unknown })?.path === "string",
  );
  if (legacy.length === 0) return;

  // Never clobber a projects.json that already exists — that would be the
  // migration deleting the thing it was meant to preserve.
  try {
    await readFile(projects, "utf8");
    // Already migrated. Retire the legacy file so this stops running.
    await rename(workspaces, `${workspaces}.legacy`);
    return;
  } catch {
    // No projects.json yet, which is the case this exists for.
  }

  await mkdir(dirname(projects), { recursive: true });
  await writeFile(projects, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
  // Moved, not deleted. If anything about this was wrong the original is still
  // on disk under a name nothing reads.
  await rename(workspaces, `${workspaces}.legacy`);
}

async function readWorkspaces(file: string): Promise<Workspace[]> {
  await migrateLegacyStore(file);
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return Array.isArray(parsed) ? parsed.filter(isWorkspace) : [];
  } catch {
    return [];
  }
}

async function writeWorkspaces(file: string, list: Workspace[]): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(list, null, 2)}\n`, "utf8");
}

/** Every workspace this account owns, oldest first so the default leads. */
export async function listWorkspaces(
  ownerId: string,
  file = WORKSPACES,
): Promise<Workspace[]> {
  const all = await readWorkspaces(file);
  return all
    .filter((w) => w.ownerId === ownerId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createWorkspace(
  ownerId: string,
  name: string,
  file = WORKSPACES,
  now = Date.now(),
): Promise<
  { ok: true; workspace: Workspace } | { ok: false; error: WorkspaceError }
> {
  const invalid = validateWorkspaceName(name);
  if (invalid) return { ok: false, error: invalid };

  const list = await readWorkspaces(file);
  const workspace: Workspace = {
    id: randomUUID(),
    ownerId,
    name: normalizeWorkspaceName(name),
    createdAt: now,
  };
  await writeWorkspaces(file, [...list, workspace]);
  return { ok: true, workspace };
}

export async function renameWorkspace(
  ownerId: string,
  id: string,
  name: string,
  file = WORKSPACES,
  now = Date.now(),
): Promise<
  { ok: true; workspace: Workspace } | { ok: false; error: WorkspaceError }
> {
  const invalid = validateWorkspaceName(name);
  if (invalid) return { ok: false, error: invalid };

  const list = await readWorkspaces(file);
  // Owner is part of the lookup, not checked after it. A workspace belonging to
  // someone else must be indistinguishable from one that does not exist.
  const i = list.findIndex((w) => w.id === id && w.ownerId === ownerId);
  if (i === -1) return { ok: false, error: "not-found" };

  const next: Workspace = {
    ...list[i],
    name: normalizeWorkspaceName(name),
    updatedAt: now,
  };
  await writeWorkspaces(
    file,
    list.map((w, j) => (j === i ? next : w)),
  );
  return { ok: true, workspace: next };
}

/**
 * The workspace this account is looking at, creating one if it has none.
 *
 * Everyone has exactly one until they say otherwise, so there is no empty
 * state to design and no "create your first workspace" step between signing up
 * and using the thing. Existing accounts get theirs the first time they load a
 * page after this shipped, which is why this is lazy rather than a signup step.
 */
export async function activeWorkspace(
  ownerId: string,
  file = WORKSPACES,
  activeFile = ACTIVE_WORKSPACE,
): Promise<Workspace> {
  const mine = await listWorkspaces(ownerId, file);

  let wantedId: string | undefined;
  try {
    wantedId = JSON.parse(await readFile(activeFile, "utf8"))?.[ownerId];
  } catch {
    // No active file is the same as no preference.
  }

  const chosen = mine.find((w) => w.id === wantedId) ?? mine[0];
  if (chosen) return chosen;

  const made = await createWorkspace(ownerId, "Personal", file);
  // `createWorkspace` only fails on a bad name, and "Personal" is not one.
  if (!made.ok) throw new Error(`could not create a workspace: ${made.error}`);
  return made.workspace;
}

/** Remember which workspace an account is looking at. Keyed by account. */
export async function setActiveWorkspace(
  ownerId: string,
  id: string,
  activeFile = ACTIVE_WORKSPACE,
): Promise<void> {
  let map: Record<string, string> = {};
  try {
    const parsed = JSON.parse(await readFile(activeFile, "utf8"));
    if (parsed && typeof parsed === "object") map = parsed;
  } catch {
    // Starting fresh.
  }
  map[ownerId] = id;
  await mkdir(dirname(activeFile), { recursive: true });
  await writeFile(activeFile, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

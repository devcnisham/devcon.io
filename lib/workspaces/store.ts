export interface WorkspaceMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Where it came from, shown as the card subtitle. */
  origin: "workspace" | "folder" | "repo" | "link";
  /** Absolute path to a real repo, when this workspace is backed by one. */
  repoPath?: string;
}

const KEY = "devcon.workspaces";

/**
 * Browser-local workspace list.
 *
 * Deliberately behind a narrow read/write pair so swapping to the server is
 * one file. Same reasoning as PlanStore in the plan: the shape is what the
 * server row will hold, only the storage differs.
 */
export function listWorkspaces(): WorkspaceMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspaceMeta[];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    // Corrupt storage shouldn't take the page down.
    return [];
  }
}

export function saveWorkspaces(list: WorkspaceMeta[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function createWorkspace(
  name = "Untitled workspace",
  origin: WorkspaceMeta["origin"] = "workspace",
  repoPath?: string,
): WorkspaceMeta {
  const now = Date.now();
  const meta: WorkspaceMeta = {
    id: `w_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    origin,
    ...(repoPath ? { repoPath } : {}),
  };
  saveWorkspaces([meta, ...listWorkspaces()]);
  return meta;
}

export function deleteWorkspace(id: string): void {
  saveWorkspaces(listWorkspaces().filter((w) => w.id !== id));
}

export function renameWorkspace(id: string, name: string): void {
  saveWorkspaces(
    listWorkspaces().map((w) =>
      w.id === id ? { ...w, name, updatedAt: Date.now() } : w,
    ),
  );
}

const ORIGIN_LABEL: Record<WorkspaceMeta["origin"], string> = {
  workspace: "Workspace",
  folder: "Folder",
  repo: "Repository",
  link: "Link",
};

export function originLabel(origin: WorkspaceMeta["origin"]): string {
  return ORIGIN_LABEL[origin];
}

export function relativeTime(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

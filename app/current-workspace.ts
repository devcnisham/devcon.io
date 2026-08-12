import { adoptOrphanProjects } from "@/lib/projects.ts";
import { activeWorkspace, type Workspace } from "@/lib/workspace.ts";
import { currentUser } from "./current-user";

/**
 * The workspace the signed-in account is looking at, or null when signed out.
 *
 * Creates one on first use rather than making signup a two-step wizard, and
 * adopts any project from before feature 003 into it. Both are idempotent, so
 * this is safe to call from every page that needs it — which is what lets the
 * rail and the dashboard agree without threading the value through props.
 */
export async function currentWorkspace(): Promise<Workspace | null> {
  const user = await currentUser();
  if (!user) return null;

  const workspace = await activeWorkspace(user.id);
  // One-time, and a no-op every time after. A project list that emptied itself
  // the day workspaces shipped would be the worst possible introduction to
  // them, so the rows that predate the concept are handed over rather than
  // filtered out.
  await adoptOrphanProjects(workspace.id);
  return workspace;
}

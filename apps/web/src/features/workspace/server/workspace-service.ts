import "server-only";

import { can, type WorkspaceRole } from "@/features/workspace/lib/permissions";
import { uniqueSlug } from "@/features/workspace/lib/slug";
import type { ActivityKind } from "@/features/workspace/types";

/**
 * The persistence seam for workspaces. The database feature's Drizzle
 * implementation lives in src/lib/server/stores/ (app glue), so this module
 * stays feature-local and fake-db testable.
 */

export type WorkspaceDb = {
  listWorkspaceSlugs(): Promise<string[]>;
  findWorkspace(
    id: string
  ): Promise<{ name: string; deletedAt: string | null } | null>;
  findMembership(
    workspaceId: string,
    userId: string
  ): Promise<{ role: string } | null>;
  insertWorkspace(row: { name: string; slug: string }): Promise<{
    id: string;
    slug: string;
  }>;
  insertMembership(row: {
    workspaceId: string;
    userId: string;
    role: string;
  }): Promise<void>;
  insertEvent(row: {
    workspaceId: string;
    kind: ActivityKind;
    actorName: string;
    summary: string;
  }): Promise<void>;
  updateWorkspace(id: string, patch: { name: string }): Promise<void>;
  softDeleteWorkspace(id: string): Promise<void>;
};

export type WorkspaceActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

const DENIED = {
  ok: false,
  message: "You do not have permission to do that.",
} as const;

export function createWorkspaceService(db: WorkspaceDb) {
  async function membership(
    workspaceId: string,
    userId: string
  ): Promise<{ role: WorkspaceRole } | null> {
    const row = await db.findMembership(workspaceId, userId);
    if (!row) return null;
    return { role: row.role as WorkspaceRole };
  }

  async function createWorkspace(
    input: { name: string; slug: string },
    userId: string
  ): Promise<WorkspaceActionResult<{ id: string; slug: string }>> {
    const taken = new Set(await db.listWorkspaceSlugs());
    // An edited slug wins; otherwise derive from the name. uniqueSlug already
    // reserves reserved words and suffixes anything taken.
    const requested = input.slug?.trim();
    const slug = uniqueSlug(requested || input.name, taken);

    const ws = await db.insertWorkspace({ name: input.name, slug });
    await db.insertMembership({
      workspaceId: ws.id,
      userId,
      role: "owner",
    });
    await db.insertEvent({
      workspaceId: ws.id,
      kind: "workspace.created",
      actorName: "you",
      summary: `${input.name} was created`,
    });

    return { ok: true, data: { id: ws.id, slug: ws.slug } };
  }

  async function renameWorkspace(
    input: { workspaceId: string; name: string },
    userId: string
  ): Promise<WorkspaceActionResult> {
    const membershipRow = await membership(input.workspaceId, userId);
    if (!membershipRow || !can(membershipRow.role, "workspace:update")) {
      return DENIED;
    }

    const ws = await db.findWorkspace(input.workspaceId);
    if (!ws) return { ok: false, message: "Workspace not found." };
    if (ws.deletedAt) return { ok: false, message: "Workspace already deleted." };

    await db.updateWorkspace(input.workspaceId, { name: input.name });
    await db.insertEvent({
      workspaceId: input.workspaceId,
      kind: "workspace.renamed",
      actorName: "you",
      summary: `${input.name} was renamed`,
    });
    return { ok: true };
  }

  async function deleteWorkspace(
    input: { workspaceId: string; confirmation: string },
    userId: string
  ): Promise<WorkspaceActionResult> {
    const membershipRow = await membership(input.workspaceId, userId);
    if (!membershipRow || !can(membershipRow.role, "workspace:delete")) {
      return DENIED;
    }

    const ws = await db.findWorkspace(input.workspaceId);
    if (!ws) return { ok: false, message: "Workspace not found." };
    if (ws.deletedAt) return { ok: false, message: "Workspace already deleted." };
    // Server-side retype check — the action's schema only validates shape, so
    // the confirmation is verified here against the workspace's real name.
    if (input.confirmation !== ws.name) {
      return { ok: false, message: "Type the workspace name exactly to confirm" };
    }

    await db.softDeleteWorkspace(input.workspaceId);
    await db.insertEvent({
      workspaceId: input.workspaceId,
      kind: "workspace.deleted",
      actorName: "you",
      summary: `${ws.name} was deleted`,
    });
    return { ok: true };
  }

  return { createWorkspace, renameWorkspace, deleteWorkspace };
}

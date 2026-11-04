import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/features/database/server";
import {
  workspaceActivities,
  workspaceMembers,
  workspaces,
} from "@/features/database/schema";
import type { ActivityEvent } from "@/features/workspace/types";
import {
  createWorkspaceService,
  type WorkspaceDb,
} from "@/features/workspace/server/workspace-service";

/**
 * App glue: the workspace feature's persistence seam, backed by Drizzle.
 * Imports the feature (workspace) and the database — nothing imports this
 * except the store's own read helpers (findWorkspacesForUser,
 * findWorkspaceEvents), the server actions, and the integration tests.
 */

// Exported for the integration test (workspace-store.integration.test.ts),
// which exercises listWorkspaceSlugs against the real local stack.
export const drizzleWorkspaceDb: WorkspaceDb = {
  // Deleted slugs stay reserved: the DB unique index on slug covers soft-deleted
  // rows, so freeing a deleted slug would require a partial unique index. Keeping
  // them taken is the simplest safe option — a freed slug could otherwise crash
  // create with a unique violation on the very next row.
  listWorkspaceSlugs: async () => {
    const rows = await db
      .select({ slug: workspaces.slug })
      .from(workspaces);
    return rows.map((r) => r.slug);
  },

  findWorkspace: async (id) => {
    const [row] = await db
      .select({ name: workspaces.name, deletedAt: workspaces.deletedAt })
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    if (!row) return null;
    return { name: row.name, deletedAt: row.deletedAt?.toISOString() ?? null };
  },

  findMembership: async (workspaceId, userId) => {
    const row = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);
    return row[0] ?? null;
  },

  insertWorkspace: async ({ name, slug }) => {
    const [row] = await db
      .insert(workspaces)
      .values({ name, slug })
      .returning({ id: workspaces.id, slug: workspaces.slug });
    return row;
  },

  insertMembership: async (row) => {
    await db.insert(workspaceMembers).values(row);
  },

  insertEvent: async (row) => {
    // All five columns map 1:1 to the table; occurred_at defaults to now().
    await db.insert(workspaceActivities).values({
      workspaceId: row.workspaceId,
      kind: row.kind,
      actorName: row.actorName,
      summary: row.summary,
    });
  },

  updateWorkspace: async (id, patch) => {
    await db.update(workspaces).set(patch).where(eq(workspaces.id, id));
  },

  softDeleteWorkspace: async (id) => {
    await db
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.id, id));
  },
};

export const workspaceService = createWorkspaceService(drizzleWorkspaceDb);

/**
 * The user's live workspaces, oldest first. Pages that need a default
 * workspace context (the project wizard) resolve it here; soft-deleted
 * workspaces are excluded so a deleted workspace never receives new projects.
 */
export async function findWorkspacesForUser(
  userId: string
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id)
    )
    .where(
      and(eq(workspaceMembers.userId, userId), isNull(workspaces.deletedAt))
    )
    .orderBy(asc(workspaces.createdAt));
  return rows;
}

/**
 * The activity feed's read path: the newest 50 events for a workspace, newest
 * first. The feed component renders them via the loadWorkspaceActivityAction
 * server action; soft-deleted workspaces return no events (their rows are
 * gone or hidden by the member join — the feed is only reachable from the
 * member's own workspace view).
 */
export async function findWorkspaceEvents(
  workspaceId: string
): Promise<ActivityEvent[]> {
  const rows = await db
    .select({
      id: workspaceActivities.id,
      kind: workspaceActivities.kind,
      actorName: workspaceActivities.actorName,
      summary: workspaceActivities.summary,
      occurredAt: workspaceActivities.occurredAt,
    })
    .from(workspaceActivities)
    .where(eq(workspaceActivities.workspaceId, workspaceId))
    .orderBy(desc(workspaceActivities.occurredAt))
    .limit(50);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as ActivityEvent["kind"],
    actorName: row.actorName,
    summary: row.summary,
    occurredAt: row.occurredAt.toISOString(),
  }));
}

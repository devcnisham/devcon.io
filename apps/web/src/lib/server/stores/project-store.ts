import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/features/database/server";
import {
  projects,
  workspaceMembers,
  workspaces,
} from "@/features/database/schema";
import {
  createProjectService,
  type ProjectDb,
} from "@/features/project/server/project-service";

/**
 * App glue: the project feature's persistence seam, backed by Drizzle.
 * Imports the project feature and the database — nothing imports this except
 * the integration test, the server actions, and the codebase store (which
 * reuses findWorkspaceMembership for the canvas permission gate).
 */

// Exported for the integration test (project-store.integration.test.ts),
// which exercises listProjectSlugs against the real local stack.
export const drizzleProjectDb: ProjectDb = {
  // Deleted slugs stay reserved: the projects_workspace_slug_unique index
  // covers soft-deleted rows, so freeing a deleted slug would require a
  // partial unique index. Keeping them taken is the simplest safe option — a
  // freed slug could otherwise crash create with a unique violation on the
  // very next row (the BUG-019 defect class from Task 8's review).
  listProjectSlugs: async (workspaceId) => {
    const rows = await db
      .select({ slug: projects.slug })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId));
    return rows.map((r) => r.slug);
  },

  findWorkspace: async (workspaceId) => {
    const [row] = await db
      .select({ deletedAt: workspaces.deletedAt })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!row) return null;
    return { deletedAt: row.deletedAt?.toISOString() ?? null };
  },

  findWorkspaceMembership: async (workspaceId, userId) => {
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

  insertProject: async (row) => {
    const [inserted] = await db
      .insert(projects)
      .values(row)
      .returning({ id: projects.id, slug: projects.slug });
    return inserted;
  },

  updateProject: async (id, patch) => {
    await db.update(projects).set(patch).where(eq(projects.id, id));
  },

  findProject: async (id) => {
    const [row] = await db
      .select({
        workspaceId: projects.workspaceId,
        name: projects.name,
        description: projects.description,
        type: projects.type,
        visibility: projects.visibility,
        status: projects.status,
        deletedAt: projects.deletedAt,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (!row) return null;
    return {
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description ?? "",
      type: row.type ?? null,
      visibility: row.visibility,
      status: row.status,
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  },
};

export const projectService = createProjectService(drizzleProjectDb);

/**
 * Settings-page resolution: "the current project" is the most recently created
 * non-deleted project in a workspace the user belongs to. Route-level project
 * selection does not exist yet — Task 11 extends this read path.
 */
export async function findCurrentProject(
  userId: string
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, projects.workspaceId)
    )
    .where(and(eq(workspaceMembers.userId, userId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt))
    .limit(1);
  return row ?? null;
}

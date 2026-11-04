import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/features/database/server";
import {
  codebases,
  codebaseScans,
  detectedFeatures,
  detectedTechnologies,
  projects,
} from "@/features/database/schema";
import {
  createCodebaseService,
  type CodebaseDb,
} from "@/features/codebase/server/codebase-service";
import { drizzleProjectDb } from "./project-store";

/**
 * App glue: the codebase feature's persistence seam, backed by Drizzle.
 * Imports the codebase feature, the project store (for the project-exists
 * guard and membership lookups), and the database — nothing imports this
 * except the integration test and the server actions.
 *
 * replaceTechnologies / replaceFeatures replace the full set for a codebase:
 * the detected rows are a snapshot of the latest analysis, so every save
 * deletes the previous set and inserts the new one (a rescan can drop a
 * technology the project no longer uses).
 */

export const drizzleCodebaseDb: CodebaseDb = {
  findProject: async (id) => {
    const project = await drizzleProjectDb.findProject(id);
    return project ? { deletedAt: project.deletedAt } : null;
  },

  // The permission seam: the codebase feature resolves the project's workspace
  // and the caller's role there, reusing the project store's membership query.
  findProjectWorkspace: async (projectId) => {
    const [row] = await db
      .select({ workspaceId: projects.workspaceId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return row ?? null;
  },

  findWorkspaceMembership: async (workspaceId, userId) =>
    drizzleProjectDb.findWorkspaceMembership(workspaceId, userId),

  findCodebase: async (projectId) => {
    const [row] = await db
      .select({ id: codebases.id })
      .from(codebases)
      .where(eq(codebases.projectId, projectId))
      .limit(1);
    return row ?? null;
  },

  insertCodebase: async (row) => {
    const [inserted] = await db
      .insert(codebases)
      .values(row)
      .returning({ id: codebases.id });
    return inserted;
  },

  updateCodebaseCounts: async (codebaseId, fileCount, totalBytes) => {
    await db
      .update(codebases)
      .set({ fileCount, totalBytes })
      .where(eq(codebases.id, codebaseId));
  },

  insertScan: async (row) => {
    await db.insert(codebaseScans).values(row);
  },

  replaceTechnologies: async (codebaseId, rows) => {
    await db
      .delete(detectedTechnologies)
      .where(eq(detectedTechnologies.codebaseId, codebaseId));
    if (rows.length === 0) return;
    await db
      .insert(detectedTechnologies)
      .values(rows.map((row) => ({ ...row, codebaseId })));
  },

  replaceFeatures: async (codebaseId, rows) => {
    await db
      .delete(detectedFeatures)
      .where(eq(detectedFeatures.codebaseId, codebaseId));
    if (rows.length === 0) return;
    await db
      .insert(detectedFeatures)
      .values(rows.map((row) => ({ ...row, codebaseId })));
  },

  // A soft-deleted project's scans must not be returned — the codebase row
  // survives (it belongs to the project) but the project is gone, so joining
  // projects and filtering deletedAt keeps loadLatest consistent with every
  // other project-scoped read.
  findLatestScan: async (projectId) => {
    const [scan] = await db
      .select({
        entries: codebaseScans.entries,
        skipped: codebaseScans.skipped,
        errors: codebaseScans.errors,
        analysis: codebaseScans.analysis,
        scannedAt: codebaseScans.scannedAt,
      })
      .from(codebaseScans)
      .innerJoin(codebases, eq(codebases.id, codebaseScans.codebaseId))
      .innerJoin(projects, eq(projects.id, codebases.projectId))
      .where(
        and(
          eq(codebases.projectId, projectId),
          isNull(projects.deletedAt)
        )
      )
      .orderBy(desc(codebaseScans.scannedAt))
      .limit(1);
    return scan ?? null;
  },
};

export const codebaseService = createCodebaseService(drizzleCodebaseDb);

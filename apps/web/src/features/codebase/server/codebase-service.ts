import "server-only";

import {
  can,
  type WorkspaceCapability,
  type WorkspaceRole,
} from "@/features/workspace/lib/permissions";
import type { ProjectAnalysis } from "@/features/codebase/lib/analyze";
import type {
  IndexedFile,
  ScanError,
  SkippedFile,
} from "@/features/codebase/lib/scan";

/**
 * The persistence seam for codebase scans ("the canvas"). Feature-local and
 * fake-db testable; the Drizzle implementation lives in
 * src/lib/server/stores/codebase-store.ts (app glue).
 *
 * saveAnalysis verifies the project exists and is live before writing — a scan
 * must never be attached to a missing or soft-deleted project. Both save and
 * load are permission-gated: a scan is only written or read by a member of the
 * project's workspace whose role allows `project:update` / `project:read`
 * (the same memberCan pattern the project service uses, so the messages read
 * the same everywhere).
 */

export type SaveAnalysisInput = {
  projectId: string;
  rootPath: string;
  indexed: IndexedFile[];
  skipped: SkippedFile[];
  errors: ScanError[];
  analysis: ProjectAnalysis;
};

export type CodebaseDb = {
  findProject(projectId: string): Promise<{ deletedAt: string | null } | null>;
  findProjectWorkspace(
    projectId: string
  ): Promise<{ workspaceId: string } | null>;
  findWorkspaceMembership(
    workspaceId: string,
    userId: string
  ): Promise<{ role: string } | null>;
  findCodebase(projectId: string): Promise<{ id: string } | null>;
  insertCodebase(row: {
    projectId: string;
    rootPath: string;
    fileCount: number;
    totalBytes: number;
  }): Promise<{ id: string }>;
  /** A rescan writes new counts onto the existing codebase row so they do not
   * go stale — the codebase's fileCount/totalBytes stay the latest scan's. */
  updateCodebaseCounts(
    codebaseId: string,
    fileCount: number,
    totalBytes: number
  ): Promise<void>;
  insertScan(row: {
    codebaseId: string;
    entries: unknown;
    skipped: unknown;
    errors: unknown;
    analysis: unknown;
  }): Promise<void>;
  replaceTechnologies(
    codebaseId: string,
    rows: { name: string; category: string; confidence: number; evidence: unknown }[]
  ): Promise<void>;
  replaceFeatures(
    codebaseId: string,
    rows: { name: string; confidence: number; evidence: unknown }[]
  ): Promise<void>;
  findLatestScan(projectId: string): Promise<unknown | null>;
};

export type CodebaseActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

const DENIED = {
  ok: false,
  message: "You do not have permission to do that.",
} as const;

export function createCodebaseService(db: CodebaseDb) {
  async function memberCan(
    workspaceId: string,
    userId: string,
    capability: WorkspaceCapability
  ): Promise<boolean> {
    const membershipRow = await db.findWorkspaceMembership(workspaceId, userId);
    if (!membershipRow) return false;
    return can(membershipRow.role as WorkspaceRole, capability);
  }

  async function saveAnalysis(
    input: SaveAnalysisInput,
    userId: string
  ): Promise<CodebaseActionResult<{ codebaseId: string }>> {
    const project = await db.findProject(input.projectId);
    if (!project) return { ok: false, message: "Project not found." };
    if (project.deletedAt) {
      return { ok: false, message: "Project already deleted." };
    }

    const workspace = await db.findProjectWorkspace(input.projectId);
    if (!workspace) return { ok: false, message: "Project not found." };
    if (!(await memberCan(workspace.workspaceId, userId, "project:update"))) {
      return DENIED;
    }

    const fileCount = input.indexed.length;
    const totalBytes = input.indexed.reduce((sum, file) => sum + file.size, 0);

    let codebase = await db.findCodebase(input.projectId);
    if (!codebase) {
      codebase = await db.insertCodebase({
        projectId: input.projectId,
        rootPath: input.rootPath,
        fileCount,
        totalBytes,
      });
    } else {
      // M-b: a rescan must not leave the codebase row's counts stale.
      await db.updateCodebaseCounts(codebase.id, fileCount, totalBytes);
    }

    // The scan is a full snapshot: entries, skipped, errors, and the analysis
    // all round-trip through JSONB as plain data.
    await db.insertScan({
      codebaseId: codebase.id,
      entries: input.indexed,
      skipped: input.skipped,
      errors: input.errors,
      analysis: input.analysis,
    });

    // Detection confidence is 0..1 (score() caps at 1); the DB column is an
    // integer, so store it as 0..100. Inserting the raw float would silently
    // round 0.73 to 1 — the BUG-020 defect class.
    await db.replaceTechnologies(
      codebase.id,
      input.analysis.frameworks.map((f) => ({
        name: f.name,
        category: "framework",
        confidence: Math.round(f.confidence * 100),
        evidence: f.evidence ?? [],
      }))
    );
    await db.replaceFeatures(
      codebase.id,
      input.analysis.features.map((f) => ({
        name: f.name,
        confidence: Math.round(f.confidence * 100),
        evidence: f.evidence ?? [],
      }))
    );

    return { ok: true, data: { codebaseId: codebase.id } };
  }

  async function loadLatest(
    projectId: string,
    userId: string
  ): Promise<CodebaseActionResult<unknown | null>> {
    const workspace = await db.findProjectWorkspace(projectId);
    if (!workspace) return { ok: false, message: "Project not found." };
    if (!(await memberCan(workspace.workspaceId, userId, "project:read"))) {
      return DENIED;
    }

    return { ok: true, data: await db.findLatestScan(projectId) };
  }

  return { saveAnalysis, loadLatest };
}

import { describe, expect, it } from "vitest";
import { createCodebaseService } from "./codebase-service";

/**
 * The service's persistence seam is fake-db testable, mirroring the workspace
 * and project services. The fakeDb needs a findProject because the service
 * refuses to save into a missing or soft-deleted project, and the permission
 * seam (findProjectWorkspace + findWorkspaceMembership) because scans are
 * only read/written by members of the project's workspace — the same memberCan
 * pattern the project service uses, so the messages match.
 */

function fakeDb() {
  const codebases: {
    id: string;
    projectId: string;
    rootPath: string;
    fileCount: number;
    totalBytes: number;
  }[] = [];
  const scans: {
    codebaseId: string;
    entries: unknown;
    skipped: unknown;
    errors: unknown;
    analysis: unknown;
  }[] = [];
  const technologies: {
    codebaseId: string;
    name: string;
    category: string;
    confidence: number;
  }[] = [];
  const features: { codebaseId: string; name: string; confidence: number }[] =
    [];
  const projects = new Map<string, { workspaceId: string; deletedAt: string | null }>();
  const memberships = new Map<string, { role: string }>();

  return {
    rows: { codebases, scans, technologies, features },
    db: {
      findProject: async (projectId: string) => {
        const project = projects.get(projectId);
        return project ? { deletedAt: project.deletedAt } : null;
      },
      findProjectWorkspace: async (projectId: string) => {
        const project = projects.get(projectId);
        return project ? { workspaceId: project.workspaceId } : null;
      },
      findWorkspaceMembership: async (workspaceId: string, userId: string) =>
        memberships.get(`${workspaceId}|${userId}`) ?? null,
      findCodebase: async (projectId: string) =>
        codebases.find((c) => c.projectId === projectId) ?? null,
      insertCodebase: async (row: {
        projectId: string;
        rootPath: string;
        fileCount: number;
        totalBytes: number;
      }) => {
        const id = `c-${codebases.length + 1}`;
        codebases.push({ id, ...row });
        return { id };
      },
      updateCodebaseCounts: async (
        codebaseId: string,
        fileCount: number,
        totalBytes: number
      ) => {
        const codebase = codebases.find((c) => c.id === codebaseId);
        if (!codebase) throw new Error("codebase row gone");
        codebase.fileCount = fileCount;
        codebase.totalBytes = totalBytes;
      },
      insertScan: async (row: {
        codebaseId: string;
        entries: unknown;
        skipped: unknown;
        errors: unknown;
        analysis: unknown;
      }) => {
        scans.push(row);
      },
      replaceTechnologies: async (
        codebaseId: string,
        rows: { name: string; category: string; confidence: number; evidence: unknown }[]
      ) => {
        technologies.push(...rows.map((r) => ({ codebaseId, ...r })));
      },
      replaceFeatures: async (
        codebaseId: string,
        rows: { name: string; confidence: number; evidence: unknown }[]
      ) => {
        features.push(...rows.map((r) => ({ codebaseId, ...r })));
      },
      findLatestScan: async (projectId: string) => {
        const codebase = codebases.find((c) => c.projectId === projectId);
        if (!codebase) return null;
        return scans.findLast((s) => s.codebaseId === codebase.id) ?? null;
      },
    },
    seedProject: (
      projectId: string,
      workspaceId = "ws-1",
      deletedAt: string | null = null
    ) => projects.set(projectId, { workspaceId, deletedAt }),
    seedMembership: (workspaceId: string, userId: string, role: string) =>
      memberships.set(`${workspaceId}|${userId}`, { role }),
  };
}

// Shaped like a real ProjectAnalysis; the engine's Detection confidence is
// 0..1 (score() caps at 1), so the fixture uses that scale and the service is
// expected to store it as a 0..100 integer for the DB column.
const analysis = {
  summary: {},
  manifests: [],
  frameworks: [
    {
      id: "next",
      name: "Next.js",
      confidence: 0.73,
      evidence: ["`next` in dependencies"],
    },
  ],
  features: [
    { id: "auth", name: "Authentication", confidence: 0.5, evidence: [] },
  ],
  architecture: {},
  languages: {},
  runtimes: [],
  toolchain: {},
  dependencies: {},
  snapshot: { files: [] },
} as never;

// Most tests exercise the happy path: a member of the project's workspace
// whose role allows writes ("owner" has every capability).
function memberDb() {
  const { db, rows, seedProject, seedMembership } = fakeDb();
  seedProject("p-1");
  seedMembership("ws-1", "u1", "owner");
  return { db, rows, seedProject, seedMembership };
}

describe("createCodebaseService", () => {
  it("rejects a save when the project does not exist", async () => {
    const { db } = fakeDb();
    const service = createCodebaseService(db as never);

    const result = await service.saveAnalysis(
      {
        projectId: "p-missing",
        rootPath: "/home/site",
        indexed: [],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    expect(result).toEqual({ ok: false, message: "Project not found." });
  });

  it("rejects a save when the project is soft-deleted", async () => {
    const { db, seedProject } = fakeDb();
    seedProject("p-1", "ws-1", "2026-08-01T00:00:00.000Z");
    const service = createCodebaseService(db as never);

    const result = await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    expect(result).toEqual({ ok: false, message: "Project already deleted." });
  });

  it("denies a save when the caller is not a workspace member", async () => {
    const { db, seedProject } = fakeDb();
    seedProject("p-1");
    const service = createCodebaseService(db as never);

    const result = await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to do that.",
    });
  });

  it("denies a save when the role cannot update projects", async () => {
    const { db, seedProject, seedMembership } = fakeDb();
    seedProject("p-1");
    seedMembership("ws-1", "u1", "viewer");
    const service = createCodebaseService(db as never);

    const result = await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to do that.",
    });
  });

  it("saves a scan, creating the codebase row on first import", async () => {
    const { db, rows } = memberDb();
    const service = createCodebaseService(db as never);

    const result = await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [{ path: "package.json", size: 100 }],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.codebases).toHaveLength(1);
    expect(rows.codebases[0]).toMatchObject({
      projectId: "p-1",
      rootPath: "/home/site",
      fileCount: 1,
      totalBytes: 100,
    });
    expect(rows.scans).toHaveLength(1);
    expect(rows.scans[0].entries).toEqual([{ path: "package.json", size: 100 }]);
    expect(rows.scans[0].analysis).toBe(analysis);
  });

  it("reuses the codebase row on rescan and refreshes its counts", async () => {
    const { db, rows } = memberDb();
    const service = createCodebaseService(db as never);

    await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [{ path: "package.json", size: 100 }],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );
    await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [{ path: "src/index.ts", size: 50 }],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    expect(rows.codebases).toHaveLength(1);
    // M-b: the rescan updated the counts on the existing row.
    expect(rows.codebases[0]).toMatchObject({ fileCount: 1, totalBytes: 50 });
    expect(rows.scans).toHaveLength(2);
    expect(rows.scans[1].entries).toEqual([{ path: "src/index.ts", size: 50 }]);
  });

  it("persists detected technologies and features from the analysis", async () => {
    const { db, rows } = memberDb();
    const service = createCodebaseService(db as never);

    await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    expect(rows.technologies).toContainEqual({
      codebaseId: "c-1",
      name: "Next.js",
      category: "framework",
      confidence: 73,
      evidence: ["`next` in dependencies"],
    });
    expect(rows.features).toContainEqual({
      codebaseId: "c-1",
      name: "Authentication",
      confidence: 50,
      evidence: [],
    });
  });

  it("returns null when no scan has been saved", async () => {
    const { db } = memberDb();
    const service = createCodebaseService(db as never);

    const result = await service.loadLatest("p-1", "u1");

    expect(result).toEqual({ ok: true, data: null });
  });

  it("denies a load when the caller is not a workspace member", async () => {
    const { db, seedProject } = fakeDb();
    seedProject("p-1");
    const service = createCodebaseService(db as never);

    const result = await service.loadLatest("p-1", "u1");

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to do that.",
    });
  });

  // Every role in the current matrix can read projects (project:read is the
  // viewer baseline), so the load gate can only deny non-members today — it
  // exists to stay correct if a below-viewer role is ever added.
  it("rejects a load when the project does not exist", async () => {
    const { db } = fakeDb();
    const service = createCodebaseService(db as never);

    const result = await service.loadLatest("p-missing", "u1");

    expect(result).toEqual({ ok: false, message: "Project not found." });
  });

  it("loads the latest scan for a member", async () => {
    const { db } = memberDb();
    const service = createCodebaseService(db as never);
    await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [{ path: "package.json", size: 100 }],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    const result = await service.loadLatest("p-1", "u1");

    expect(result.ok).toBe(true);
    expect((result as { data: unknown }).data).not.toBeNull();
  });
});

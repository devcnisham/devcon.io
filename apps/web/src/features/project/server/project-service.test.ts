import { describe, expect, it } from "vitest";
import { createProjectService } from "./project-service";

function fakeDb() {
  const workspaces: { id: string; deletedAt: string | null }[] = [
    { id: "ws-1", deletedAt: null },
  ];
  // Memberships deliberately exist for workspaces that have no row (or whose
  // row is deleted) so the service-level workspace guard can be tested: a
  // membership alone must not let a project into a deleted workspace.
  const memberships = new Map<string, { role: string }>([
    ["ws-1:u1", { role: "owner" }],
    ["ws-missing:u1", { role: "owner" }],
    ["ws-gone:u1", { role: "owner" }],
  ]);
  const projects: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    description: string;
    type: string;
    visibility: string;
    status: string;
    deletedAt: string | null;
  }[] = [];
  return {
    rows: { projects, workspaces },
    db: {
      listProjectSlugs: async (workspaceId: string) =>
        projects
          .filter((p) => p.workspaceId === workspaceId)
          .map((p) => p.slug),
      findWorkspace: async (workspaceId: string) => {
        const w = workspaces.find((x) => x.id === workspaceId);
        return w ? { deletedAt: w.deletedAt } : null;
      },
      findWorkspaceMembership: async (workspaceId: string, userId: string) =>
        memberships.get(`${workspaceId}:${userId}`) ?? null,
      insertProject: async (row: {
        workspaceId: string;
        name: string;
        slug: string;
        description: string;
        type: string;
        visibility: string;
        status: string;
      }) => {
        const id = `p-${projects.length + 1}`;
        projects.push({ id, ...row, deletedAt: null });
        return { id, slug: row.slug };
      },
      updateProject: async (id: string, patch: Record<string, string>) => {
        const p = projects.find((x) => x.id === id);
        if (!p) throw new Error("not found");
        Object.assign(p, patch);
      },
      findProject: async (id: string) =>
        projects.find((p) => p.id === id) ?? null,
    },
  };
}

describe("createProjectService", () => {
  it("creates a project from wizard values", async () => {
    const { db, rows } = fakeDb();
    const service = createProjectService(db as never);

    const result = await service.createProject(
      {
        workspaceId: "ws-1",
        name: "Website",
        description: "Marketing site",
        type: "website",
        visibility: "private",
        status: "active",
      },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.projects[0]).toMatchObject({
      workspaceId: "ws-1",
      name: "Website",
      slug: "website",
    });
  });

  it("derives a unique slug when the workspace already has one", async () => {
    const { db, rows } = fakeDb();
    rows.projects.push({
      id: "p-0",
      workspaceId: "ws-1",
      name: "Website",
      slug: "website",
      description: "",
      type: "website",
      visibility: "private",
      status: "active",
      deletedAt: null,
    });
    const service = createProjectService(db as never);

    const result = await service.createProject(
      {
        workspaceId: "ws-1",
        name: "Website",
        description: "",
        type: "website",
        visibility: "private",
        status: "active",
      },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.projects[1].slug).toBe("website-2");
  });

  it("denies creation outside membership", async () => {
    const { db } = fakeDb();
    const service = createProjectService(db as never);

    const result = await service.createProject(
      { workspaceId: "ws-9", name: "X", description: "", type: "website", visibility: "private", status: "active" },
      "u1"
    );

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to do that.",
    });
  });

  it("denies creation when the workspace does not exist", async () => {
    const { db, rows } = fakeDb();
    const service = createProjectService(db as never);

    // The user holds a membership row, but the workspace itself is gone —
    // membership alone must not admit a project.
    const result = await service.createProject(
      { workspaceId: "ws-missing", name: "X", description: "", type: "website", visibility: "private", status: "active" },
      "u1"
    );

    expect(result).toEqual({ ok: false, message: "Workspace not found." });
    expect(rows.projects).toHaveLength(0);
  });

  it("denies creation when the workspace is soft-deleted", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({
      id: "ws-gone",
      deletedAt: "2026-08-19T00:00:00.000Z",
    });
    const service = createProjectService(db as never);

    const result = await service.createProject(
      { workspaceId: "ws-gone", name: "X", description: "", type: "website", visibility: "private", status: "active" },
      "u1"
    );

    expect(result).toEqual({ ok: false, message: "Workspace already deleted." });
    expect(rows.projects).toHaveLength(0);
  });

  it("updates settings with the validated shape", async () => {
    const { db, rows } = fakeDb();
    rows.projects.push({
      id: "p-1", workspaceId: "ws-1", name: "Website", slug: "website",
      description: "", type: "website", visibility: "private", status: "active",
      deletedAt: null,
    });
    const service = createProjectService(db as never);

    const result = await service.updateProjectSettings(
      {
        projectId: "p-1",
        name: "Website 2",
        description: "Better",
        type: "website",
        visibility: "workspace",
        status: "paused",
      },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.projects[0]).toMatchObject({ name: "Website 2", status: "paused", visibility: "workspace" });
  });

  it("refuses to update a soft-deleted project", async () => {
    const { db, rows } = fakeDb();
    rows.projects.push({
      id: "p-2", workspaceId: "ws-1", name: "Gone", slug: "gone",
      description: "", type: "website", visibility: "private", status: "active",
      deletedAt: "2026-08-19T00:00:00.000Z",
    });
    const service = createProjectService(db as never);

    const result = await service.updateProjectSettings(
      {
        projectId: "p-2",
        name: "Nope",
        description: "",
        type: "website",
        visibility: "private",
        status: "active",
      },
      "u1"
    );

    expect(result).toEqual({ ok: false, message: "Project already deleted." });
    expect(rows.projects[0].name).toBe("Gone");
  });

  it("reads settings for a member of the owning workspace", async () => {
    const { db, rows } = fakeDb();
    rows.projects.push({
      id: "p-3", workspaceId: "ws-1", name: "Website", slug: "website",
      description: "Marketing site", type: "website", visibility: "private", status: "active",
      deletedAt: null,
    });
    const service = createProjectService(db as never);

    const result = await service.getProjectSettings("p-3", "u1");

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Website",
        description: "Marketing site",
        type: "website",
        visibility: "private",
        status: "active",
      },
    });
  });
});

import { describe, expect, it } from "vitest";
import { createWorkspaceService } from "./workspace-service";

function fakeDb() {
  const rows: {
    workspaces: {
      id: string;
      name: string;
      slug: string;
      deletedAt: string | null;
    }[];
    memberships: { workspaceId: string; userId: string; role: string }[];
    events: { kind: string; summary: string }[];
  } = { workspaces: [], memberships: [], events: [] };

  const db = {
    listWorkspaceSlugs: async () => rows.workspaces.map((w) => w.slug),
    findMembership: async (workspaceId: string, userId: string) =>
      rows.memberships.find(
        (m) => m.workspaceId === workspaceId && m.userId === userId
      ) ?? null,
    findWorkspace: async (id: string) => {
      const ws = rows.workspaces.find((w) => w.id === id);
      return ws ? { name: ws.name, deletedAt: ws.deletedAt } : null;
    },
    insertWorkspace: async (row: { name: string; slug: string }) => {
      const id = `ws-${rows.workspaces.length + 1}`;
      rows.workspaces.push({ id, ...row, deletedAt: null });
      return { id, slug: row.slug };
    },
    insertMembership: async (row: { workspaceId: string; userId: string; role: string }) => {
      rows.memberships.push(row);
    },
    insertEvent: async (row: { kind: string; summary: string }) => {
      // The service also passes actorName (and workspaceId); the assertions
      // below only care about kind + summary, so record that subset.
      rows.events.push({ kind: row.kind, summary: row.summary });
    },
    updateWorkspace: async (id: string, patch: { name: string }) => {
      const ws = rows.workspaces.find((w) => w.id === id);
      if (!ws) throw new Error("not found");
      Object.assign(ws, patch);
    },
    softDeleteWorkspace: async (id: string) => {
      const ws = rows.workspaces.find((w) => w.id === id);
      if (!ws) throw new Error("not found");
      ws.deletedAt = new Date().toISOString();
    },
  };

  return { db, rows };
}

describe("createWorkspaceService", () => {
  it("creates a workspace with owner membership and an event", async () => {
    const { db, rows } = fakeDb();
    const service = createWorkspaceService(db as never);

    const result = await service.createWorkspace(
      { name: "Acme", slug: "acme" },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.workspaces).toHaveLength(1);
    expect(rows.workspaces[0]).toMatchObject({ name: "Acme", slug: "acme" });
    expect(rows.memberships).toEqual([
      { workspaceId: "ws-1", userId: "u1", role: "owner" },
    ]);
    expect(rows.events).toEqual([
      { kind: "workspace.created", summary: "Acme was created" },
    ]);
  });

  it("derives a unique slug when the requested one is taken", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({
      id: "ws-x",
      name: "Acme",
      slug: "acme",
      deletedAt: null,
    });
    const service = createWorkspaceService(db as never);

    const result = await service.createWorkspace(
      { name: "Acme", slug: "acme" },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.workspaces[1].slug).toBe("acme-2");
  });

  it("keeps the slugs of soft-deleted workspaces reserved", async () => {
    const { db, rows } = fakeDb();
    // A soft-deleted row lingers and still holds its slug; recreating the
    // workspace must suffix rather than crash on the unique index.
    rows.workspaces.push({
      id: "ws-deleted",
      name: "Acme",
      slug: "acme",
      deletedAt: "2026-08-18T00:00:00.000Z",
    });
    const service = createWorkspaceService(db as never);

    const result = await service.createWorkspace(
      { name: "Acme", slug: "acme" },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.workspaces[1].slug).toBe("acme-2");
  });

  it("honors an edited slug over the name-derived one", async () => {
    const { db, rows } = fakeDb();
    const service = createWorkspaceService(db as never);

    const result = await service.createWorkspace(
      { name: "My Project", slug: "custom-slug" },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.workspaces[0].slug).toBe("custom-slug");
  });

  it("renames only when the caller can update", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({
      id: "ws-1",
      name: "Old",
      slug: "old",
      deletedAt: null,
    });
    rows.memberships.push({ workspaceId: "ws-1", userId: "u2", role: "viewer" });
    const service = createWorkspaceService(db as never);

    const denied = await service.renameWorkspace(
      { workspaceId: "ws-1", name: "New" },
      "u2"
    );
    expect(denied).toEqual({
      ok: false,
      message: "You do not have permission to do that.",
    });

    rows.memberships[0].role = "admin";
    const allowed = await service.renameWorkspace(
      { workspaceId: "ws-1", name: "New" },
      "u2"
    );
    expect(allowed.ok).toBe(true);
    expect(rows.workspaces[0].name).toBe("New");
  });

  it("refuses to rename a workspace that does not exist", async () => {
    const { db, rows } = fakeDb();
    rows.memberships.push({
      workspaceId: "ws-ghost",
      userId: "u1",
      role: "owner",
    });
    const service = createWorkspaceService(db as never);

    const result = await service.renameWorkspace(
      { workspaceId: "ws-ghost", name: "New" },
      "u1"
    );

    expect(result).toEqual({ ok: false, message: "Workspace not found." });
  });

  it("refuses to rename an already-deleted workspace", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({
      id: "ws-1",
      name: "Old",
      slug: "old",
      deletedAt: "2026-08-18T00:00:00.000Z",
    });
    rows.memberships.push({ workspaceId: "ws-1", userId: "u1", role: "owner" });
    const service = createWorkspaceService(db as never);

    const result = await service.renameWorkspace(
      { workspaceId: "ws-1", name: "New" },
      "u1"
    );

    expect(result).toEqual({
      ok: false,
      message: "Workspace already deleted.",
    });
  });

  it("soft-deletes only as owner", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      deletedAt: null,
    });
    rows.memberships.push({ workspaceId: "ws-1", userId: "u1", role: "admin" });
    const service = createWorkspaceService(db as never);

    const denied = await service.deleteWorkspace(
      { workspaceId: "ws-1", confirmation: "Acme" },
      "u1"
    );
    expect(denied.ok).toBe(false);

    rows.memberships[0].role = "owner";
    const allowed = await service.deleteWorkspace(
      { workspaceId: "ws-1", confirmation: "Acme" },
      "u1"
    );
    expect(allowed.ok).toBe(true);
    expect(rows.workspaces[0].deletedAt).not.toBeNull();
    expect(rows.events.at(-1)).toEqual({
      kind: "workspace.deleted",
      summary: "Acme was deleted",
    });
  });

  it("rejects delete when the confirmation does not match the name", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      deletedAt: null,
    });
    rows.memberships.push({ workspaceId: "ws-1", userId: "u1", role: "owner" });
    const service = createWorkspaceService(db as never);

    const result = await service.deleteWorkspace(
      { workspaceId: "ws-1", confirmation: "Acme Inc." },
      "u1"
    );

    expect(result).toEqual({
      ok: false,
      message: "Type the workspace name exactly to confirm",
    });
    expect(rows.workspaces[0].deletedAt).toBeNull();
  });

  it("rejects delete when the workspace is missing or already deleted", async () => {
    const { db, rows } = fakeDb();
    rows.memberships.push({
      workspaceId: "ws-ghost",
      userId: "u1",
      role: "owner",
    });
    rows.workspaces.push({
      id: "ws-1",
      name: "Acme",
      slug: "acme",
      deletedAt: "2026-08-18T00:00:00.000Z",
    });
    rows.memberships.push({ workspaceId: "ws-1", userId: "u1", role: "owner" });
    const service = createWorkspaceService(db as never);

    const missing = await service.deleteWorkspace(
      { workspaceId: "ws-ghost", confirmation: "Acme" },
      "u1"
    );
    expect(missing).toEqual({ ok: false, message: "Workspace not found." });

    const deleted = await service.deleteWorkspace(
      { workspaceId: "ws-1", confirmation: "Acme" },
      "u1"
    );
    expect(deleted).toEqual({
      ok: false,
      message: "Workspace already deleted.",
    });
  });
});

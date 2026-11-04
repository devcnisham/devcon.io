import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/features/database/server";
import { workspaces } from "@/features/database/schema";
import { drizzleWorkspaceDb, findWorkspaceEvents } from "./workspace-store";
import { databaseIsUp } from "./integration-helpers";

/**
 * Discriminating test for BUG-019: listWorkspaceSlugs must keep soft-deleted
 * slugs reserved, because the workspaces_slug_unique index covers deleted
 * rows. This runs against the real local stack (skipped when it is down —
 * ECONNREFUSED from a stopped stack skips the suite instead of failing it).
 * The old service-level test was vacuous — its fake db never filtered deleted
 * rows, so it passed against the pre-fix store too. This test fails against a
 * store that filters isNull(deleted_at).
 */

const dbUp = await databaseIsUp();
const slug = `it-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

describe.skipIf(!dbUp)(
  "workspace-store listWorkspaceSlugs (integration)",
  () => {
    beforeAll(async () => {
      await db
        .insert(workspaces)
        .values({ name: "IT", slug })
        .onConflictDoNothing();
      await db
        .update(workspaces)
        .set({ deletedAt: new Date() })
        .where(eq(workspaces.slug, slug));
    });

    afterAll(async () => {
      await db.delete(workspaces).where(eq(workspaces.slug, slug));
    });

    it("keeps soft-deleted slugs reserved", async () => {
      // Pre-warm check: the row exists and is soft-deleted, so the only way
      // the assertion below passes is if the store query includes deleted rows.
      const rows = await db
        .select({ slug: workspaces.slug, deletedAt: workspaces.deletedAt })
        .from(workspaces)
        .where(eq(workspaces.slug, slug));
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).not.toBeNull();

      const listed = await drizzleWorkspaceDb.listWorkspaceSlugs();
      expect(listed).toContain(slug);
    });
  }
);

/**
 * Discriminating test for the activity feed's read path: findWorkspaceEvents
 * must return only that workspace's events, newest first. Buggy variants —
 * no workspaceId filter (leaks another workspace's events) or ascending order
 * (shows the oldest first) — fail here but pass a hand-written fake.
 */
describe.skipIf(!dbUp)("workspace-store findWorkspaceEvents (integration)", () => {
  let workspaceId = "";

  beforeAll(async () => {
    const ws = await drizzleWorkspaceDb.insertWorkspace({
      name: "IT Events",
      slug: `it-ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    });
    workspaceId = ws.id;
    await drizzleWorkspaceDb.insertEvent({
      workspaceId,
      kind: "workspace.created",
      actorName: "you",
      summary: "IT Events was created",
    });
    await drizzleWorkspaceDb.insertEvent({
      workspaceId,
      kind: "project.created",
      actorName: "you",
      summary: "Alpha was created",
    });
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  });

  it("returns the workspace's events, newest first", async () => {
    const events = await findWorkspaceEvents(workspaceId);
    expect(events).toHaveLength(2);
    // The second insert is the newest, so newest-first means it leads.
    expect(events[0].kind).toBe("project.created");
    expect(events[1].kind).toBe("workspace.created");
    expect(events[0].occurredAt > events[1].occurredAt).toBe(true);
  });

  it("returns nothing for a workspace with no events", async () => {
    const events = await findWorkspaceEvents(
      "00000000-0000-0000-0000-000000000000"
    );
    expect(events).toHaveLength(0);
  });
});

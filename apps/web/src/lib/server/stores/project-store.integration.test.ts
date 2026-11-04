import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/features/database/server";
import { projects, workspaces } from "@/features/database/schema";
import { drizzleProjectDb } from "./project-store";
import { databaseIsUp } from "./integration-helpers";

/**
 * Discriminating test for the BUG-019 defect class (workspace version, Task 8
 * review): listProjectSlugs must keep soft-deleted slugs reserved, because the
 * projects_workspace_slug_unique index covers deleted rows. This runs against
 * the real local stack (skipped when it is down — ECONNREFUSED from a stopped
 * stack skips the suite instead of failing it). A service-level test with a
 * fake db cannot discriminate here — the fake never filters deleted rows, so
 * it passes against a store that filters isNull(deleted_at) too. This test
 * fails against such a store.
 */

const dbUp = await databaseIsUp();
const slug = `it-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const wsSlug = `it-ws-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

describe.skipIf(!dbUp)(
  "project-store listProjectSlugs (integration)",
  () => {
    let workspaceId: string;

    beforeAll(async () => {
      const [ws] = await db
        .insert(workspaces)
        .values({ name: "IT", slug: wsSlug })
        .returning({ id: workspaces.id });
      workspaceId = ws.id;

      await db
        .insert(projects)
        .values({ workspaceId, name: "IT", slug })
        .onConflictDoNothing();
      await db
        .update(projects)
        .set({ deletedAt: new Date() })
        .where(eq(projects.slug, slug));
    });

    afterAll(async () => {
      await db.delete(projects).where(eq(projects.slug, slug));
      await db.delete(workspaces).where(eq(workspaces.slug, wsSlug));
    });

    it("keeps soft-deleted slugs reserved", async () => {
      // Pre-warm check: the row exists and is soft-deleted, so the only way
      // the assertion below passes is if the store query includes deleted rows.
      const rows = await db
        .select({ slug: projects.slug, deletedAt: projects.deletedAt })
        .from(projects)
        .where(eq(projects.slug, slug));
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).not.toBeNull();

      const listed = await drizzleProjectDb.listProjectSlugs(workspaceId);
      expect(listed).toContain(slug);
    });
  }
);

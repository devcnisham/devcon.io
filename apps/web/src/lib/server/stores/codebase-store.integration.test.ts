import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/features/database/server";
import { codebaseScans, projects, workspaces } from "@/features/database/schema";
import { drizzleWorkspaceDb } from "./workspace-store";
import { drizzleProjectDb } from "./project-store";
import { drizzleCodebaseDb } from "./codebase-store";
import { databaseIsUp } from "./integration-helpers";

/**
 * Discriminating test for findLatestScan: the store must return the newest
 * scan of the project's own codebase. Two buggy variants exist — ordering by
 * scannedAt ascending (returns the oldest scan) and dropping the codebaseId
 * filter (returns another project's scan). A service-level fake-db test
 * cannot catch either, because the fake's findLatestScan is written by hand;
 * this runs against the real local stack (skipped when it is down —
 * ECONNREFUSED from a stopped stack skips the suite instead of failing it).
 */

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const workspaceSlug = `it-ws-${suffix}`;

let workspaceId = "";
let projectAId = "";
let projectBId = "";
let codebaseAId = "";
let codebaseBId = "";

async function insertScan(codebaseId: string, marker: string, at: string) {
  await db.insert(codebaseScans).values({
    codebaseId,
    scannedAt: new Date(at),
    entries: [{ path: "package.json", size: 1 }],
    skipped: [],
    errors: [],
    analysis: { marker },
  });
}

const dbUp = await databaseIsUp();

describe.skipIf(!dbUp)(
  "codebase-store findLatestScan (integration)",
  () => {
    beforeAll(async () => {
      const workspace = await drizzleWorkspaceDb.insertWorkspace({
        name: "IT",
        slug: workspaceSlug,
      });
      workspaceId = workspace.id;

      const projectA = await drizzleProjectDb.insertProject({
        workspaceId,
        name: "Alpha",
        slug: `alpha-${suffix}`,
        description: "",
        type: "web",
        visibility: "private",
        status: "active",
      });
      projectAId = projectA.id;

      const projectB = await drizzleProjectDb.insertProject({
        workspaceId,
        name: "Beta",
        slug: `beta-${suffix}`,
        description: "",
        type: "web",
        visibility: "private",
        status: "active",
      });
      projectBId = projectB.id;

      const codebaseA = await drizzleCodebaseDb.insertCodebase({
        projectId: projectAId,
        rootPath: "/alpha",
        fileCount: 1,
        totalBytes: 1,
      });
      codebaseAId = codebaseA.id;

      const codebaseB = await drizzleCodebaseDb.insertCodebase({
        projectId: projectBId,
        rootPath: "/beta",
        fileCount: 1,
        totalBytes: 1,
      });
      codebaseBId = codebaseB.id;

      // Project A's codebase gets two scans; project B's gets a third that is
      // the newest overall. Both buggy filters are therefore exposed: "oldest
      // wins" returns marker "first", "any codebase" returns marker "other".
      await insertScan(codebaseAId, "first", "2026-01-01T00:00:00Z");
      await insertScan(codebaseBId, "other", "2026-01-03T00:00:00Z");
      await insertScan(codebaseAId, "second", "2026-01-02T00:00:00Z");
    });

    afterAll(async () => {
      await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    });

    it("returns the newest scan of the project's own codebase", async () => {
      const latest = (await drizzleCodebaseDb.findLatestScan(projectAId)) as {
        analysis: { marker: string };
      } | null;
      expect(latest).not.toBeNull();
      expect(latest?.analysis).toEqual({ marker: "second" });
    });

    it("never leaks another project's scan", async () => {
      const latest = (await drizzleCodebaseDb.findLatestScan(projectBId)) as {
        analysis: { marker: string };
      } | null;
      expect(latest?.analysis).toEqual({ marker: "other" });
    });

    it("returns null for a project with no codebase", async () => {
      const latest = await drizzleCodebaseDb.findLatestScan(
        "00000000-0000-0000-0000-000000000000"
      );
      expect(latest).toBeNull();
    });

    // Self-contained: seeds its own project, codebase, and scan, so it never
    // mutates (or depends on the order of) the shared fixtures. The rows are
    // cleaned up by the workspace cascade in afterAll. Against a store that
    // skips the deletedAt filter, this returns the seeded marker and fails.
    it("returns null for a soft-deleted project", async () => {
      const project = await drizzleProjectDb.insertProject({
        workspaceId,
        name: "Gone",
        slug: `gone-${suffix}`,
        description: "",
        type: "web",
        visibility: "private",
        status: "active",
      });
      const codebase = await drizzleCodebaseDb.insertCodebase({
        projectId: project.id,
        rootPath: "/gone",
        fileCount: 1,
        totalBytes: 1,
      });
      await insertScan(codebase.id, "doomed", "2026-01-04T00:00:00Z");

      await db
        .update(projects)
        .set({ deletedAt: new Date() })
        .where(eq(projects.id, project.id));

      const latest = await drizzleCodebaseDb.findLatestScan(project.id);
      expect(latest).toBeNull();
    });
  }
);

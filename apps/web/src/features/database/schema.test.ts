import { describe, expect, it } from "vitest";
import {
  codebaseScans,
  codebases,
  detectedFeatures,
  detectedTechnologies,
  projectIntegrations,
  projectMembers,
  projects,
  users,
  workspaceActivities,
  workspaceMembers,
  workspaces,
} from "./schema";

describe("wave 1 schema", () => {
  it("exposes all wave 1 tables", () => {
    for (const table of [
      users,
      workspaces,
      workspaceMembers,
      workspaceActivities,
      projects,
      projectMembers,
      projectIntegrations,
    ]) {
      expect(table).toBeDefined();
    }
  });

  it("soft-deletes only owner-owned tables", () => {
    expect(Object.keys(workspaces).length > 0).toBe(true);
    // deleted_at must exist on workspaces and projects, nowhere else.
    const hasDeletedAt = (t: object, col: string) =>
      Object.hasOwn(Object.values(t).find((v) => v?.name === col) ?? {}, "name");
    expect(hasDeletedAt(workspaces, "deleted_at")).toBe(true);
    expect(hasDeletedAt(projects, "deleted_at")).toBe(true);
    expect(hasDeletedAt(users, "deleted_at")).toBe(false);
  });
});

describe("wave 2 schema", () => {
  it("exposes all four wave 2 tables", () => {
    for (const table of [
      codebases,
      codebaseScans,
      detectedTechnologies,
      detectedFeatures,
    ]) {
      expect(table).toBeDefined();
    }
  });
});

import "server-only";

import {
  can,
  type WorkspaceCapability,
  type WorkspaceRole,
} from "@/features/workspace/lib/permissions";
import { uniqueSlug } from "@/features/workspace/lib/slug";
import type {
  ProjectStatus,
  ProjectType,
  ProjectVisibility,
} from "@/features/project/lib/wizard";

/**
 * The persistence seam for projects. The database feature's Drizzle
 * implementation lives in src/lib/server/stores/ (app glue), so this module
 * stays feature-local and fake-db testable.
 */

export type ProjectDb = {
  listProjectSlugs(workspaceId: string): Promise<string[]>;
  findWorkspace(
    workspaceId: string
  ): Promise<{ deletedAt: string | null } | null>;
  findWorkspaceMembership(
    workspaceId: string,
    userId: string
  ): Promise<{ role: string } | null>;
  insertProject(row: {
    workspaceId: string;
    name: string;
    slug: string;
    description: string;
    type: string;
    visibility: string;
    status: string;
  }): Promise<{ id: string; slug: string }>;
  updateProject(id: string, patch: ProjectSettingsPatch): Promise<void>;
  findProject(id: string): Promise<{
    workspaceId: string;
    deletedAt: string | null;
    name: string;
    description: string;
    type: string | null;
    visibility: string;
    status: string;
  } | null>;
};

export type ProjectActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

const DENIED = {
  ok: false,
  message: "You do not have permission to do that.",
} as const;

export type CreateProjectInput = {
  workspaceId: string;
  name: string;
  description: string;
  type: string;
  visibility: string;
  status: string;
};

/**
 * The editable settings shape. Every write is validated by
 * `projectSettingsSchema`, so the DB's string columns hold enum members.
 */
export type ProjectSettingsPatch = {
  name: string;
  description: string;
  type: ProjectType;
  visibility: ProjectVisibility;
  status: ProjectStatus;
};

export function createProjectService(db: ProjectDb) {
  async function memberCan(
    workspaceId: string,
    userId: string,
    capability: WorkspaceCapability
  ): Promise<boolean> {
    const membershipRow = await db.findWorkspaceMembership(workspaceId, userId);
    if (!membershipRow) return false;
    return can(membershipRow.role as WorkspaceRole, capability);
  }

  async function createProject(
    input: CreateProjectInput,
    userId: string
  ): Promise<ProjectActionResult<{ id: string; slug: string }>> {
    if (!(await memberCan(input.workspaceId, userId, "project:create"))) {
      return DENIED;
    }

    // A membership row survives a soft delete, so membership alone is not
    // enough — a deleted workspace must never receive new projects. (The
    // workspace UI already routes around deleted workspaces, but the action
    // is the enforcement point.)
    const workspace = await db.findWorkspace(input.workspaceId);
    if (!workspace) return { ok: false, message: "Workspace not found." };
    if (workspace.deletedAt) {
      return { ok: false, message: "Workspace already deleted." };
    }

    const taken = new Set(await db.listProjectSlugs(input.workspaceId));
    const slug = uniqueSlug(input.name, taken);

    const project = await db.insertProject({ ...input, slug });
    return { ok: true, data: { id: project.id, slug: project.slug } };
  }

  async function updateProjectSettings(
    input: { projectId: string } & ProjectSettingsPatch,
    userId: string
  ): Promise<ProjectActionResult> {
    const project = await db.findProject(input.projectId);
    if (!project) return { ok: false, message: "Project not found." };
    if (project.deletedAt) {
      return { ok: false, message: "Project already deleted." };
    }
    if (!(await memberCan(project.workspaceId, userId, "project:update"))) {
      return DENIED;
    }

    const { projectId, ...patch } = input;
    await db.updateProject(projectId, patch);
    return { ok: true };
  }

  async function getProjectSettings(
    projectId: string,
    userId: string
  ): Promise<ProjectActionResult<ProjectSettingsPatch>> {
    const project = await db.findProject(projectId);
    if (!project) return { ok: false, message: "Project not found." };
    if (project.deletedAt) {
      return { ok: false, message: "Project already deleted." };
    }
    if (!(await memberCan(project.workspaceId, userId, "project:read"))) {
      return DENIED;
    }

    return {
      ok: true,
      data: {
        name: project.name,
        description: project.description,
        type: project.type as ProjectType,
        visibility: project.visibility as ProjectVisibility,
        status: project.status as ProjectStatus,
      },
    };
  }

  return { createProject, updateProjectSettings, getProjectSettings };
}

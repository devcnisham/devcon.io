import type {
  ProjectStatus,
  ProjectType,
  ProjectVisibility,
} from "./lib/wizard";

/** Types owned by the project feature. Nothing persists these yet. */

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  type: ProjectType;
  technologies: string[];
  repository: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  createdAt: string;
};

export const PROJECT_STATUSES = ["active", "paused", "archived"] as const;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  private: "Private",
  workspace: "Workspace",
};

import type { WorkspaceRole } from "./lib/permissions";

/**
 * Types owned by the workspace feature.
 *
 * Nothing persists these yet — they describe the shapes the UI renders against
 * so the storage layer can satisfy them without reshaping components.
 */

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type WorkspaceMembership = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
};

export type ActivityKind =
  | "workspace.created"
  | "workspace.renamed"
  | "workspace.deleted"
  | "project.created"
  | "project.deleted"
  | "member.joined";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  actorName: string;
  summary: string;
  occurredAt: string;
};

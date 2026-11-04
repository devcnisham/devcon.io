/**
 * Public surface of the workspace feature.
 *
 * Phase 0.3: validation, slug rules, and the permission model are complete and
 * tested; the UI renders every state. Nothing persists — workspace storage
 * waits on the database (blocker B1).
 */

export { CreateWorkspaceForm } from "./components/create-workspace-form";
export { RenameWorkspaceForm } from "./components/rename-workspace-form";
export { DeleteWorkspace } from "./components/delete-workspace";
export { ActivityFeed } from "./components/activity-feed";

export { toSlug, uniqueSlug, isReservedSlug, RESERVED_SLUGS } from "./lib/slug";
export {
  can,
  isAtLeast,
  WORKSPACE_ROLES,
  type WorkspaceRole,
  type WorkspaceCapability,
} from "./lib/permissions";
export {
  createWorkspaceSchema,
  renameWorkspaceSchema,
  deleteWorkspaceSchema,
  workspaceNameSchema,
  workspaceSlugSchema,
  type CreateWorkspaceValues,
  type RenameWorkspaceValues,
} from "./lib/schemas";

export type {
  Workspace,
  WorkspaceMembership,
  ActivityEvent,
  ActivityKind,
} from "./types";

/**
 * Workspace roles and what each may do.
 *
 * Pure and data-driven so the same rule can run in a server action now and be
 * translated into a Row Level Security policy later. If these two ever
 * disagree, the database wins and the app has a hole — so keep the table below
 * as the single statement of intent.
 *
 * Roles are strictly nested: every role can do everything the role beneath it
 * can, plus more. A test asserts that containment holds, so adding a
 * capability to a lower role without granting it upward fails the suite.
 */

export const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export type WorkspaceCapability =
  | "workspace:read"
  | "workspace:update"
  | "workspace:delete"
  | "workspace:transfer"
  | "project:read"
  | "project:create"
  | "project:update"
  | "project:delete"
  | "member:read"
  | "member:invite"
  | "member:remove"
  | "activity:read"
  | "billing:manage";

/** Capabilities each role adds on top of the role below it. */
const GRANTS: Record<WorkspaceRole, readonly WorkspaceCapability[]> = {
  viewer: ["workspace:read", "project:read", "member:read", "activity:read"],
  member: ["project:create", "project:update"],
  admin: [
    "workspace:update",
    "project:delete",
    "member:invite",
    "member:remove",
  ],
  // Owner-only: destroying or handing over the workspace, and money.
  owner: ["workspace:delete", "workspace:transfer", "billing:manage"],
};

/** Role rank — lower index means more authority. */
function rank(role: WorkspaceRole): number {
  return WORKSPACE_ROLES.indexOf(role);
}

export function isAtLeast(
  role: WorkspaceRole,
  minimum: WorkspaceRole
): boolean {
  const roleRank = rank(role);
  const minimumRank = rank(minimum);
  if (roleRank < 0 || minimumRank < 0) return false;

  return roleRank <= minimumRank;
}

/**
 * Resolves the full capability set for a role by walking down the hierarchy
 * and unioning every grant at or below it.
 */
function capabilitiesFor(role: WorkspaceRole): Set<WorkspaceCapability> {
  const roleRank = rank(role);
  const resolved = new Set<WorkspaceCapability>();

  if (roleRank < 0) return resolved;

  for (let i = roleRank; i < WORKSPACE_ROLES.length; i++) {
    for (const capability of GRANTS[WORKSPACE_ROLES[i]]) {
      resolved.add(capability);
    }
  }

  return resolved;
}

/** Unknown roles and unknown capabilities both deny. */
export function can(
  role: WorkspaceRole,
  capability: WorkspaceCapability
): boolean {
  return capabilitiesFor(role).has(capability);
}

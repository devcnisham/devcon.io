import type { ModuleId, RegistryEntry } from "./types";

/**
 * The REST surface, defined once as types.
 *
 * There is no database and no auth, so the routes that exist are dev-only and
 * back onto the in-memory store — the same guard as `/api/scan`, for the same
 * reason: an unauthenticated write endpoint on a deployed host is not an API,
 * it's a defacement waiting to happen.
 *
 * Defining the contract here rather than inline in the handlers means the
 * client, the CLI and the eventual server all agree on one shape, and swapping
 * the in-memory store for a real one changes no caller.
 *
 * The paths follow the spec:
 *
 *   GET    /api/projects/:project/:module
 *   POST   /api/projects/:project/:module
 *   PATCH  /api/projects/:project/:module/:id
 *   DELETE /api/projects/:project/:module/:id
 *   POST   /api/projects/:project/scan
 *   POST   /api/projects/:project/sync
 *
 * `:module` is in the path rather than `features` being hardcoded, so the API
 * gains APIs/routes/models the same day the module does.
 */

export interface ListResponse<T extends RegistryEntry = RegistryEntry> {
  entries: T[];
  /** Server's view, so a client can tell whether it is behind. */
  cursor: string;
  counts: {
    total: number;
    byStatus: Record<string, number>;
    byOrigin: Record<string, number>;
  };
}

export interface WriteResponse<T extends RegistryEntry = RegistryEntry> {
  entry: T;
}

export interface ScanResponse {
  found: number;
  created: number;
  updated: number;
  warnings: string[];
}

export interface SyncResponse {
  pulled: number;
  pushed: number;
  conflicts: number;
  pending: number;
  errors: string[];
}

export interface ApiError {
  error: string;
  hint?: string;
}

export function isApiError(v: unknown): v is ApiError {
  return typeof v === "object" && v !== null && "error" in v;
}

export const registryPath = {
  list: (project: string, module: ModuleId) =>
    `/api/projects/${encodeURIComponent(project)}/${module}`,
  entry: (project: string, module: ModuleId, id: string) =>
    `/api/projects/${encodeURIComponent(project)}/${module}/${encodeURIComponent(id)}`,
  scan: (project: string) => `/api/projects/${encodeURIComponent(project)}/scan`,
  sync: (project: string) => `/api/projects/${encodeURIComponent(project)}/sync`,
};

/** Aggregates the dashboard needs. Computed server-side so a big list isn't shipped to count it. */
export function summarise<T extends RegistryEntry & { status?: string }>(
  entries: T[],
): ListResponse<T>["counts"] {
  const byStatus: Record<string, number> = {};
  const byOrigin: Record<string, number> = {};
  for (const e of entries) {
    if (e.status) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    byOrigin[e.origin] = (byOrigin[e.origin] ?? 0) + 1;
  }
  return { total: entries.length, byStatus, byOrigin };
}

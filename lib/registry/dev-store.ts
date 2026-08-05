import { featureModule } from "./modules/feature";
import { MemoryRegistryStore } from "./store";

/**
 * The store the dev-only API routes share.
 *
 * A module-level singleton, because each route file importing `new
 * MemoryRegistryStore()` would give the collection route and the item route
 * separate state — a POST followed by a PATCH would 404, and the API would
 * look broken in a way that has nothing to do with the API.
 *
 * In development Next.js re-evaluates modules on change, so this is pinned to
 * globalThis. Without it every save wipes whatever the CLI just wrote.
 */
const KEY = Symbol.for("devcon.registry.devStore");

type Global = typeof globalThis & { [KEY]?: MemoryRegistryStore };

export const devStore: MemoryRegistryStore =
  (globalThis as Global)[KEY] ?? new MemoryRegistryStore();

(globalThis as Global)[KEY] = devStore;

/**
 * Modules the API serves. Adding a module here gives it the whole REST surface
 * — that is the check on whether the abstraction actually holds.
 */
export const API_MODULES = { feature: featureModule } as const;

export function moduleFor(id: string) {
  return API_MODULES[id as keyof typeof API_MODULES] ?? null;
}

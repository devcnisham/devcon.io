import { type Feature, featureModule } from "./modules/feature";
import type { ModuleId, RegistryEntry } from "./types";

/**
 * The SDK — registration method 1.
 *
 *     feature({ id: "authentication", name: "Authentication", status: "completed" })
 *
 * Two things it must be, which pull against each other:
 *
 * 1. Safe to leave in production code. It runs at import time in the user's
 *    app. So it does no I/O, throws nothing, and touches no global the host
 *    application could notice. The worst case for a malformed call is that the
 *    entry is skipped.
 * 2. Readable by the CLI, which imports the user's modules and then asks what
 *    was registered. Hence the module-level collector.
 *
 * It is deliberately NOT a decorator or a build plugin. Both would mean the
 * registration only works under a particular toolchain, and this has to work in
 * a plain Node script, in Next.js, and in a browser bundle alike.
 */

const collected = new Map<ModuleId, Map<string, RegistryEntry>>();

function put(entry: RegistryEntry): void {
  let forModule = collected.get(entry.module);
  if (!forModule) {
    forModule = new Map();
    collected.set(entry.module, forModule);
  }
  // Last call wins for a given id. Re-importing a module in a watch process
  // must not produce two of everything.
  forModule.set(entry.id, entry);
}

export interface FeatureInput {
  name: string;
  id?: string;
  description?: string;
  status?: Feature["status"];
  category?: string;
  version?: string;
  owner?: string;
  priority?: Feature["priority"];
  tags?: string[];
  dependsOn?: string[];
  notes?: string;
}

/**
 * Register a feature.
 *
 * Returns the hydrated entry so a caller can assert on it in a test, and
 * returns null rather than throwing when the input is unusable — a broken
 * annotation must never take down the application it is annotating.
 */
export function feature(input: FeatureInput): Feature | null {
  if (!input || typeof input.name !== "string" || !input.name.trim()) {
    return null;
  }
  const entry = featureModule.hydrate({ ...input, origin: "declared" });
  if (featureModule.validate(entry).length) return null;
  put(entry);
  return entry;
}

/** Everything registered so far, for one module. */
export function registered<T extends RegistryEntry = RegistryEntry>(
  module: ModuleId,
): T[] {
  return [...(collected.get(module)?.values() ?? [])] as T[];
}

/** Every module's registrations, for the CLI to serialise in one pass. */
export function allRegistered(): RegistryEntry[] {
  return [...collected.values()].flatMap((m) => [...m.values()]);
}

/** Test and CLI hook. Not for application code. */
export function resetRegistrations(): void {
  collected.clear();
}

import { type Feature, featureModule } from "./modules/feature";
import { runQuery } from "./query";
import { detectorInputFrom, scanRegistry } from "./scan";
import type { RegistryStore } from "./store";
import { EMPTY_QUERY } from "./query";
import type { FileSource } from "@/lib/scan/source";
import { buildDigest } from "@/lib/scan/digest";

/**
 * The CLI's behaviour, separated from its shell.
 *
 * `bin/devcon.mjs` does argv parsing and printing; everything it decides lives
 * here, where it can be tested without spawning a process. That split is why
 * the commands below take a store and a source rather than reading
 * `process.argv` and touching the filesystem themselves.
 */

export interface CommandResult {
  ok: boolean;
  lines: string[];
}

const ok = (...lines: string[]): CommandResult => ({ ok: true, lines });
const fail = (...lines: string[]): CommandResult => ({ ok: false, lines });

/** `devcon scan` — read the project and write what it finds. */
export async function cmdScan(
  store: RegistryStore,
  project: string,
  source: FileSource,
): Promise<CommandResult> {
  const digest = await buildDigest(source);
  const result = await scanRegistry(source, detectorInputFrom(digest));

  const existing = await store.list<Feature>(project, "feature");
  const reviewed = new Map(
    existing
      .filter((e) => e.origin === "detected" && e.review !== "suggested")
      .map((e) => [e.id, e]),
  );
  const manual = new Set(
    existing.filter((e) => e.origin === "manual").map((e) => e.id),
  );

  const toWrite = result.entries
    .filter((e) => !manual.has(e.id))
    .map((e) => {
      const prior = reviewed.get(e.id);
      return prior ? { ...e, review: prior.review, revision: prior.revision } : e;
    });

  const before = new Set(existing.map((e) => e.id));
  await store.putMany(project, toWrite, "cli");

  const created = toWrite.filter((e) => !before.has(e.id)).length;
  const lines = [
    `Scanned ${source.label}`,
    `  ${result.entries.length} features (${result.stats.declared} declared, ${result.stats.annotated} annotated, ${result.stats.detected} detected)`,
    `  ${created} new, ${toWrite.length - created} already known`,
    `  read ${result.stats.filesRead} files`,
  ];
  if (manual.size) lines.push(`  ${manual.size} manual entries left untouched`);
  for (const w of result.warnings.slice(0, 5)) lines.push(`  warning: ${w}`);
  return ok(...lines);
}

/** `devcon feature list` */
export async function cmdList(
  store: RegistryStore,
  project: string,
  filter?: string,
): Promise<CommandResult> {
  const all = await store.list<Feature>(project, "feature");
  const entries = runQuery(
    all,
    { ...EMPTY_QUERY, text: filter ?? "", sort: "name", direction: "asc" },
    featureModule.statuses,
  );
  if (!entries.length) {
    return ok("No features. Run `devcon scan` to find them.");
  }
  const width = Math.max(...entries.map((e) => e.name.length));
  return ok(
    ...entries.map(
      (e) =>
        `${e.name.padEnd(width)}  ${e.status.padEnd(10)} ${e.origin === "detected" ? (e.review ?? "") : e.origin}`,
    ),
  );
}

/** `devcon feature add <name> [--status s] [--category c] ... ` */
export async function cmdAdd(
  store: RegistryStore,
  project: string,
  input: { name: string } & Partial<Feature>,
): Promise<CommandResult> {
  if (!input.name?.trim()) return fail("A name is required.");
  // Anything typed by a person is `manual`, which no scan may overwrite.
  const entry = featureModule.hydrate({ ...input, origin: "manual" });
  const problems = featureModule.validate(entry);
  if (problems.length) return fail(...problems.map((p) => `invalid: ${p}`));

  const existing = await store.get<Feature>(project, "feature", entry.id);
  if (existing) {
    return fail(
      `"${entry.id}" already exists (${existing.status}). Use \`feature update\` to change it.`,
    );
  }
  await store.put(project, entry, "cli");
  return ok(`Added ${entry.name} (${entry.id}) — ${entry.status}`);
}

/** `devcon feature update <id> --status ...` */
export async function cmdUpdate(
  store: RegistryStore,
  project: string,
  id: string,
  patch: Partial<Feature>,
): Promise<CommandResult> {
  const existing = await store.get<Feature>(project, "feature", id);
  if (!existing) return fail(`No feature "${id}".`);

  // id and module are identity. Changing either would move the entry rather
  // than edit it, and orphan its history.
  const { id: _i, module: _m, revision: _r, ...safe } = patch;
  const merged = { ...existing, ...safe } as Feature;
  const problems = featureModule.validate(merged);
  if (problems.length) return fail(...problems.map((p) => `invalid: ${p}`));

  const stored = await store.put(project, merged, "cli");
  return ok(`Updated ${stored.name} → ${stored.status} (revision ${stored.revision})`);
}

/** `devcon feature remove <id>` */
export async function cmdRemove(
  store: RegistryStore,
  project: string,
  id: string,
): Promise<CommandResult> {
  const existing = await store.get<Feature>(project, "feature", id);
  if (!existing) return fail(`No feature "${id}".`);
  await store.remove(project, "feature", id, "cli");
  return ok(`Removed ${existing.name}.`);
}

/**
 * `devcon doctor` — report what's wrong with the registry itself.
 *
 * Deliberately opinionated. A doctor command that only ever says "everything is
 * fine" is decoration; these are the states that actually cause confusion
 * later, and each one names the fix.
 */
export async function cmdDoctor(
  store: RegistryStore,
  project: string,
): Promise<CommandResult> {
  const entries = await store.list<Feature>(project, "feature");
  const problems: string[] = [];

  if (!entries.length) {
    return ok("No features registered. Run `devcon scan`.");
  }

  const ids = new Set(entries.map((e) => e.id));
  for (const e of entries) {
    for (const p of featureModule.validate(e)) problems.push(`${e.id}: ${p}`);
    for (const dep of e.dependsOn) {
      if (!ids.has(dep)) {
        problems.push(`${e.id}: depends on "${dep}", which is not registered`);
      }
    }
  }

  const suggested = entries.filter(
    (e) => e.origin === "detected" && e.review === "suggested",
  );
  if (suggested.length) {
    problems.push(
      `${suggested.length} suggestion${suggested.length === 1 ? "" : "s"} awaiting review: ${suggested.map((e) => e.id).join(", ")}`,
    );
  }

  const unowned = entries.filter((e) => !e.owner && e.status !== "deprecated");
  if (unowned.length) {
    problems.push(`${unowned.length} features have no owner`);
  }

  const stale = entries.filter(
    (e) => e.status === "building" && ageInDays(e.updatedAt) > 30,
  );
  if (stale.length) {
    problems.push(
      `${stale.length} stuck in "building" for over 30 days: ${stale.map((e) => e.id).join(", ")}`,
    );
  }

  // A cycle makes the dependency graph unrenderable and usually means two
  // features are really one.
  for (const cycle of findCycles(entries)) {
    problems.push(`dependency cycle: ${cycle.join(" → ")}`);
  }

  if (!problems.length) {
    return ok(`${entries.length} features, nothing wrong.`);
  }
  return fail(`${problems.length} issue${problems.length === 1 ? "" : "s"}:`, ...problems.map((p) => `  ${p}`));
}

function ageInDays(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : (Date.now() - t) / 86_400_000;
}

/** Depth-first cycle detection over `dependsOn`. */
export function findCycles(entries: Feature[]): string[][] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const state = new Map<string, "visiting" | "done">();
  const cycles: string[][] = [];

  const visit = (id: string, trail: string[]): void => {
    const s = state.get(id);
    if (s === "done") return;
    if (s === "visiting") {
      cycles.push([...trail.slice(trail.indexOf(id)), id]);
      return;
    }
    state.set(id, "visiting");
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (byId.has(dep)) visit(dep, [...trail, id]);
    }
    state.set(id, "done");
  };

  for (const e of entries) visit(e.id, []);
  return cycles;
}

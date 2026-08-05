import {
  type ModuleId,
  type RegistryEntry,
  type RegistryEvent,
  nowIso,
} from "./types";

/**
 * Persistence for the registry.
 *
 * An interface first, because there is no backend yet and there will be one.
 * Every caller — the UI, the sync engine, the CLI — depends on `RegistryStore`
 * and never on localStorage, so the day a real database exists it is one new
 * implementation of this file and nothing else changes.
 *
 * The methods are deliberately coarse. A chattier interface (get, set, one at a
 * time) would be fine over localStorage and terrible over a network, and the
 * interface has to be shaped for the harder case.
 */
export interface RegistryStore {
  list<T extends RegistryEntry>(project: string, module: ModuleId): Promise<T[]>;
  get<T extends RegistryEntry>(
    project: string,
    module: ModuleId,
    id: string,
  ): Promise<T | null>;
  /** Insert or update. Returns the stored entry, with its revision bumped. */
  put<T extends RegistryEntry>(project: string, entry: T, actor: string): Promise<T>;
  /** Bulk, so a scan is one write rather than N. */
  putMany<T extends RegistryEntry>(
    project: string,
    entries: T[],
    actor: string,
  ): Promise<T[]>;
  remove(project: string, module: ModuleId, id: string, actor: string): Promise<void>;
  history(project: string, module: ModuleId, entryId?: string): Promise<RegistryEvent[]>;
  /** Every project id that has anything stored. */
  projects(): Promise<string[]>;
}

const KEY = (project: string, module: ModuleId) => `devcon:registry:${project}:${module}`;
const HISTORY_KEY = (project: string, module: ModuleId) =>
  `devcon:registry:${project}:${module}:history`;
const INDEX_KEY = "devcon:registry:projects";

/** History is unbounded in principle and a quota error in practice. */
const MAX_HISTORY = 500;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota. Losing a write is recoverable; taking
    // down the dashboard is not.
  }
}

/** What actually changed, so history records a diff rather than a snapshot. */
function diff(
  before: RegistryEntry,
  after: RegistryEntry,
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    // Not real changes: one is derived, the other is the thing being set.
    if (k === "updatedAt" || k === "revision") continue;
    const a = (before as unknown as Record<string, unknown>)[k];
    const b = (after as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[k] = [a, b];
  }
  return changes;
}

export class LocalRegistryStore implements RegistryStore {
  private id = 0;

  private nextEventId(): string {
    this.id += 1;
    return `ev-${this.id}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private appendEvents(
    project: string,
    module: ModuleId,
    events: RegistryEvent[],
  ): void {
    if (!events.length) return;
    const key = HISTORY_KEY(project, module);
    const existing = readJson<RegistryEvent[]>(key, []);
    // Newest first, trimmed. The tail is the part nobody reads.
    writeJson(key, [...events, ...existing].slice(0, MAX_HISTORY));
  }

  private touchIndex(project: string): void {
    const known = readJson<string[]>(INDEX_KEY, []);
    if (!known.includes(project)) writeJson(INDEX_KEY, [...known, project]);
  }

  async projects(): Promise<string[]> {
    return readJson<string[]>(INDEX_KEY, []);
  }

  async list<T extends RegistryEntry>(
    project: string,
    module: ModuleId,
  ): Promise<T[]> {
    return readJson<T[]>(KEY(project, module), []);
  }

  async get<T extends RegistryEntry>(
    project: string,
    module: ModuleId,
    id: string,
  ): Promise<T | null> {
    const all = await this.list<T>(project, module);
    return all.find((e) => e.id === id) ?? null;
  }

  async put<T extends RegistryEntry>(
    project: string,
    entry: T,
    actor: string,
  ): Promise<T> {
    const [stored] = await this.putMany(project, [entry], actor);
    return stored;
  }

  async putMany<T extends RegistryEntry>(
    project: string,
    entries: T[],
    actor: string,
  ): Promise<T[]> {
    if (!entries.length) return [];
    const module = entries[0].module;
    const current = await this.list<T>(project, module);
    const byId = new Map(current.map((e) => [e.id, e]));
    const events: RegistryEvent[] = [];
    const at = nowIso();
    const written: T[] = [];

    for (const entry of entries) {
      const before = byId.get(entry.id);

      if (!before) {
        const created = { ...entry, createdAt: entry.createdAt ?? at, updatedAt: at };
        byId.set(entry.id, created);
        written.push(created);
        events.push({
          id: this.nextEventId(),
          entryId: entry.id,
          module,
          at,
          kind: "created",
          actor,
        });
        continue;
      }

      const changes = diff(before, entry);
      if (!Object.keys(changes).length) {
        // Nothing changed. Writing anyway would bump the revision and make the
        // sync engine think there is work to push on every single scan.
        written.push(before);
        continue;
      }

      const updated = {
        ...entry,
        // createdAt belongs to the entry's first appearance, not this write.
        createdAt: before.createdAt,
        updatedAt: at,
        revision: before.revision + 1,
      };
      byId.set(entry.id, updated);
      written.push(updated);
      events.push({
        id: this.nextEventId(),
        entryId: entry.id,
        module,
        at,
        kind:
          changes.review?.[1] === "accepted"
            ? "accepted"
            : changes.review?.[1] === "dismissed"
              ? "dismissed"
              : "updated",
        changes,
        actor,
      });
    }

    writeJson(KEY(project, module), [...byId.values()]);
    this.appendEvents(project, module, events);
    this.touchIndex(project);
    return written;
  }

  async remove(
    project: string,
    module: ModuleId,
    id: string,
    actor: string,
  ): Promise<void> {
    const current = await this.list(project, module);
    const next = current.filter((e) => e.id !== id);
    if (next.length === current.length) return;
    writeJson(KEY(project, module), next);
    this.appendEvents(project, module, [
      {
        id: this.nextEventId(),
        entryId: id,
        module,
        at: nowIso(),
        kind: "deleted",
        actor,
      },
    ]);
  }

  async history(
    project: string,
    module: ModuleId,
    entryId?: string,
  ): Promise<RegistryEvent[]> {
    const all = readJson<RegistryEvent[]>(HISTORY_KEY(project, module), []);
    return entryId ? all.filter((e) => e.entryId === entryId) : all;
  }
}

/**
 * In-memory store. Used by tests and by the CLI, which has no localStorage.
 *
 * Shares no code with the local one on purpose — a fake that reimplements the
 * real thing tests the fake. This is a plain Map, and the behaviour they must
 * agree on is asserted against both.
 */
export class MemoryRegistryStore implements RegistryStore {
  private data = new Map<string, RegistryEntry[]>();
  private events = new Map<string, RegistryEvent[]>();
  private seq = 0;

  private key(project: string, module: ModuleId) {
    return `${project}:${module}`;
  }

  async projects(): Promise<string[]> {
    return [...new Set([...this.data.keys()].map((k) => k.split(":")[0]))];
  }

  async list<T extends RegistryEntry>(project: string, module: ModuleId): Promise<T[]> {
    return (this.data.get(this.key(project, module)) ?? []) as T[];
  }

  async get<T extends RegistryEntry>(
    project: string,
    module: ModuleId,
    id: string,
  ): Promise<T | null> {
    return (await this.list<T>(project, module)).find((e) => e.id === id) ?? null;
  }

  async put<T extends RegistryEntry>(project: string, entry: T, actor: string): Promise<T> {
    const [stored] = await this.putMany(project, [entry], actor);
    return stored;
  }

  async putMany<T extends RegistryEntry>(
    project: string,
    entries: T[],
    actor: string,
  ): Promise<T[]> {
    if (!entries.length) return [];
    const module = entries[0].module;
    const k = this.key(project, module);
    const byId = new Map((this.data.get(k) ?? []).map((e) => [e.id, e]));
    const log = this.events.get(k) ?? [];
    const at = nowIso();
    const written: T[] = [];

    for (const entry of entries) {
      const before = byId.get(entry.id) as T | undefined;
      if (!before) {
        const created = { ...entry, createdAt: entry.createdAt ?? at, updatedAt: at };
        byId.set(entry.id, created);
        written.push(created);
        this.seq += 1;
        log.unshift({
          id: `ev-${this.seq}`,
          entryId: entry.id,
          module,
          at,
          kind: "created",
          actor,
        });
        continue;
      }
      const changes = diff(before, entry);
      if (!Object.keys(changes).length) {
        written.push(before);
        continue;
      }
      const updated = {
        ...entry,
        createdAt: before.createdAt,
        updatedAt: at,
        revision: before.revision + 1,
      };
      byId.set(entry.id, updated);
      written.push(updated);
      this.seq += 1;
      log.unshift({
        id: `ev-${this.seq}`,
        entryId: entry.id,
        module,
        at,
        // Must match LocalRegistryStore exactly. The two are separate
        // implementations on purpose, and a test asserts they agree — a fake
        // that behaves differently from the real store tests the fake.
        kind:
          changes.review?.[1] === "accepted"
            ? "accepted"
            : changes.review?.[1] === "dismissed"
              ? "dismissed"
              : "updated",
        changes,
        actor,
      });
    }

    this.data.set(k, [...byId.values()]);
    this.events.set(k, log);
    return written;
  }

  async remove(project: string, module: ModuleId, id: string, actor: string): Promise<void> {
    const k = this.key(project, module);
    const current = this.data.get(k) ?? [];
    const next = current.filter((e) => e.id !== id);
    if (next.length === current.length) return;
    this.data.set(k, next);
    this.seq += 1;
    this.events.set(k, [
      { id: `ev-${this.seq}`, entryId: id, module, at: nowIso(), kind: "deleted", actor },
      ...(this.events.get(k) ?? []),
    ]);
  }

  async history(
    project: string,
    module: ModuleId,
    entryId?: string,
  ): Promise<RegistryEvent[]> {
    const all = this.events.get(this.key(project, module)) ?? [];
    return entryId ? all.filter((e) => e.entryId === entryId) : all;
  }
}

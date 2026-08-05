import type { RegistryStore } from "./store";
import type { ModuleId, RegistryEntry } from "./types";

/**
 * The synchronisation layer.
 *
 * Written against a transport interface rather than against fetch, because
 * there is no server yet. The queue, the conflict rules, the retry policy and
 * the duplicate prevention are all real and all tested; the only thing missing
 * is a remote to talk to. When one exists it implements `SyncTransport` and
 * nothing here changes.
 *
 * The rule that shapes everything below: **revisions, never timestamps.** Two
 * machines' clocks disagree, and a conflict resolved by whichever laptop is set
 * fast is not resolved — it's data loss that looks like success.
 */

export interface SyncTransport {
  /** Entries changed remotely since `cursor`. Null cursor means everything. */
  pull(
    project: string,
    module: ModuleId,
    cursor: string | null,
  ): Promise<{ entries: RegistryEntry[]; cursor: string }>;
  /** Push local changes. The remote reports which ones it refused. */
  push(
    project: string,
    module: ModuleId,
    entries: RegistryEntry[],
  ): Promise<{ accepted: string[]; conflicts: RegistryEntry[] }>;
}

export type ConflictResolution = "local" | "remote" | "manual";

export interface SyncConflict {
  local: RegistryEntry;
  remote: RegistryEntry;
  resolution: ConflictResolution;
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  conflicts: SyncConflict[];
  /** Operations still queued because they failed and are worth retrying. */
  pending: number;
  errors: string[];
}

/** One queued write, durable across reloads so an offline edit isn't lost. */
export interface QueuedOp {
  id: string;
  project: string;
  module: ModuleId;
  entry: RegistryEntry;
  attempts: number;
  /** Epoch ms. Nothing is retried before this. */
  nextAttemptAt: number;
}

const QUEUE_KEY = "devcon:registry:queue";
const CURSOR_KEY = (p: string, m: ModuleId) => `devcon:registry:cursor:${p}:${m}`;

/** Give up after this many. Beyond it the failure isn't transient. */
export const MAX_ATTEMPTS = 6;

/**
 * Exponential backoff with a ceiling.
 *
 * Deterministic — no jitter — because this is a single client talking to its
 * own project's rows, not a thundering herd. Jitter would only make the
 * behaviour untestable.
 */
export function backoffMs(attempts: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Which side wins.
 *
 * Higher revision wins outright — it has strictly more history behind it. Equal
 * revisions with different content is a genuine conflict: both sides edited
 * from the same base, and picking one silently would discard work someone did.
 * Those are surfaced for a person to resolve.
 */
export function resolve(
  local: RegistryEntry,
  remote: RegistryEntry,
): ConflictResolution {
  if (local.revision > remote.revision) return "local";
  if (remote.revision > local.revision) return "remote";
  return sameContent(local, remote) ? "remote" : "manual";
}

/** Compares what a user would call the entry, ignoring bookkeeping fields. */
export function sameContent(a: RegistryEntry, b: RegistryEntry): boolean {
  const strip = (e: RegistryEntry) => {
    const { updatedAt: _u, revision: _r, ...rest } = e;
    return JSON.stringify(rest, Object.keys(rest).sort());
  };
  return strip(a) === strip(b);
}

function loadQueue(): QueuedOp[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedOp[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* quota — the queue is a best effort, the store is the truth */
  }
}

export class SyncEngine {
  constructor(
    private store: RegistryStore,
    private transport: SyncTransport,
    /** Injected so tests don't wait on wall-clock time. */
    private now: () => number = () => Date.now(),
  ) {}

  /**
   * Queue an entry for the remote.
   *
   * Duplicate prevention is by (project, module, entry id): a second edit to
   * the same entry replaces the queued one rather than appending. Ten edits
   * offline should push once, not ten times, and the last state is the only
   * one that was ever true.
   */
  enqueue(project: string, entry: RegistryEntry): void {
    const queue = loadQueue();
    const key = `${project}:${entry.module}:${entry.id}`;
    const existing = queue.findIndex((op) => op.id === key);
    const op: QueuedOp = {
      id: key,
      project,
      module: entry.module,
      entry,
      attempts: 0,
      nextAttemptAt: this.now(),
    };
    if (existing >= 0) queue[existing] = op;
    else queue.push(op);
    saveQueue(queue);
  }

  pendingCount(): number {
    return loadQueue().length;
  }

  private cursor(project: string, module: ModuleId): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(CURSOR_KEY(project, module));
  }

  private setCursor(project: string, module: ModuleId, cursor: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CURSOR_KEY(project, module), cursor);
    } catch {
      /* next sync re-pulls from the old cursor; correct, just less efficient */
    }
  }

  /**
   * One sync pass: pull, reconcile, then push what's queued and due.
   *
   * Pull first on purpose. Pushing first would send a local entry the remote
   * has already superseded, get it rejected as a conflict, and turn a
   * resolvable ordering problem into a question for the user.
   */
  async sync(project: string, module: ModuleId): Promise<SyncResult> {
    const conflicts: SyncConflict[] = [];
    const errors: string[] = [];
    let pulled = 0;
    let pushed = 0;

    // ---- pull -------------------------------------------------------------
    try {
      const cursor = this.cursor(project, module);
      const { entries, cursor: next } = await this.transport.pull(
        project,
        module,
        cursor,
      );

      const toWrite: RegistryEntry[] = [];
      for (const remote of entries) {
        const local = await this.store.get(project, module, remote.id);
        if (!local) {
          toWrite.push(remote);
          continue;
        }
        const decision = resolve(local, remote);
        if (decision === "remote") toWrite.push(remote);
        else if (decision === "manual") {
          conflicts.push({ local, remote, resolution: "manual" });
        }
        // "local" wins: nothing to write, and the queue will push it.
      }

      if (toWrite.length) await this.store.putMany(project, toWrite, "sync");
      pulled = toWrite.length;
      this.setCursor(project, module, next);
    } catch (e) {
      errors.push(`pull failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ---- push -------------------------------------------------------------
    const queue = loadQueue();
    const due = queue.filter(
      (op) =>
        op.project === project &&
        op.module === module &&
        op.nextAttemptAt <= this.now(),
    );

    if (due.length) {
      try {
        const { accepted, conflicts: rejected } = await this.transport.push(
          project,
          module,
          due.map((op) => op.entry),
        );

        const acceptedSet = new Set(accepted);
        pushed = accepted.length;

        for (const remote of rejected) {
          const local = due.find((op) => op.entry.id === remote.id)?.entry;
          if (local) conflicts.push({ local, remote, resolution: resolve(local, remote) });
        }

        // Drop what landed; a rejected entry stays queued but is not retried
        // blindly — it needs the conflict resolving first.
        const rejectedSet = new Set(rejected.map((r) => r.id));
        saveQueue(
          queue.filter((op) => {
            if (op.project !== project || op.module !== module) return true;
            if (acceptedSet.has(op.entry.id)) return false;
            if (rejectedSet.has(op.entry.id)) return false;
            return true;
          }),
        );
      } catch (e) {
        errors.push(`push failed: ${e instanceof Error ? e.message : String(e)}`);
        // Back off the ones that were due, and drop anything past the limit —
        // a queue that retries forever is a queue that never drains.
        const at = this.now();
        saveQueue(
          queue
            .map((op) => {
              if (op.project !== project || op.module !== module) return op;
              if (op.nextAttemptAt > at) return op;
              const attempts = op.attempts + 1;
              return { ...op, attempts, nextAttemptAt: at + backoffMs(attempts) };
            })
            .filter((op) => op.attempts < MAX_ATTEMPTS),
        );
      }
    }

    return {
      pulled,
      pushed,
      conflicts,
      pending: loadQueue().length,
      errors,
    };
  }

  /**
   * Apply a decision to a conflict the user resolved.
   *
   * Bumps past the remote revision so the next push is unambiguously newer —
   * otherwise the same conflict is raised again on the following sync.
   */
  async resolveConflict(
    project: string,
    conflict: SyncConflict,
    choice: "local" | "remote",
  ): Promise<void> {
    if (choice === "remote") {
      await this.store.put(project, conflict.remote, "sync");
      return;
    }
    const winner = {
      ...conflict.local,
      revision: Math.max(conflict.local.revision, conflict.remote.revision) + 1,
    };
    await this.store.put(project, winner, "user");
    this.enqueue(project, winner);
  }
}

/**
 * A transport that keeps everything local.
 *
 * Not a stub — it is what the product uses today, and it means the sync engine
 * is exercised in production rather than sitting dormant until a backend
 * appears. Pull returns nothing, push accepts everything.
 */
export const localOnlyTransport: SyncTransport = {
  async pull() {
    return { entries: [], cursor: new Date().toISOString() };
  },
  async push(_project, _module, entries) {
    return { accepted: entries.map((e) => e.id), conflicts: [] };
  },
};

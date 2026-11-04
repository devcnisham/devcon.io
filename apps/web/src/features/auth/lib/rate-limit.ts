/**
 * Fixed-window rate limiting, storage-agnostic.
 *
 * The in-memory store below is correct for a single process only. On
 * serverless or multiple instances each process keeps its own counters, so the
 * effective limit multiplies by the instance count — swap in a shared store
 * (Postgres or Redis) before this is load-bearing in production.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

type Window = {
  count: number;
  /** Retention deadline. The store prunes the entry once this passes. */
  expiresAt: number;
  /**
   * Optional lockout deadline, used by BruteForceGuard. Kept separate from
   * `expiresAt` so an unlocked record still survives pruning.
   */
  lockedUntil?: number;
};

export interface RateLimitStore {
  get(key: string): Promise<Window | undefined> | Window | undefined;
  set(key: string, window: Window): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  prune(now: number): Promise<void> | void;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private windows = new Map<string, Window>();

  get size(): number {
    return this.windows.size;
  }

  get(key: string): Window | undefined {
    return this.windows.get(key);
  }

  set(key: string, window: Window): void {
    this.windows.set(key, window);
  }

  delete(key: string): void {
    this.windows.delete(key);
  }

  /** Called on every write so expired keys cannot accumulate unbounded. */
  prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) this.windows.delete(key);
    }
  }
}

export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly store: RateLimitStore;
  private readonly now: () => number;

  constructor(options: {
    limit: number;
    windowMs: number;
    store?: RateLimitStore;
    now?: () => number;
  }) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.store = options.store ?? new MemoryRateLimitStore();
    this.now = options.now ?? Date.now;
  }

  /** Records an attempt and reports whether it is allowed. */
  async consume(key: string): Promise<RateLimitResult> {
    const now = this.now();
    await this.store.prune(now);

    const existing = await this.store.get(key);
    const window: Window =
      existing && existing.expiresAt > now
        ? existing
        : { count: 0, expiresAt: now + this.windowMs };

    window.count += 1;
    await this.store.set(key, window);

    return this.describe(window, now);
  }

  /** Reports the current state without recording an attempt. */
  async peek(key: string): Promise<RateLimitResult> {
    const now = this.now();
    const existing = await this.store.get(key);

    if (!existing || existing.expiresAt <= now) {
      return { allowed: true, remaining: this.limit, retryAfterMs: 0 };
    }

    return this.describe(existing, now);
  }

  async reset(key: string): Promise<void> {
    await this.store.delete(key);
  }

  private describe(window: Window, now: number): RateLimitResult {
    const allowed = window.count <= this.limit;

    return {
      allowed,
      remaining: Math.max(0, this.limit - window.count),
      retryAfterMs: allowed ? 0 : Math.max(0, window.expiresAt - now),
    };
  }
}

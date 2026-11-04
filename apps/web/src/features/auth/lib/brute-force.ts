import { MemoryRateLimitStore, type RateLimitStore } from "./rate-limit";

/**
 * Brute-force protection with progressive lockout.
 *
 * Distinct from rate limiting: the rate limiter caps request volume, this caps
 * consecutive *failures* and lengthens the penalty each time, so guessing gets
 * exponentially more expensive while a legitimate user who mistypes once is
 * barely inconvenienced.
 *
 * Key the guard on something the attacker cannot rotate freely. Email alone
 * lets an attacker lock a victim out; IP alone is defeated by a botnet. In
 * practice key on both and lock when either trips.
 */

export type BruteForceStatus = {
  locked: boolean;
  retryAfterMs: number;
  attemptsRemaining: number;
};

type Record_ = { failures: number; lockedUntil: number };

export class BruteForceGuard {
  private readonly maxAttempts: number;
  private readonly baseLockoutMs: number;
  private readonly maxLockoutMs: number;
  private readonly store: RateLimitStore;
  private readonly now: () => number;

  constructor(options: {
    maxAttempts: number;
    baseLockoutMs: number;
    maxLockoutMs: number;
    store?: RateLimitStore;
    now?: () => number;
  }) {
    this.maxAttempts = options.maxAttempts;
    this.baseLockoutMs = options.baseLockoutMs;
    this.maxLockoutMs = options.maxLockoutMs;
    this.store = options.store ?? new MemoryRateLimitStore();
    this.now = options.now ?? Date.now;
  }

  async check(identifier: string): Promise<BruteForceStatus> {
    const now = this.now();
    const record = await this.read(identifier);

    if (!record) {
      return {
        locked: false,
        retryAfterMs: 0,
        attemptsRemaining: this.maxAttempts,
      };
    }

    const locked = record.lockedUntil > now;

    return {
      locked,
      retryAfterMs: locked ? record.lockedUntil - now : 0,
      attemptsRemaining: Math.max(0, this.maxAttempts - record.failures),
    };
  }

  async recordFailure(identifier: string): Promise<BruteForceStatus> {
    const now = this.now();
    const record = (await this.read(identifier)) ?? {
      failures: 0,
      lockedUntil: 0,
    };

    record.failures += 1;

    if (record.failures >= this.maxAttempts) {
      const overage = record.failures - this.maxAttempts;
      record.lockedUntil = now + this.lockoutFor(overage);
    }

    await this.write(identifier, record);
    return this.check(identifier);
  }

  /** A successful login wipes the record — penalties never carry over. */
  async recordSuccess(identifier: string): Promise<void> {
    await this.store.delete(this.key(identifier));
  }

  /** Doubles per extra failure, capped. `2 ** overage` grows fast, so clamp. */
  private lockoutFor(overage: number): number {
    const scaled = this.baseLockoutMs * 2 ** Math.min(overage, 32);
    return Math.min(scaled, this.maxLockoutMs);
  }

  private key(identifier: string): string {
    return `bf:${identifier}`;
  }

  private async read(identifier: string): Promise<Record_ | undefined> {
    const window = await this.store.get(this.key(identifier));
    if (!window) return undefined;

    // The store models {count, expiresAt}; reuse it as {failures, lockedUntil}.
    // `expiresAt` is the retention deadline, not the lockout deadline — see
    // write() for why those differ.
    return {
      failures: window.count,
      lockedUntil: window.lockedUntil ?? 0,
    };
  }

  /**
   * `expiresAt` is deliberately NOT the lockout deadline.
   *
   * A store prunes anything whose `expiresAt` has passed. An unlocked record
   * has no lockout deadline, so writing 0 there would make every failure count
   * evaporate on the next prune — five separate "first attempts" instead of a
   * lockout, silently defeating this guard. Retention is therefore the longest
   * penalty this guard can impose, counted from now, and the real lockout
   * deadline is carried alongside it.
   */
  private async write(identifier: string, record: Record_): Promise<void> {
    const retainUntil = this.now() + this.maxLockoutMs;

    await this.store.set(this.key(identifier), {
      count: record.failures,
      expiresAt: Math.max(retainUntil, record.lockedUntil),
      lockedUntil: record.lockedUntil,
    });
  }
}

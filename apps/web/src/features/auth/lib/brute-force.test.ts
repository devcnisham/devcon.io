import { beforeEach, describe, expect, it } from "vitest";
import { BruteForceGuard } from "./brute-force";
import { MemoryRateLimitStore } from "./rate-limit";

describe("BruteForceGuard", () => {
  let now: number;
  let guard: BruteForceGuard;

  beforeEach(() => {
    now = 1_000_000;
    guard = new BruteForceGuard({
      maxAttempts: 5,
      baseLockoutMs: 60_000,
      maxLockoutMs: 3_600_000,
      store: new MemoryRateLimitStore(),
      now: () => now,
    });
  });

  it("permits an untouched identifier", async () => {
    expect((await guard.check("user@example.com")).locked).toBe(false);
  });

  it("stays unlocked below the attempt threshold", async () => {
    for (let i = 0; i < 4; i++) await guard.recordFailure("u");

    expect((await guard.check("u")).locked).toBe(false);
  });

  it("locks once the threshold is reached", async () => {
    for (let i = 0; i < 5; i++) await guard.recordFailure("u");

    expect((await guard.check("u")).locked).toBe(true);
  });

  it("reports how long the lockout lasts", async () => {
    for (let i = 0; i < 5; i++) await guard.recordFailure("u");

    expect((await guard.check("u")).retryAfterMs).toBe(60_000);
  });

  it("doubles the lockout on each further failure", async () => {
    for (let i = 0; i < 5; i++) await guard.recordFailure("u");
    await guard.recordFailure("u");

    expect((await guard.check("u")).retryAfterMs).toBe(120_000);
  });

  it("caps the lockout at the configured maximum", async () => {
    for (let i = 0; i < 40; i++) await guard.recordFailure("u");

    expect((await guard.check("u")).retryAfterMs).toBe(3_600_000);
  });

  it("unlocks once the lockout has elapsed", async () => {
    for (let i = 0; i < 5; i++) await guard.recordFailure("u");

    now += 60_001;

    expect((await guard.check("u")).locked).toBe(false);
  });

  it("is still locked one millisecond before the lockout ends", async () => {
    for (let i = 0; i < 5; i++) await guard.recordFailure("u");

    now += 59_999;

    expect((await guard.check("u")).locked).toBe(true);
  });

  it("a successful login clears the record", async () => {
    for (let i = 0; i < 5; i++) await guard.recordFailure("u");

    await guard.recordSuccess("u");

    expect((await guard.check("u")).locked).toBe(false);
  });

  it("tracks identifiers independently", async () => {
    for (let i = 0; i < 5; i++) await guard.recordFailure("alice");

    expect((await guard.check("bob")).locked).toBe(false);
  });

  it("reports remaining attempts before lockout", async () => {
    await guard.recordFailure("u");

    expect((await guard.check("u")).attemptsRemaining).toBe(4);
  });

  it("reports zero remaining once locked", async () => {
    for (let i = 0; i < 5; i++) await guard.recordFailure("u");

    expect((await guard.check("u")).attemptsRemaining).toBe(0);
  });
});

describe("BruteForceGuard sharing a store with a rate limiter", () => {
  it("keeps failure counts when the store is pruned", async () => {
    const now = 1_000_000;
    const store = new MemoryRateLimitStore();
    const guard = new BruteForceGuard({
      maxAttempts: 5,
      baseLockoutMs: 60_000,
      maxLockoutMs: 3_600_000,
      store,
      now: () => now,
    });

    // Four failures — recorded, but not yet a lockout.
    for (let i = 0; i < 4; i++) await guard.recordFailure("u");

    // Anything else using this store prunes expired windows.
    await store.prune(now);

    // The fifth failure must still trip the lockout.
    await guard.recordFailure("u");

    expect((await guard.check("u")).locked).toBe(true);
  });
});

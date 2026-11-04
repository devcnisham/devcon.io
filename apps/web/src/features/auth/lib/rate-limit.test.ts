import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRateLimitStore, RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  let now: number;
  let limiter: RateLimiter;

  beforeEach(() => {
    now = 1_000_000;
    limiter = new RateLimiter({
      limit: 3,
      windowMs: 60_000,
      store: new MemoryRateLimitStore(),
      now: () => now,
    });
  });

  it("allows requests up to the limit", async () => {
    expect((await limiter.consume("ip:1.2.3.4")).allowed).toBe(true);
    expect((await limiter.consume("ip:1.2.3.4")).allowed).toBe(true);
    expect((await limiter.consume("ip:1.2.3.4")).allowed).toBe(true);
  });

  it("blocks the request after the limit is reached", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("ip:1.2.3.4");

    expect((await limiter.consume("ip:1.2.3.4")).allowed).toBe(false);
  });

  it("reports how many attempts remain", async () => {
    expect((await limiter.consume("k")).remaining).toBe(2);
    expect((await limiter.consume("k")).remaining).toBe(1);
    expect((await limiter.consume("k")).remaining).toBe(0);
    expect((await limiter.consume("k")).remaining).toBe(0);
  });

  it("reports when the caller may retry", async () => {
    for (let i = 0; i < 4; i++) await limiter.consume("k");

    const result = await limiter.consume("k");
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("keeps separate counters per key", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("ip:1.1.1.1");

    expect((await limiter.consume("ip:2.2.2.2")).allowed).toBe(true);
  });

  it("allows again once the window has elapsed", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("k");
    expect((await limiter.consume("k")).allowed).toBe(false);

    now += 60_001;

    expect((await limiter.consume("k")).allowed).toBe(true);
  });

  it("still blocks one millisecond before the window closes", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("k");

    now += 59_999;

    expect((await limiter.consume("k")).allowed).toBe(false);
  });

  it("reset clears a key", async () => {
    for (let i = 0; i < 3; i++) await limiter.consume("k");

    await limiter.reset("k");

    expect((await limiter.consume("k")).allowed).toBe(true);
  });

  it("peek does not consume an attempt", async () => {
    await limiter.consume("k");

    const peeked = await limiter.peek("k");
    expect(peeked.remaining).toBe(2);
    expect((await limiter.peek("k")).remaining).toBe(2);
  });
});

describe("MemoryRateLimitStore", () => {
  it("drops entries whose window has expired", async () => {
    let now = 0;
    const store = new MemoryRateLimitStore();
    const limiter = new RateLimiter({
      limit: 1,
      windowMs: 1000,
      store,
      now: () => now,
    });

    await limiter.consume("a");
    expect(store.size).toBe(1);

    now += 1001;
    await limiter.consume("b");

    expect(store.size).toBe(1);
  });
});

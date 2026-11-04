import { describe, expect, it } from "vitest";
import {
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  evaluateSession,
  nextExpiry,
} from "./session-policy";

const issuedAt = 1_000_000;

function session(
  overrides: Partial<Parameters<typeof evaluateSession>[0]> = {}
) {
  return {
    issuedAt,
    lastActiveAt: issuedAt,
    now: issuedAt,
    ...overrides,
  };
}

describe("evaluateSession", () => {
  it("is valid immediately after issue", () => {
    expect(evaluateSession(session()).status).toBe("valid");
  });

  it("expires after the idle timeout with no activity", () => {
    const result = evaluateSession(
      session({ now: issuedAt + SESSION_IDLE_MS + 1 })
    );

    expect(result).toEqual({ status: "expired", reason: "idle" });
  });

  it("is still valid one millisecond before the idle timeout", () => {
    expect(
      evaluateSession(session({ now: issuedAt + SESSION_IDLE_MS - 1 })).status
    ).toBe("valid");
  });

  it("expires at the absolute lifetime even with constant activity", () => {
    const now = issuedAt + SESSION_ABSOLUTE_MS + 1;
    const result = evaluateSession(session({ now, lastActiveAt: now - 1000 }));

    expect(result).toEqual({ status: "expired", reason: "absolute" });
  });

  it("reports the absolute limit when both limits are passed", () => {
    const now = issuedAt + SESSION_ABSOLUTE_MS + SESSION_IDLE_MS;

    expect(evaluateSession(session({ now }))).toEqual({
      status: "expired",
      reason: "absolute",
    });
  });

  it("treats a session issued in the future as invalid", () => {
    const result = evaluateSession(session({ now: issuedAt - 1 }));

    expect(result.status).toBe("invalid");
  });

  it("keeps a busy session alive past the idle window", () => {
    const now = issuedAt + SESSION_IDLE_MS * 3;
    const result = evaluateSession(
      session({ now, lastActiveAt: now - 60_000 })
    );

    expect(result.status).toBe("valid");
  });
});

describe("nextExpiry", () => {
  it("slides forward by the idle window", () => {
    expect(nextExpiry({ issuedAt, now: issuedAt })).toBe(
      issuedAt + SESSION_IDLE_MS
    );
  });

  it("never slides past the absolute lifetime", () => {
    const now = issuedAt + SESSION_ABSOLUTE_MS - 1000;

    expect(nextExpiry({ issuedAt, now })).toBe(issuedAt + SESSION_ABSOLUTE_MS);
  });
});

import { describe, expect, it } from "vitest";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearedCookieOptions,
  csrfCookieOptions,
  sessionCookieOptions,
} from "./cookies";

describe("cookie names", () => {
  it("uses the __Host- prefix for the session cookie", () => {
    // __Host- is browser-enforced: secure, path=/, and no Domain attribute.
    expect(SESSION_COOKIE).toMatch(/^__Host-/);
  });
});

describe("sessionCookieOptions", () => {
  it("is httpOnly so scripts cannot read it", () => {
    expect(sessionCookieOptions({ maxAgeMs: 1000 }).httpOnly).toBe(true);
  });

  it("is secure in production", () => {
    expect(
      sessionCookieOptions({ maxAgeMs: 1000, isProduction: true }).secure
    ).toBe(true);
  });

  it("stays secure in development, because __Host- requires it", () => {
    expect(
      sessionCookieOptions({ maxAgeMs: 1000, isProduction: false }).secure
    ).toBe(true);
  });

  it("uses sameSite lax so top-level navigation still carries it", () => {
    expect(sessionCookieOptions({ maxAgeMs: 1000 }).sameSite).toBe("lax");
  });

  it("is scoped to the whole site", () => {
    expect(sessionCookieOptions({ maxAgeMs: 1000 }).path).toBe("/");
  });

  it("sets no domain — __Host- forbids it", () => {
    expect(sessionCookieOptions({ maxAgeMs: 1000 })).not.toHaveProperty(
      "domain"
    );
  });

  it("converts the lifetime from milliseconds to whole seconds", () => {
    expect(sessionCookieOptions({ maxAgeMs: 90_000 }).maxAge).toBe(90);
  });

  it("floors a fractional second rather than rounding up", () => {
    expect(sessionCookieOptions({ maxAgeMs: 1999 }).maxAge).toBe(1);
  });

  it("never emits a negative lifetime", () => {
    expect(sessionCookieOptions({ maxAgeMs: -5000 }).maxAge).toBe(0);
  });
});

describe("csrfCookieOptions", () => {
  it("is readable by scripts — the double-submit copy must be sent back", () => {
    expect(csrfCookieOptions({ maxAgeMs: 1000 }).httpOnly).toBe(false);
  });

  it("is still secure and sameSite lax", () => {
    const options = csrfCookieOptions({ maxAgeMs: 1000 });

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("lax");
  });

  it("uses the __Host- prefix", () => {
    expect(CSRF_COOKIE).toMatch(/^__Host-/);
  });
});

describe("clearedCookieOptions", () => {
  it("expires immediately", () => {
    expect(clearedCookieOptions().maxAge).toBe(0);
  });

  it("keeps the flags that scope the cookie, so the browser matches it", () => {
    const options = clearedCookieOptions();

    expect(options.path).toBe("/");
    expect(options.secure).toBe(true);
  });
});

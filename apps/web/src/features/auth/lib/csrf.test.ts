import { describe, expect, it } from "vitest";
import { createCsrfToken, verifyCsrfToken, isTrustedOrigin } from "./csrf";

describe("createCsrfToken", () => {
  it("returns a high-entropy token", () => {
    const token = createCsrfToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 bytes, base64url
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 100 }, createCsrfToken));

    expect(tokens.size).toBe(100);
  });
});

describe("verifyCsrfToken", () => {
  it("accepts a matching pair", () => {
    const token = createCsrfToken();

    expect(verifyCsrfToken(token, token)).toBe(true);
  });

  it("rejects a mismatched pair", () => {
    expect(verifyCsrfToken(createCsrfToken(), createCsrfToken())).toBe(false);
  });

  it("rejects when either side is missing", () => {
    const token = createCsrfToken();

    expect(verifyCsrfToken(undefined, token)).toBe(false);
    expect(verifyCsrfToken(token, undefined)).toBe(false);
    expect(verifyCsrfToken(undefined, undefined)).toBe(false);
  });

  it("rejects empty strings — two blanks are not a match", () => {
    expect(verifyCsrfToken("", "")).toBe(false);
  });

  it("rejects a token that is a prefix of the other", () => {
    const token = createCsrfToken();

    expect(verifyCsrfToken(token.slice(0, -1), token)).toBe(false);
  });
});

describe("isTrustedOrigin", () => {
  const allowed = "https://devstep.app";

  it("accepts an exact origin match", () => {
    expect(isTrustedOrigin({ origin: allowed }, allowed)).toBe(true);
  });

  it("rejects a different origin", () => {
    expect(isTrustedOrigin({ origin: "https://evil.example" }, allowed)).toBe(
      false
    );
  });

  it("rejects a subdomain of the allowed origin", () => {
    expect(
      isTrustedOrigin({ origin: "https://evil.devstep.app" }, allowed)
    ).toBe(false);
  });

  it("rejects an origin that merely starts with the allowed one", () => {
    expect(
      isTrustedOrigin({ origin: "https://devstep.app.evil.example" }, allowed)
    ).toBe(false);
  });

  it("falls back to the referer when origin is absent", () => {
    expect(isTrustedOrigin({ referer: `${allowed}/settings` }, allowed)).toBe(
      true
    );
  });

  it("prefers origin over referer when both are present", () => {
    expect(
      isTrustedOrigin(
        { origin: "https://evil.example", referer: `${allowed}/x` },
        allowed
      )
    ).toBe(false);
  });

  it("rejects when neither header is present — fail closed", () => {
    expect(isTrustedOrigin({}, allowed)).toBe(false);
  });

  it("rejects a malformed referer", () => {
    expect(isTrustedOrigin({ referer: "not a url" }, allowed)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  GITHUB_SCOPES,
  buildAuthorizeUrl,
  createOAuthState,
  parseCallback,
  verifyOAuthState,
} from "./oauth";

describe("createOAuthState", () => {
  it("is long enough to be unguessable", () => {
    expect(createOAuthState().length).toBeGreaterThanOrEqual(43);
  });

  it("never repeats", () => {
    const states = new Set(Array.from({ length: 100 }, createOAuthState));

    expect(states.size).toBe(100);
  });

  it("is URL-safe", () => {
    expect(createOAuthState()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("verifyOAuthState", () => {
  it("accepts a matching pair", () => {
    const state = createOAuthState();

    expect(verifyOAuthState(state, state)).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(verifyOAuthState(createOAuthState(), createOAuthState())).toBe(
      false
    );
  });

  it("rejects when either side is missing", () => {
    const state = createOAuthState();

    expect(verifyOAuthState(undefined, state)).toBe(false);
    expect(verifyOAuthState(state, undefined)).toBe(false);
  });

  it("rejects two empty strings", () => {
    expect(verifyOAuthState("", "")).toBe(false);
  });
});

describe("buildAuthorizeUrl", () => {
  const options = {
    clientId: "abc123",
    redirectUri: "https://devstep.app/api/integrations/github/callback",
    state: "s-t-a-t-e",
  };

  it("points at GitHub's authorize endpoint", () => {
    const url = new URL(buildAuthorizeUrl(options));

    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
  });

  it("carries the client id, redirect, and state", () => {
    const params = new URL(buildAuthorizeUrl(options)).searchParams;

    expect(params.get("client_id")).toBe("abc123");
    expect(params.get("redirect_uri")).toBe(options.redirectUri);
    expect(params.get("state")).toBe("s-t-a-t-e");
  });

  it("requests only the scopes we need", () => {
    const scopes =
      new URL(buildAuthorizeUrl(options)).searchParams
        .get("scope")
        ?.split(" ") ?? [];

    expect(scopes).toEqual([...GITHUB_SCOPES]);
    expect(scopes).not.toContain("repo:write");
    expect(scopes).not.toContain("delete_repo");
  });

  it("does not request write access to code", () => {
    // Reading is all an importer needs.
    expect(GITHUB_SCOPES).not.toContain("repo");
  });
});

describe("parseCallback", () => {
  const state = "expected-state";

  it("returns the code when state matches", () => {
    const result = parseCallback(
      new URLSearchParams({ code: "the-code", state }),
      state
    );

    expect(result).toEqual({ ok: true, code: "the-code" });
  });

  it("rejects a mismatched state", () => {
    const result = parseCallback(
      new URLSearchParams({ code: "the-code", state: "attacker" }),
      state
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/state/i);
  });

  it("rejects a missing state even when a code is present", () => {
    const result = parseCallback(new URLSearchParams({ code: "x" }), state);

    expect(result.ok).toBe(false);
  });

  it("rejects when no state was stored", () => {
    const result = parseCallback(
      new URLSearchParams({ code: "x", state: "y" }),
      undefined
    );

    expect(result.ok).toBe(false);
  });

  it("surfaces GitHub's own error", () => {
    const result = parseCallback(
      new URLSearchParams({
        error: "access_denied",
        error_description: "The user denied access",
        state,
      }),
      state
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/denied/i);
  });

  it("rejects a callback with neither code nor error", () => {
    const result = parseCallback(new URLSearchParams({ state }), state);

    expect(result.ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { mapSupabaseSession } from "./session-provider";

describe("mapSupabaseSession", () => {
  it("maps a valid Supabase session to an AuthSession", () => {
    const mapped = mapSupabaseSession({
      user: {
        id: "u1",
        email: "a@b.test",
        user_metadata: { name: "Ada" },
        email_confirmed_at: "2026-08-18T10:00:00Z",
      },
      expires_at: 1789836000,
    });
    expect(mapped?.user).toEqual({
      id: "u1",
      name: "Ada",
      email: "a@b.test",
      emailVerified: true,
    });
    expect(typeof mapped?.expiresAt).toBe("string");
    expect(mapped?.expiresAt.length).toBeGreaterThan(0);
  });

  it("returns null for an unverified user (hard gate, D3)", () => {
    expect(
      mapSupabaseSession({
        user: {
          id: "u2",
          email: "c@d.test",
          user_metadata: {},
          email_confirmed_at: null,
        },
        expires_at: 1789836000,
      })
    ).toBeNull();
  });
});

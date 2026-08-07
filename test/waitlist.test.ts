import { beforeEach, describe, expect, it } from "vitest";
import {
  inWaitlist,
  isValidEmail,
  joinWaitlist,
  listWaitlist,
  waitlistCount,
} from "@/lib/waitlist/store";

/**
 * The waitlist reads `window.localStorage` directly, and the suite runs in
 * node. Without a shim every function takes its `typeof window === "undefined"`
 * branch and returns an empty list, so `joinWaitlist` never persists and the
 * dedup path — the only interesting logic in the module — is unreachable.
 *
 * A test written without this would pass against an implementation that
 * deduplicates nothing. That is the exact failure this repo has hit before.
 */
const KEY = "devcon.waitlist";

function installStorage(): Map<string, string> {
  const data = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    },
  };
  return data;
}

let store: Map<string, string>;
beforeEach(() => {
  store = installStorage();
});

describe("the shim actually stores, or every test below is vacuous", () => {
  it("persists across calls", () => {
    joinWaitlist("proof@example.com");
    expect(listWaitlist()).toHaveLength(1);
    expect(store.get(KEY)).toContain("proof@example.com");
  });
});

describe("email validation", () => {
  it("accepts an ordinary address", () => {
    expect(isValidEmail("nisham@example.com")).toBe(true);
    expect(isValidEmail("  nisham@example.com  ")).toBe(true);
  });

  it("rejects what a form actually receives", () => {
    for (const bad of [
      "",
      "   ",
      "nisham",
      "nisham@",
      "@example.com",
      "a@b",
      "a b@c.com",
    ]) {
      expect(isValidEmail(bad), bad).toBe(false);
    }
  });
});

describe("joining", () => {
  it("returns the entry, trimmed but not lowercased", () => {
    // The address is shown back to the person, so it keeps the casing they
    // typed. Only the dedup key is normalised.
    const entry = joinWaitlist("  Nisham@Example.com ");
    expect(typeof entry).not.toBe("string");
    expect(entry).toMatchObject({
      email: "Nisham@Example.com",
      key: "nisham@example.com",
    });
  });

  it("refuses an invalid address without storing anything", () => {
    expect(joinWaitlist("nope")).toBe(
      "That doesn't look like an email address.",
    );
    expect(waitlistCount()).toBe(0);
  });

  it("deduplicates on case and surrounding space", () => {
    expect(typeof joinWaitlist("nisham@example.com")).not.toBe("string");
    expect(joinWaitlist("  NISHAM@example.com  ")).toBe(
      "You're already on the list.",
    );
    expect(waitlistCount()).toBe(1);
  });

  it("keeps two different addresses", () => {
    joinWaitlist("a@example.com");
    joinWaitlist("b@example.com");
    expect(waitlistCount()).toBe(2);
  });
});

describe("membership", () => {
  it("matches regardless of how it is typed", () => {
    joinWaitlist("nisham@example.com");
    expect(inWaitlist(" NISHAM@Example.com ")).toBe(true);
    expect(inWaitlist("someone@example.com")).toBe(false);
  });

  it("is false for an empty string rather than matching everything", () => {
    /**
     * The `if (!key) return false` guard is unreachable through `joinWaitlist`
     * — validation runs first, so no entry it writes can have an empty key.
     * Mutation-testing proved it: deleting the guard broke nothing.
     *
     * It is still load-bearing against data we did not write, so that is what
     * is planted here. Without the guard, an empty submission matches the
     * planted row and the form tells the person they are already on a list
     * they never joined.
     */
    store.set(KEY, JSON.stringify([{ email: "", key: "", createdAt: 0 }]));
    expect(inWaitlist("   ")).toBe(false);
    expect(inWaitlist("")).toBe(false);
  });
});

describe("stored data that isn't what we wrote", () => {
  it("survives unparseable JSON", () => {
    store.set(KEY, "{not json");
    expect(listWaitlist()).toEqual([]);
    expect(() => joinWaitlist("nisham@example.com")).not.toThrow();
  });

  it("survives JSON that parses to the wrong type", () => {
    /**
     * `JSON.parse("null")` succeeds, so the existing try/catch does not fire —
     * the value escapes as `null` and the first `.some()` on it throws inside
     * the form's submit handler.
     *
     * Reachable in practice: everything here is keyed off `localhost:3000`,
     * which every other project on this machine also uses.
     */
    for (const junk of ["null", '"a string"', "42", '{"email":"x"}']) {
      store.set(KEY, junk);
      expect(listWaitlist(), junk).toEqual([]);
      expect(() => inWaitlist("nisham@example.com"), junk).not.toThrow();
      expect(() => joinWaitlist("nisham@example.com"), junk).not.toThrow();
    }
  });
});

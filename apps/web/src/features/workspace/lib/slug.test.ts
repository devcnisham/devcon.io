import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, isReservedSlug, toSlug, uniqueSlug } from "./slug";

describe("toSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(toSlug("My Team")).toBe("my-team");
  });

  it("strips punctuation", () => {
    expect(toSlug("Acme, Inc.")).toBe("acme-inc");
  });

  it("collapses runs of separators", () => {
    expect(toSlug("a   b---c")).toBe("a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(toSlug("  -hello-  ")).toBe("hello");
  });

  it("transliterates accented characters", () => {
    expect(toSlug("Café Ünïcode")).toBe("cafe-unicode");
  });

  it("keeps digits", () => {
    expect(toSlug("Team 42")).toBe("team-42");
  });

  it("returns an empty string when nothing survives", () => {
    expect(toSlug("!!!")).toBe("");
    expect(toSlug("   ")).toBe("");
  });

  it("truncates to the maximum length without a trailing hyphen", () => {
    const slug = toSlug("a".repeat(60) + " " + "b".repeat(60));

    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("does not merge separate words when truncating mid-word", () => {
    expect(toSlug("hello world")).toBe("hello-world");
  });
});

describe("isReservedSlug", () => {
  it("rejects route names that would collide with the app", () => {
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("settings")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isReservedSlug("LOGIN")).toBe(true);
  });

  it("allows an ordinary name", () => {
    expect(isReservedSlug("acme")).toBe(false);
  });

  it("lists every reserved word in lowercase", () => {
    for (const slug of RESERVED_SLUGS) {
      expect(slug).toBe(slug.toLowerCase());
    }
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when it is free", () => {
    expect(uniqueSlug("acme", new Set())).toBe("acme");
  });

  it("appends a counter when taken", () => {
    expect(uniqueSlug("acme", new Set(["acme"]))).toBe("acme-2");
  });

  it("keeps counting past the first collision", () => {
    expect(uniqueSlug("acme", new Set(["acme", "acme-2", "acme-3"]))).toBe(
      "acme-4"
    );
  });

  it("treats a reserved word as taken", () => {
    expect(uniqueSlug("login", new Set())).toBe("login-2");
  });

  it("falls back when the name yields nothing", () => {
    // "workspace" is itself reserved, so the first free candidate is -2.
    expect(uniqueSlug("!!!", new Set())).toBe("workspace-2");
  });

  it("keeps counting when the fallback is also taken", () => {
    expect(uniqueSlug("!!!", new Set(["workspace-2"]))).toBe("workspace-3");
  });
});

import { describe, expect, it } from "vitest";
import {
  MemoryScanCache,
  diffIndex,
  fingerprint,
  type IndexSnapshot,
} from "./cache";

const snapshot = (files: Record<string, string>): IndexSnapshot => ({
  files: Object.entries(files).map(([path, hash]) => ({ path, hash, size: 1 })),
});

describe("fingerprint", () => {
  it("is stable for the same content", () => {
    expect(fingerprint("hello")).toBe(fingerprint("hello"));
  });

  it("differs for different content", () => {
    expect(fingerprint("hello")).not.toBe(fingerprint("hellp"));
  });

  it("differs for content of different length", () => {
    expect(fingerprint("a")).not.toBe(fingerprint("aa"));
  });

  it("handles an empty string", () => {
    expect(typeof fingerprint("")).toBe("string");
  });

  it("is not trivially collidable on similar strings", () => {
    const hashes = new Set(["ab", "ba", "aab", "abb", "bab"].map(fingerprint));

    expect(hashes.size).toBe(5);
  });
});

describe("diffIndex", () => {
  it("reports everything as added when there is no previous scan", () => {
    const diff = diffIndex(null, snapshot({ "a.ts": "1", "b.ts": "2" }));

    expect(diff.added).toEqual(["a.ts", "b.ts"]);
    expect(diff.changed).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual([]);
  });

  it("reports nothing when nothing moved", () => {
    const before = snapshot({ "a.ts": "1" });
    const diff = diffIndex(before, snapshot({ "a.ts": "1" }));

    expect(diff.added).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual(["a.ts"]);
    expect(diff.isUnchanged).toBe(true);
  });

  it("detects a changed file by its hash", () => {
    const diff = diffIndex(
      snapshot({ "a.ts": "1" }),
      snapshot({ "a.ts": "2" })
    );

    expect(diff.changed).toEqual(["a.ts"]);
    expect(diff.isUnchanged).toBe(false);
  });

  it("detects added and removed files", () => {
    const diff = diffIndex(
      snapshot({ "a.ts": "1", "gone.ts": "9" }),
      snapshot({ "a.ts": "1", "new.ts": "3" })
    );

    expect(diff.added).toEqual(["new.ts"]);
    expect(diff.removed).toEqual(["gone.ts"]);
    expect(diff.unchanged).toEqual(["a.ts"]);
  });

  it("counts work saved by an incremental rescan", () => {
    const diff = diffIndex(
      snapshot({ "a.ts": "1", "b.ts": "2", "c.ts": "3", "d.ts": "4" }),
      snapshot({ "a.ts": "1", "b.ts": "2", "c.ts": "3", "d.ts": "CHANGED" })
    );

    expect(diff.needsWork).toEqual(["d.ts"]);
    expect(diff.unchanged).toHaveLength(3);
  });
});

describe("MemoryScanCache", () => {
  it("returns nothing for an unknown project", async () => {
    expect(await new MemoryScanCache().get("nope")).toBeNull();
  });

  it("round-trips a snapshot", async () => {
    const cache = new MemoryScanCache();
    const snap = snapshot({ "a.ts": "1" });

    await cache.set("project-1", snap);

    expect(await cache.get("project-1")).toEqual(snap);
  });

  it("keeps projects separate", async () => {
    const cache = new MemoryScanCache();

    await cache.set("one", snapshot({ "a.ts": "1" }));
    await cache.set("two", snapshot({ "b.ts": "2" }));

    expect((await cache.get("one"))?.files[0].path).toBe("a.ts");
  });

  it("overwrites a previous snapshot for the same project", async () => {
    const cache = new MemoryScanCache();

    await cache.set("p", snapshot({ "a.ts": "1" }));
    await cache.set("p", snapshot({ "a.ts": "2" }));

    expect((await cache.get("p"))?.files[0].hash).toBe("2");
  });

  it("clears a project", async () => {
    const cache = new MemoryScanCache();

    await cache.set("p", snapshot({ "a.ts": "1" }));
    await cache.clear("p");

    expect(await cache.get("p")).toBeNull();
  });
});

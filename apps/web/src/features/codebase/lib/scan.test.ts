import { describe, expect, it, vi } from "vitest";
import { scanProject, type ScanSource } from "./scan";

/** A fake project tree, so the scanner is tested without a real filesystem. */
function fakeSource(
  files: Record<string, { size?: number; text?: string }>
): ScanSource {
  const entries = Object.entries(files).map(([path, meta]) => ({
    path,
    size: meta.size ?? meta.text?.length ?? 10,
    isDirectory: false,
  }));

  return {
    async *walk() {
      for (const entry of entries) yield entry;
    },
    async readSample(path) {
      const text = files[path]?.text;
      return text ? new TextEncoder().encode(text) : new Uint8Array([]);
    },
    async readText(path) {
      return files[path]?.text ?? "";
    },
  };
}

describe("scanProject", () => {
  it("indexes ordinary source files", async () => {
    const result = await scanProject(
      fakeSource({ "src/a.ts": {}, "src/b.ts": {} })
    );

    expect(result.indexed.map((f) => f.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(result.cancelled).toBe(false);
  });

  it("skips default-ignored paths without reading them", async () => {
    const source = fakeSource({
      "src/a.ts": {},
      "node_modules/react/index.js": {},
    });
    const readSample = vi.spyOn(source, "readSample");

    const result = await scanProject(source);

    expect(result.indexed.map((f) => f.path)).toEqual(["src/a.ts"]);
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ reason: "ignored" })
    );
    expect(readSample).not.toHaveBeenCalledWith("node_modules/react/index.js");
  });

  it("honours a .gitignore found at the root", async () => {
    const result = await scanProject(
      fakeSource({
        ".gitignore": { text: "secrets/\n*.tmp\n" },
        "secrets/key.txt": {},
        "scratch.tmp": {},
        "src/a.ts": {},
      })
    );

    expect(result.indexed.map((f) => f.path)).toEqual([
      ".gitignore",
      "src/a.ts",
    ]);
  });

  it("skips large files with a reason", async () => {
    const result = await scanProject(
      fakeSource({ "dump.json": { size: 5_000_000 } })
    );

    expect(result.skipped).toContainEqual(
      expect.objectContaining({ path: "dump.json", reason: "large" })
    );
  });

  it("skips binaries", async () => {
    const result = await scanProject(fakeSource({ "logo.png": {} }));

    expect(result.skipped).toContainEqual(
      expect.objectContaining({ path: "logo.png", reason: "binary" })
    );
  });

  it("reports progress for every entry", async () => {
    const seen: number[] = [];

    await scanProject(fakeSource({ "a.ts": {}, "b.ts": {}, "c.ts": {} }), {
      onProgress: (p) => seen.push(p.scanned),
    });

    expect(seen).toEqual([1, 2, 3]);
  });

  it("reports the current path in progress", async () => {
    const paths: string[] = [];

    await scanProject(fakeSource({ "a.ts": {}, "b.ts": {} }), {
      onProgress: (p) => paths.push(p.currentPath),
    });

    expect(paths).toEqual(["a.ts", "b.ts"]);
  });

  it("collects a read error without failing the whole scan", async () => {
    const source = fakeSource({ "good.ts": {}, "bad.ts": {} });
    source.readSample = async (path) => {
      if (path === "bad.ts") throw new Error("EACCES: permission denied");
      return new Uint8Array([]);
    };

    const result = await scanProject(source);

    expect(result.indexed.map((f) => f.path)).toEqual(["good.ts"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ path: "bad.ts" });
    expect(result.errors[0].message).toMatch(/permission denied/);
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();

    const result = await scanProject(
      fakeSource({ "a.ts": {}, "b.ts": {}, "c.ts": {}, "d.ts": {} }),
      {
        signal: controller.signal,
        onProgress: (p) => {
          if (p.scanned === 2) controller.abort();
        },
      }
    );

    expect(result.cancelled).toBe(true);
    expect(result.indexed.length).toBeLessThan(4);
  });

  it("reports cancelled=false for a scan that finishes", async () => {
    const controller = new AbortController();

    const result = await scanProject(fakeSource({ "a.ts": {} }), {
      signal: controller.signal,
    });

    expect(result.cancelled).toBe(false);
  });

  it("returns totals that add up", async () => {
    const result = await scanProject(
      fakeSource({
        "src/a.ts": {},
        "logo.png": {},
        "node_modules/x.js": {},
        "dump.json": { size: 5_000_000 },
      })
    );

    expect(result.indexed.length + result.skipped.length).toBe(4);
  });
});

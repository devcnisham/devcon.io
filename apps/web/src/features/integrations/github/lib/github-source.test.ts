import { describe, expect, it, vi } from "vitest";
import { scanProject } from "@/features/codebase";
import { createGitHubSource } from "./github-source";
import type { GitHubClient, Tree } from "./client";

function fakeClient(tree: Tree, blobs: Record<string, string> = {}) {
  return {
    getTree: vi.fn().mockResolvedValue(tree),
    getBlob: vi
      .fn()
      .mockImplementation(async (_full: string, sha: string) =>
        new TextEncoder().encode(blobs[sha] ?? "")
      ),
  } as unknown as GitHubClient;
}

const tree: Tree = {
  truncated: false,
  entries: [
    { path: ".gitignore", isDirectory: false, size: 20, sha: "gitignore" },
    { path: "src", isDirectory: true, size: 0, sha: "d1" },
    { path: "src/index.ts", isDirectory: false, size: 100, sha: "b1" },
    { path: "logo.png", isDirectory: false, size: 50, sha: "b2" },
    { path: "node_modules/x/i.js", isDirectory: false, size: 30, sha: "b3" },
    { path: "secrets/key.txt", isDirectory: false, size: 10, sha: "b4" },
    { path: "huge.json", isDirectory: false, size: 5_000_000, sha: "b5" },
  ],
};

const blobs = { gitignore: "secrets/\n", b1: "export const a = 1;\n" };

describe("createGitHubSource", () => {
  it("satisfies ScanSource, so the existing scanner runs unchanged", async () => {
    const source = createGitHubSource(
      fakeClient(tree, blobs),
      "octocat/x",
      "main"
    );

    const result = await scanProject(source);

    expect(result.indexed.map((f) => f.path)).toEqual([
      ".gitignore",
      "src/index.ts",
    ]);
  });

  it("honours the repository's own .gitignore", async () => {
    const source = createGitHubSource(
      fakeClient(tree, blobs),
      "octocat/x",
      "main"
    );

    const result = await scanProject(source);

    expect(result.skipped).toContainEqual(
      expect.objectContaining({ path: "secrets/key.txt", reason: "ignored" })
    );
  });

  it("skips binaries and large files the same way local import does", async () => {
    const source = createGitHubSource(
      fakeClient(tree, blobs),
      "octocat/x",
      "main"
    );

    const result = await scanProject(source);

    expect(result.skipped).toContainEqual(
      expect.objectContaining({ path: "logo.png", reason: "binary" })
    );
    expect(result.skipped).toContainEqual(
      expect.objectContaining({ path: "huge.json", reason: "large" })
    );
  });

  it("fetches the tree once, not per file", async () => {
    const client = fakeClient(tree, blobs);
    const source = createGitHubSource(client, "octocat/x", "main");

    await scanProject(source);

    expect(client.getTree).toHaveBeenCalledTimes(1);
  });

  it("never downloads a blob for an ignored, binary, or oversized file", async () => {
    const client = fakeClient(tree, blobs);
    const source = createGitHubSource(client, "octocat/x", "main");

    await scanProject(source);

    const shas = (client.getBlob as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[1]
    );

    expect(shas).not.toContain("b2"); // logo.png
    expect(shas).not.toContain("b3"); // node_modules
    expect(shas).not.toContain("b5"); // huge.json
  });

  it("passes the requested ref through to the tree call", async () => {
    const client = fakeClient(tree, blobs);

    await scanProject(createGitHubSource(client, "octocat/x", "develop"));

    expect(client.getTree).toHaveBeenCalledWith("octocat/x", "develop");
  });

  it("reports a missing .gitignore without failing", async () => {
    const bare: Tree = {
      truncated: false,
      entries: [{ path: "a.ts", isDirectory: false, size: 5, sha: "s" }],
    };

    const result = await scanProject(
      createGitHubSource(fakeClient(bare), "octocat/x", "main")
    );

    expect(result.indexed.map((f) => f.path)).toEqual(["a.ts"]);
    expect(result.errors).toEqual([]);
  });
});

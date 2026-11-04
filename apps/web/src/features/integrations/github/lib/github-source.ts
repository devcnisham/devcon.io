import type { ScanEntry, ScanSource } from "@/features/codebase";
import type { GitHubClient } from "./client";

/**
 * A `ScanSource` backed by the GitHub API.
 *
 * This is the reason the scanner takes its filesystem as an argument: the same
 * `scanProject` that walks a local folder walks a remote repository, with the
 * same ignore rules, the same binary and size handling, and the same progress
 * and cancellation behaviour. No branch in the scanner mentions GitHub.
 *
 * **Nothing is cloned.** The Git Trees API returns the whole file list in one
 * request, and blobs are fetched only for the files the scanner decides to
 * index — so ignored, binary, and oversized files are never downloaded.
 */
export function createGitHubSource(
  client: GitHubClient,
  fullName: string,
  ref: string
): ScanSource {
  // The tree is fetched once and reused for the whole scan.
  let treePromise: ReturnType<GitHubClient["getTree"]> | null = null;

  function tree() {
    treePromise ??= client.getTree(fullName, ref);
    return treePromise;
  }

  async function shaFor(path: string): Promise<string> {
    const entry = (await tree()).entries.find((e) => e.path === path);
    if (!entry) throw new Error(`Not found in ${fullName}@${ref}: ${path}`);

    return entry.sha;
  }

  return {
    async *walk(): AsyncIterable<ScanEntry> {
      for (const entry of (await tree()).entries) {
        yield {
          path: entry.path,
          size: entry.size,
          isDirectory: entry.isDirectory,
        };
      }
    },

    async readSample(path) {
      // GitHub has no range request for blobs, so this fetches the file and
      // the scanner slices it. Only files that already passed the size and
      // extension checks reach here.
      return client.getBlob(fullName, await shaFor(path));
    },

    async readText(path) {
      const sha = await shaFor(path);
      return new TextDecoder().decode(await client.getBlob(fullName, sha));
    },
  };
}

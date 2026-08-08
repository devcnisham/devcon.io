import { type FileSource, isIgnored, isReadable } from "../source";

/**
 * A public GitHub repository, read over the API with no credentials.
 *
 * This is the ingest path that works for everyone, in production, in every
 * browser, with no backend — the anonymous API serves public repos, and a
 * digest is a tree call plus a handful of file reads.
 *
 * Deliberately public-only. Reading a private repo needs a token, and this
 * product does not accept a secret value anywhere — there is no field for one
 * and no column that could hold one. A private repo needs the OAuth flow that
 * lands with accounts, not a pasted PAT that quietly breaks the rule.
 */

const API = "https://api.github.com";

export interface GitHubTarget {
  owner: string;
  repo: string;
  ref?: string;
}

/** Accept anything a person would actually paste. */
export function parseRepoInput(input: string): GitHubTarget | null {
  const s = input.trim().replace(/\.git$/, "");
  if (!s) return null;

  const url =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)/.exec(s);
  if (url) return { owner: url[1], repo: url[2] };

  const slug = /^([\w.-]+)\/([\w.-]+)$/.exec(s);
  if (slug) return { owner: slug[1], repo: slug[2] };

  return null;
}

export class GitHubScanError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

async function api(path: string): Promise<Response> {
  return fetch(`${API}${path}`, {
    headers: { Accept: "application/vnd.github+json" },
  });
}

/**
 * Read the tree in ONE call rather than walking directories.
 *
 * `?recursive=1` returns every path in a single request. Walking would be one
 * request per directory, which on any real repo exhausts the 60-per-hour
 * anonymous rate limit long before the digest is complete.
 */
export async function githubSource(target: GitHubTarget): Promise<FileSource> {
  const { owner, repo } = target;

  const meta = await api(`/repos/${owner}/${repo}`);
  if (meta.status === 404) {
    throw new GitHubScanError(
      `${owner}/${repo} not found`,
      "Check the spelling. Private repositories need a sign-in DevCon doesn't have yet — use the folder picker for those.",
    );
  }
  if (meta.status === 403) {
    throw new GitHubScanError(
      "GitHub rate limit reached",
      "Anonymous requests are capped at 60 an hour. Wait, or use the folder picker, which makes no network call at all.",
    );
  }
  if (!meta.ok) {
    throw new GitHubScanError(`GitHub returned ${meta.status}`);
  }

  const info = (await meta.json()) as { default_branch: string; name: string };
  const ref = target.ref ?? info.default_branch;

  const treeRes = await api(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
  );
  if (!treeRes.ok) {
    throw new GitHubScanError(`Could not read the ${ref} tree`);
  }
  const tree = (await treeRes.json()) as {
    tree: { path: string; type: string }[];
    truncated?: boolean;
  };

  const paths = tree.tree
    .filter((e) => e.type === "blob")
    .map((e) => e.path)
    .filter((p) => !isIgnored(p));

  const cache = new Map<string, string | null>();

  return {
    label: `github.com/${owner}/${repo}`,
    name: info.name,
    async list() {
      return paths;
    },
    async read(path) {
      if (!isReadable(path)) return null;
      if (!paths.includes(path)) return null;
      if (cache.has(path)) return cache.get(path) ?? null;

      // Raw rather than the contents API: no base64 round-trip, and it doesn't
      // count against the same rate limit.
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
      );
      const text = res.ok ? await res.text() : null;
      cache.set(path, text);
      return text;
    },
    async remote() {
      // Known without reading anything — this IS the remote.
      return `https://github.com/${owner}/${repo}`;
    },
  };
}

/**
 * A small, typed GitHub REST client.
 *
 * `fetch` is injected so the client is testable without credentials or the
 * network. GitHub's response shapes are mapped onto ours at the boundary, so
 * their field names do not leak through the app.
 */

const API_ROOT = "https://api.github.com";
const API_VERSION = "2022-11-28";

export type Repository = {
  id: number;
  name: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
  language: string | null;
  sizeKb: number;
  stars: number;
  pushedAt: string | null;
  canRead: boolean;
};

export type TreeEntry = {
  path: string;
  isDirectory: boolean;
  size: number;
  sha: string;
};

export type Tree = {
  entries: TreeEntry[];
  /** GitHub caps a tree response; a truncated tree is an incomplete picture. */
  truncated: boolean;
};

export class GitHubError extends Error {
  readonly status: number;
  readonly isRateLimit: boolean;
  readonly needsReconnect: boolean;
  readonly resetAt: Date | null;

  constructor(options: {
    message: string;
    status: number;
    isRateLimit: boolean;
    needsReconnect: boolean;
    resetAt: Date | null;
  }) {
    super(options.message);
    this.name = "GitHubError";
    this.status = options.status;
    this.isRateLimit = options.isRateLimit;
    this.needsReconnect = options.needsReconnect;
    this.resetAt = options.resetAt;
  }
}

type RawRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  size: number;
  stargazers_count: number;
  pushed_at: string | null;
  permissions?: { pull?: boolean };
};

export class GitHubClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { token: string; fetch?: typeof fetch }) {
    this.token = options.token;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async request<T>(path: string, search?: Record<string, string>) {
    const url = new URL(path, API_ROOT);
    for (const [key, value] of Object.entries(search ?? {})) {
      url.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
      },
    });

    if (!response.ok) throw await this.toError(response);

    return (await response.json()) as T;
  }

  /**
   * Turns an HTTP failure into something actionable. The token is never
   * included — an error message is the easiest place to leak a credential.
   */
  private async toError(response: Response): Promise<GitHubError> {
    let message = `GitHub request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // A non-JSON error body is not worth failing over.
    }

    const remaining = response.headers.get("x-ratelimit-remaining");
    const isRateLimit = response.status === 403 && remaining === "0";
    const resetHeader = response.headers.get("x-ratelimit-reset");

    return new GitHubError({
      message: isRateLimit
        ? "GitHub's rate limit has been reached. It resets shortly — no action needed beyond waiting."
        : response.status === 401
          ? "GitHub rejected the stored credentials. Reconnect the integration."
          : message,
      status: response.status,
      isRateLimit,
      needsReconnect: response.status === 401,
      resetAt: resetHeader ? new Date(Number(resetHeader) * 1000) : null,
    });
  }

  private static toRepository(raw: RawRepository): Repository {
    return {
      id: raw.id,
      name: raw.name,
      fullName: raw.full_name,
      isPrivate: raw.private,
      defaultBranch: raw.default_branch,
      language: raw.language,
      sizeKb: raw.size,
      stars: raw.stargazers_count,
      pushedAt: raw.pushed_at,
      canRead: raw.permissions?.pull ?? true,
    };
  }

  /** Most recently pushed first — the repositories someone is actually working on. */
  async listRepositories(): Promise<Repository[]> {
    const raw = await this.request<RawRepository[]>("/user/repos", {
      sort: "pushed",
      per_page: "100",
      affiliation: "owner,collaborator,organization_member",
    });

    return raw.map(GitHubClient.toRepository);
  }

  /**
   * Filters the accessible list rather than calling GitHub's search endpoint:
   * search has a much stricter rate limit and cannot see every private
   * repository the user can already list.
   */
  async searchRepositories(query: string): Promise<Repository[]> {
    const repositories = await this.listRepositories();
    const needle = query.trim().toLowerCase();
    if (!needle) return repositories;

    return repositories.filter(
      (repository) =>
        repository.name.toLowerCase().includes(needle) ||
        repository.fullName.toLowerCase().includes(needle)
    );
  }

  async listBranches(fullName: string): Promise<string[]> {
    const raw = await this.request<Array<{ name: string }>>(
      `/repos/${fullName}/branches`,
      { per_page: "100" }
    );

    return raw.map((branch) => branch.name);
  }

  /** The whole file list for a ref, in one request. No clone required. */
  async getTree(fullName: string, ref: string): Promise<Tree> {
    const raw = await this.request<{
      truncated: boolean;
      tree: Array<{ path: string; type: string; size?: number; sha: string }>;
    }>(`/repos/${fullName}/git/trees/${ref}`, { recursive: "1" });

    return {
      truncated: raw.truncated,
      entries: raw.tree.map((entry) => ({
        path: entry.path,
        isDirectory: entry.type === "tree",
        size: entry.size ?? 0,
        sha: entry.sha,
      })),
    };
  }

  /** Raw file contents, fetched only for files the scanner decides to index. */
  async getBlob(fullName: string, sha: string): Promise<Uint8Array> {
    const url = new URL(`/repos/${fullName}/git/blobs/${sha}`, API_ROOT);

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": API_VERSION,
      },
    });

    if (!response.ok) throw await this.toError(response);

    return new Uint8Array(await response.arrayBuffer());
  }
}

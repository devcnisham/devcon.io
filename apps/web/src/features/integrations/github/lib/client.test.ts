import { describe, expect, it, vi } from "vitest";
import { GitHubClient, GitHubError } from "./client";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const repo = (name: string, extra: Record<string, unknown> = {}) => ({
  id: name.length,
  name,
  full_name: `octocat/${name}`,
  private: false,
  default_branch: "main",
  language: "TypeScript",
  size: 1024,
  stargazers_count: 3,
  pushed_at: "2026-08-01T00:00:00Z",
  permissions: { pull: true, push: false, admin: false },
  ...extra,
});

describe("authentication", () => {
  it("sends the token as a bearer credential", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = new GitHubClient({ token: "gho_secret", fetch: fetchMock });

    await client.listRepositories();

    const headers = fetchMock.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toBe("Bearer gho_secret");
  });

  it("pins the API version and accept header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = new GitHubClient({ token: "t", fetch: fetchMock });

    await client.listRepositories();

    const headers = fetchMock.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    expect(headers.Accept).toContain("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBeTruthy();
  });
});

describe("listRepositories", () => {
  it("maps GitHub's shape onto ours", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi.fn().mockResolvedValue(jsonResponse([repo("devstep")])),
    });

    const repos = await client.listRepositories();

    expect(repos[0]).toMatchObject({
      fullName: "octocat/devstep",
      defaultBranch: "main",
      language: "TypeScript",
      isPrivate: false,
      canRead: true,
    });
  });

  it("sorts by most recently pushed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = new GitHubClient({ token: "t", fetch: fetchMock });

    await client.listRepositories();

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("sort")).toBe("pushed");
  });

  it("handles a repository with no language set", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi
        .fn()
        .mockResolvedValue(jsonResponse([repo("x", { language: null })])),
    });

    const repos = await client.listRepositories();

    expect(repos[0].language).toBeNull();
  });
});

describe("searchRepositories", () => {
  it("filters the accessible list without hitting the search endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([repo("devstep"), repo("website"), repo("dev-tools")])
      );
    const client = new GitHubClient({ token: "t", fetch: fetchMock });

    const results = await client.searchRepositories("dev");

    expect(results.map((r) => r.name)).toEqual(["devstep", "dev-tools"]);
  });

  it("is case-insensitive", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi.fn().mockResolvedValue(jsonResponse([repo("DevStep")])),
    });

    expect((await client.searchRepositories("devstep")).length).toBe(1);
  });

  it("returns everything for an empty query", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi.fn().mockResolvedValue(jsonResponse([repo("a"), repo("b")])),
    });

    expect((await client.searchRepositories("  ")).length).toBe(2);
  });
});

describe("listBranches", () => {
  it("returns branch names", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse([{ name: "main" }, { name: "develop" }])
        ),
    });

    expect(await client.listBranches("octocat/devstep")).toEqual([
      "main",
      "develop",
    ]);
  });
});

describe("getTree", () => {
  it("requests the recursive tree for a ref", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        truncated: false,
        tree: [
          { path: "src/a.ts", type: "blob", size: 120, sha: "s1" },
          { path: "src", type: "tree", sha: "s2" },
        ],
      })
    );
    const client = new GitHubClient({ token: "t", fetch: fetchMock });

    const tree = await client.getTree("octocat/devstep", "main");

    expect(String(fetchMock.mock.calls[0][0])).toContain("/git/trees/main");
    expect(String(fetchMock.mock.calls[0][0])).toContain("recursive=1");
    expect(tree.entries).toHaveLength(2);
    expect(tree.entries[0]).toMatchObject({
      path: "src/a.ts",
      isDirectory: false,
      size: 120,
    });
    expect(tree.entries[1].isDirectory).toBe(true);
  });

  it("reports when GitHub truncated the tree", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi
        .fn()
        .mockResolvedValue(jsonResponse({ truncated: true, tree: [] })),
    });

    expect((await client.getTree("o/r", "main")).truncated).toBe(true);
  });
});

describe("errors", () => {
  it("throws a typed error with GitHub's message", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ message: "Not Found" }, { status: 404 })
        ),
    });

    await expect(client.listBranches("octocat/nope")).rejects.toThrow(
      GitHubError
    );
  });

  it("explains a rate limit rather than reporting a bare 403", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "rate limit exceeded" }), {
          status: 403,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "1800000000",
          },
        })
      ),
    });

    await expect(client.listRepositories()).rejects.toMatchObject({
      isRateLimit: true,
    });
  });

  it("reports an expired token as needing reconnection", async () => {
    const client = new GitHubClient({
      token: "t",
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ message: "Bad credentials" }, { status: 401 })
        ),
    });

    await expect(client.listRepositories()).rejects.toMatchObject({
      needsReconnect: true,
    });
  });

  it("never puts the token in the error message", async () => {
    const client = new GitHubClient({
      token: "gho_supersecret",
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ message: "Bad credentials" }, { status: 401 })
        ),
    });

    await expect(client.listRepositories()).rejects.toSatisfy(
      (error: Error) => !error.message.includes("gho_supersecret")
    );
  });
});

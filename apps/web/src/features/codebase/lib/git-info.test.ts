import { describe, expect, it } from "vitest";
import { parseGitConfig, parseGitHead, readGitInfo } from "./git-info";
import type { ScanSource } from "./scan";

function sourceWith(files: Record<string, string>): ScanSource {
  return {
    async *walk() {},
    async readSample() {
      return new Uint8Array([]);
    },
    async readText(path) {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    },
  };
}

describe("parseGitHead", () => {
  it("reads the branch from a symbolic ref", () => {
    expect(parseGitHead("ref: refs/heads/main\n")).toBe("main");
  });

  it("handles a branch name containing slashes", () => {
    expect(parseGitHead("ref: refs/heads/feature/import-scan\n")).toBe(
      "feature/import-scan"
    );
  });

  it("returns null for a detached HEAD", () => {
    expect(
      parseGitHead("9fceb02d0ae598e95dc970b74767f19372d61af8\n")
    ).toBeNull();
  });

  it("returns null for nonsense", () => {
    expect(parseGitHead("")).toBeNull();
  });
});

describe("parseGitConfig", () => {
  const config = `
[core]
	repositoryformatversion = 0
[remote "origin"]
	url = git@github.com:octocat/devstep.git
	fetch = +refs/heads/*:refs/remotes/origin/*
[remote "upstream"]
	url = https://github.com/upstream/devstep.git
[branch "main"]
	remote = origin
`;

  it("finds every remote", () => {
    const remotes = parseGitConfig(config);

    expect(remotes.map((r) => r.name)).toEqual(["origin", "upstream"]);
  });

  it("keeps the raw url", () => {
    expect(parseGitConfig(config)[0].url).toBe(
      "git@github.com:octocat/devstep.git"
    );
  });

  it("normalises an SSH remote to owner/repo", () => {
    expect(parseGitConfig(config)[0].repository).toBe("octocat/devstep");
  });

  it("normalises an HTTPS remote to owner/repo", () => {
    expect(parseGitConfig(config)[1].repository).toBe("upstream/devstep");
  });

  it("returns nothing when there are no remotes", () => {
    expect(parseGitConfig("[core]\n\tbare = false\n")).toEqual([]);
  });

  it("leaves a non-GitHub remote unnormalised", () => {
    const remotes = parseGitConfig(
      '[remote "origin"]\n\turl = https://gitlab.com/group/proj.git\n'
    );

    expect(remotes[0].repository).toBe("group/proj");
  });
});

describe("readGitInfo", () => {
  it("reports branch and remotes for a real repository", async () => {
    const info = await readGitInfo(
      sourceWith({
        ".git/HEAD": "ref: refs/heads/develop\n",
        ".git/config": '[remote "origin"]\n\turl = git@github.com:o/r.git\n',
      })
    );

    expect(info).toEqual({
      isRepository: true,
      branch: "develop",
      remotes: [
        {
          name: "origin",
          url: "git@github.com:o/r.git",
          repository: "o/r",
        },
      ],
      detached: false,
    });
  });

  it("reports a detached HEAD", async () => {
    const info = await readGitInfo(
      sourceWith({ ".git/HEAD": "9fceb02d0ae598e95dc970b74767f19372d61af8\n" })
    );

    expect(info.detached).toBe(true);
    expect(info.branch).toBeNull();
  });

  it("reports no repository when .git is absent", async () => {
    const info = await readGitInfo(sourceWith({}));

    expect(info).toEqual({
      isRepository: false,
      branch: null,
      remotes: [],
      detached: false,
    });
  });

  it("survives a readable HEAD with an unreadable config", async () => {
    const info = await readGitInfo(
      sourceWith({ ".git/HEAD": "ref: refs/heads/main\n" })
    );

    expect(info.isRepository).toBe(true);
    expect(info.branch).toBe("main");
    expect(info.remotes).toEqual([]);
  });
});

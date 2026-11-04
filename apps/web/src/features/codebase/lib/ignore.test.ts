import { describe, expect, it } from "vitest";
import { DEFAULT_IGNORES, createIgnore, parseGitignore } from "./ignore";

describe("parseGitignore", () => {
  it("drops blank lines and comments", () => {
    expect(parseGitignore("\n# a comment\n  \nnode_modules\n")).toEqual([
      "node_modules",
    ]);
  });

  it("keeps an escaped hash as a real pattern", () => {
    expect(parseGitignore("\\#not-a-comment")).toEqual(["\\#not-a-comment"]);
  });

  it("trims trailing whitespace but keeps an escaped trailing space", () => {
    expect(parseGitignore("build   ")).toEqual(["build"]);
  });
});

describe("basic matching", () => {
  const ig = createIgnore(["node_modules", "*.log", "dist/"]);

  it("ignores a matching directory at the root", () => {
    expect(ig.ignores("node_modules", true)).toBe(true);
  });

  it("ignores the same name at any depth", () => {
    expect(ig.ignores("packages/app/node_modules", true)).toBe(true);
  });

  it("ignores files inside an ignored directory", () => {
    expect(ig.ignores("node_modules/react/index.js", false)).toBe(true);
  });

  it("matches a wildcard extension", () => {
    expect(ig.ignores("debug.log", false)).toBe(true);
    expect(ig.ignores("logs/debug.log", false)).toBe(true);
  });

  it("leaves unmatched paths alone", () => {
    expect(ig.ignores("src/index.ts", false)).toBe(false);
  });

  it("a trailing slash matches directories only", () => {
    expect(ig.ignores("dist", true)).toBe(true);
    expect(ig.ignores("dist", false)).toBe(false);
  });
});

describe("anchoring", () => {
  const ig = createIgnore(["/build", "docs/api"]);

  it("a leading slash anchors to the root", () => {
    expect(ig.ignores("build", true)).toBe(true);
    expect(ig.ignores("packages/app/build", true)).toBe(false);
  });

  it("a pattern containing a slash is anchored too", () => {
    expect(ig.ignores("docs/api", true)).toBe(true);
    expect(ig.ignores("site/docs/api", true)).toBe(false);
  });
});

describe("negation", () => {
  const ig = createIgnore(["*.log", "!important.log"]);

  it("re-includes a negated file", () => {
    expect(ig.ignores("important.log", false)).toBe(false);
  });

  it("still ignores everything else", () => {
    expect(ig.ignores("debug.log", false)).toBe(true);
  });

  it("last matching rule wins", () => {
    const later = createIgnore(["!keep.log", "*.log"]);

    expect(later.ignores("keep.log", false)).toBe(true);
  });
});

describe("wildcards", () => {
  it("* does not cross a directory boundary", () => {
    const ig = createIgnore(["src/*.ts"]);

    expect(ig.ignores("src/index.ts", false)).toBe(true);
    expect(ig.ignores("src/nested/index.ts", false)).toBe(false);
  });

  it("** crosses directory boundaries", () => {
    const ig = createIgnore(["src/**/*.test.ts"]);

    expect(ig.ignores("src/a/b/thing.test.ts", false)).toBe(true);
  });

  it("? matches exactly one character", () => {
    const ig = createIgnore(["file?.txt"]);

    expect(ig.ignores("file1.txt", false)).toBe(true);
    expect(ig.ignores("file12.txt", false)).toBe(false);
  });

  it("treats a dot literally, not as a regex wildcard", () => {
    const ig = createIgnore(["config.json"]);

    expect(ig.ignores("configXjson", false)).toBe(false);
  });
});

describe("defaults", () => {
  const ig = createIgnore(DEFAULT_IGNORES);

  it("skips the usual heavy directories", () => {
    for (const dir of ["node_modules", ".git", ".next", "dist", "build"]) {
      expect(ig.ignores(dir, true), `${dir} should be ignored`).toBe(true);
    }
  });

  it("does not skip source directories", () => {
    for (const dir of ["src", "app", "lib", "components"]) {
      expect(ig.ignores(dir, true), `${dir} should not be ignored`).toBe(false);
    }
  });

  it("does not skip a lockfile — it identifies the package manager", () => {
    expect(ig.ignores("package-lock.json", false)).toBe(false);
  });
});

describe("combining sources", () => {
  it("applies defaults and .gitignore together", () => {
    const ig = createIgnore([
      ...DEFAULT_IGNORES,
      ...parseGitignore("secrets/"),
    ]);

    expect(ig.ignores("node_modules", true)).toBe(true);
    expect(ig.ignores("secrets", true)).toBe(true);
  });

  it("lets a .gitignore negation override a default", () => {
    const ig = createIgnore([...DEFAULT_IGNORES, "!dist"]);

    expect(ig.ignores("dist", true)).toBe(false);
  });
});

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { detectProject, gaps, stackLine } from "../lib/detect.ts";

/**
 * Reading a project from its files.
 *
 * Every case builds a real folder and asks what devcon sees in it. The ones
 * that matter are the negatives: a gap reported for a file that is actually
 * there would send a student to fix something that is fine, and a gap *not*
 * reported for a committed `.env` is a leaked key.
 */

const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function project(
  files: Record<string, string>,
  folders: string[] = [],
): string {
  const dir = mkdtempSync(join(tmpdir(), "devcon-detect-"));
  dirs.push(dir);
  for (const f of folders) mkdirSync(join(dir, f), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

const pkg = (deps: Record<string, string>) =>
  JSON.stringify({ dependencies: deps });

describe("detectProject", () => {
  test("names the framework, language and package manager", async () => {
    const d = await detectProject(
      project({
        "package.json": pkg({ next: "16.0.0", react: "19.0.0" }),
        "tsconfig.json": "{}",
        "pnpm-lock.yaml": "",
      }),
    );
    assert.equal(d.framework, "Next.js");
    assert.equal(d.language, "TypeScript");
    assert.equal(d.packageManager, "pnpm");
    assert.equal(stackLine(d), "Next.js · TypeScript · pnpm");
  });

  test("picks the more specific framework when both are present", async () => {
    // Every Next project also depends on react. Reporting "React" would be
    // true and useless.
    const d = await detectProject(
      project({ "package.json": pkg({ react: "19", next: "16" }) }),
    );
    assert.equal(d.framework, "Next.js");
  });

  test("an unknown stack is null, not a guess", async () => {
    const d = await detectProject(project({ "main.py": "print(1)" }));
    assert.equal(d.framework, null);
    assert.equal(d.language, null);
    assert.equal(d.packageManager, null);
    assert.equal(stackLine(d), "");
  });

  test("a missing folder does not throw", async () => {
    const d = await detectProject("/definitely/not/here");
    assert.equal(d.hasGit, false);
    assert.equal(d.envCommitted, false);
  });

  test("finds tests under any of the usual directory names", async () => {
    for (const name of ["test", "tests", "__tests__", "spec"]) {
      const d = await detectProject(project({}, [name]));
      assert.equal(d.hasTests, true, name);
    }
    assert.equal((await detectProject(project({}))).hasTests, false);
  });

  test("CI counts from GitHub, GitLab or CircleCI", async () => {
    assert.equal(
      (await detectProject(project({}, [".github/workflows"]))).hasCi,
      true,
    );
    assert.equal(
      (await detectProject(project({ ".gitlab-ci.yml": "" }))).hasCi,
      true,
    );
    assert.equal((await detectProject(project({}))).hasCi, false);
  });
});

describe("the committed-secret check", () => {
  test("a .env with no .gitignore is reported", async () => {
    const d = await detectProject(project({ ".env": "KEY=1" }));
    assert.equal(d.envCommitted, true);
    assert.equal(gaps(d)[0].id, "env");
    assert.equal(gaps(d)[0].urgent, true);
  });

  test("a .env covered by .gitignore is not", async () => {
    const d = await detectProject(
      project({ ".env": "KEY=1", ".gitignore": "node_modules\n.env*\n" }),
    );
    assert.equal(d.envCommitted, false);
    assert.equal(
      gaps(d).some((g) => g.id === "env"),
      false,
    );
  });

  test("a .gitignore that does not mention .env still counts as a leak", async () => {
    // The dangerous case: an ignore file exists, so it looks handled.
    const d = await detectProject(
      project({ ".env.local": "KEY=1", ".gitignore": "node_modules\n.next\n" }),
    );
    assert.equal(d.envCommitted, true);
  });

  test("no .env at all is not a leak", async () => {
    const d = await detectProject(project({ ".gitignore": "node_modules" }));
    assert.equal(d.envCommitted, false);
  });
});

describe("gaps", () => {
  test("a bare folder is missing everything, urgent first", async () => {
    const d = await detectProject(project({}));
    const ids = gaps(d).map((g) => g.id);
    assert.deepEqual(ids, ["git", "ignore", "spec", "readme", "tests", "ci"]);
  });

  test("a complete project reports nothing", async () => {
    const d = await detectProject(
      project(
        {
          "README.md": "#",
          "SHIP.md": "#",
          ".gitignore": ".env",
          ".env": "K=1",
        },
        [".git", "test", ".github/workflows"],
      ),
    );
    // If this ever returns a row, the detector is inventing work.
    assert.deepEqual(gaps(d), []);
  });
});

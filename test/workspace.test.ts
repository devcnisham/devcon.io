import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { adoptOrphanProjects, listProjects } from "../lib/projects.ts";
import {
  activeWorkspace,
  createWorkspace,
  listWorkspaces,
  migrateLegacyStore,
  renameWorkspace,
  setActiveWorkspace,
  validateWorkspaceName,
} from "../lib/workspace.ts";

/**
 * Workspaces — feature 003, phase 0.
 *
 * The assertions that matter are the migration ones. Everything else here is
 * new code with no users; the migration runs against a file that already exists
 * on the only machine devcon has ever run on, and getting it wrong loses
 * someone's project list.
 */

let dir = "";
const ws = () => join(dir, "workspaces.json");
const projects = () => join(dir, "projects.json");
const active = () => join(dir, "active-workspace.json");

const OWNER = "user-1";

before(() => {
  dir = mkdtempSync(join(tmpdir(), "devcon-ws-"));
});
after(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("naming a workspace", () => {
  test("empty is refused, long is refused, ordinary is fine", () => {
    assert.equal(validateWorkspaceName(""), "name-empty");
    assert.equal(validateWorkspaceName("   "), "name-empty");
    assert.equal(validateWorkspaceName("a".repeat(61)), "name-long");
    assert.equal(validateWorkspaceName("Client work"), null);
    assert.equal(validateWorkspaceName("仕事"), null);
  });
});

describe("the legacy store is moved, not overwritten", () => {
  test("a workspaces.json full of folders becomes projects.json", async () => {
    // Exactly the shape feature 000 wrote, and the shape on the one machine
    // that has ever run devcon.
    const legacy = [
      {
        path: "/Users/someone/Desktop/devcon-io",
        name: "devcon-io",
        addedAt: 1,
        lastOpenedAt: 2,
      },
    ];
    writeFileSync(ws(), JSON.stringify(legacy, null, 2));

    await migrateLegacyStore(ws(), projects());

    const moved = JSON.parse(readFileSync(projects(), "utf8"));
    assert.equal(moved.length, 1);
    assert.equal(moved[0].path, "/Users/someone/Desktop/devcon-io");

    // Retired under a name nothing reads, rather than deleted. If any of this
    // was wrong the original is still there.
    assert.ok(existsSync(`${ws()}.legacy`), "the legacy file was destroyed");
    assert.ok(!existsSync(ws()), "the legacy file is still in the way");
  });

  test("running it again changes nothing", async () => {
    const before = readFileSync(projects(), "utf8");
    await migrateLegacyStore(ws(), projects());
    assert.equal(readFileSync(projects(), "utf8"), before);
  });

  test("it never clobbers a projects.json that already exists", async () => {
    const d = mkdtempSync(join(tmpdir(), "devcon-ws2-"));
    const w = join(d, "workspaces.json");
    const p = join(d, "projects.json");
    writeFileSync(w, JSON.stringify([{ path: "/old", name: "old" }]));
    writeFileSync(p, JSON.stringify([{ path: "/real", name: "real" }]));

    await migrateLegacyStore(w, p);

    // The real list wins. A migration that deletes the thing it was meant to
    // preserve is worse than one that does not run.
    const kept = JSON.parse(readFileSync(p, "utf8"));
    assert.equal(kept[0].path, "/real");
    rmSync(d, { recursive: true, force: true });
  });

  test("a file of real workspaces is left alone", async () => {
    const d = mkdtempSync(join(tmpdir(), "devcon-ws3-"));
    const w = join(d, "workspaces.json");
    const rows = [{ id: "a", ownerId: OWNER, name: "Personal", createdAt: 1 }];
    writeFileSync(w, JSON.stringify(rows));

    await migrateLegacyStore(w, join(d, "projects.json"));

    // No `path` anywhere, so nothing to migrate — and the file must survive.
    assert.deepEqual(JSON.parse(readFileSync(w, "utf8")), rows);
    rmSync(d, { recursive: true, force: true });
  });
});

describe("workspaces", () => {
  test("everyone gets one on first use, without being asked", async () => {
    const w = await activeWorkspace(OWNER, ws(), active());
    assert.equal(w.ownerId, OWNER);
    assert.ok(w.name.length > 0);

    // Called twice it is the same one, not a second.
    const again = await activeWorkspace(OWNER, ws(), active());
    assert.equal(again.id, w.id);
    assert.equal((await listWorkspaces(OWNER, ws())).length, 1);
  });

  test("projects from before feature 003 are adopted, not hidden", async () => {
    const w = await activeWorkspace(OWNER, ws(), active());
    // The migrated row has no workspaceId at all.
    const orphans = await listProjects(undefined, projects());
    assert.equal(orphans.length, 1);
    assert.equal(orphans[0].workspaceId, undefined);

    const adopted = await adoptOrphanProjects(w.id, projects());
    assert.equal(adopted, 1);

    const inWorkspace = await listProjects(w.id, projects());
    assert.equal(inWorkspace.length, 1, "the project list emptied itself");

    // Idempotent — the second call has nothing left to do.
    assert.equal(await adoptOrphanProjects(w.id, projects()), 0);
  });

  test("a second workspace is separate, and switching is remembered", async () => {
    const made = await createWorkspace(OWNER, "  Client   work  ", ws());
    assert.equal(made.ok, true);
    if (!made.ok) return;
    assert.equal(made.workspace.name, "Client work");

    await setActiveWorkspace(OWNER, made.workspace.id, active());
    const now = await activeWorkspace(OWNER, ws(), active());
    assert.equal(now.id, made.workspace.id);

    // The new one is empty; the first one still has its project.
    assert.equal((await listProjects(now.id, projects())).length, 0);
    const [first] = await listWorkspaces(OWNER, ws());
    assert.equal((await listProjects(first.id, projects())).length, 1);
  });

  test("another account cannot see or rename yours", async () => {
    const [mine] = await listWorkspaces(OWNER, ws());
    assert.equal((await listWorkspaces("someone-else", ws())).length, 0);

    const attempt = await renameWorkspace(
      "someone-else",
      mine.id,
      "Hijacked",
      ws(),
    );
    assert.equal(attempt.ok, false);
    if (attempt.ok) return;
    // Indistinguishable from a workspace that does not exist — the owner is
    // part of the lookup rather than a check after it.
    assert.equal(attempt.error, "not-found");

    const [unchanged] = await listWorkspaces(OWNER, ws());
    assert.equal(unchanged.name, mine.name);
  });

  test("a bad name is refused on create and on rename", async () => {
    const empty = await createWorkspace(OWNER, "   ", ws());
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.error, "name-empty");

    const [mine] = await listWorkspaces(OWNER, ws());
    const long = await renameWorkspace(OWNER, mine.id, "a".repeat(61), ws());
    assert.equal(long.ok, false);
    if (!long.ok) assert.equal(long.error, "name-long");
  });

  test("pointing the preference at a stranger's workspace falls back to your own", async () => {
    await setActiveWorkspace(OWNER, "not-a-workspace-of-mine", active());
    const w = await activeWorkspace(OWNER, ws(), active());
    assert.equal(
      w.ownerId,
      OWNER,
      "resolved to a workspace this account does not own",
    );
  });
});

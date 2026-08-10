import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import {
  defaultPosition,
  layoutFile,
  loadLayout,
  sanitize,
  saveLayout,
} from "../lib/canvas.ts";

/**
 * Where the canvas cards sit.
 *
 * The layout file is the one thing the canvas persists, and it is read back
 * into style attributes — so the cases that matter are the malformed ones. A
 * hand-edited or corrupt file must not throw, must not move a card somewhere
 * unreachable, and must not carry anything but numbers.
 */

const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "devcon-canvas-"));
  dirs.push(d);
  return d;
};

describe("layoutFile", () => {
  test("turns any path into a safe filename", () => {
    const dir = "/store";
    for (const p of ["/a/b", "/with space/x", "/../../etc", "/emoji-🙂"]) {
      const f = layoutFile(p, dir);
      assert.ok(f.startsWith(`${dir}/`), f);
      // A path traversal in a project path must not escape the store.
      assert.ok(!f.slice(dir.length + 1).includes("/"), f);
      assert.match(f, /\/[0-9a-f]{16}\.json$/);
    }
  });

  test("different projects get different files, the same one is stable", () => {
    assert.notEqual(layoutFile("/a"), layoutFile("/b"));
    assert.equal(layoutFile("/a"), layoutFile("/a"));
  });
});

describe("sanitize", () => {
  test("keeps whole finite numbers", () => {
    assert.deepEqual(sanitize({ a: { x: 10.6, y: -3.2 } }), {
      a: { x: 11, y: -3 },
    });
  });

  test("drops anything that is not a pair of numbers", () => {
    const out = sanitize({
      ok: { x: 1, y: 2 },
      nan: { x: "abc", y: 2 },
      inf: { x: Number.POSITIVE_INFINITY, y: 0 },
      nul: null,
      missing: { x: 5 },
    });
    assert.deepEqual(Object.keys(out), ["ok"]);
  });

  test("clamps a card that would be dragged out of reach", () => {
    const out = sanitize({ far: { x: 1e9, y: -1e9 } });
    assert.deepEqual(out.far, { x: 20_000, y: -20_000 });
  });

  test("junk in, empty out — never a throw", () => {
    for (const junk of [null, undefined, 42, "nope", []]) {
      assert.deepEqual(sanitize(junk), {});
    }
  });
});

describe("loadLayout / saveLayout", () => {
  test("round-trips", async () => {
    const dir = tmp();
    await saveLayout("/p", { a: { x: 1, y: 2 } }, dir);
    assert.deepEqual(await loadLayout("/p", dir), { a: { x: 1, y: 2 } });
  });

  test("no file yet is an empty layout, not an error", async () => {
    assert.deepEqual(await loadLayout("/never-saved", tmp()), {});
  });

  test("a corrupt file is an empty layout, not a crash", async () => {
    const dir = tmp();
    writeFileSync(layoutFile("/p", dir), "{ not json");
    assert.deepEqual(await loadLayout("/p", dir), {});
  });

  test("junk written by hand is filtered on the way back in", async () => {
    const dir = tmp();
    writeFileSync(
      layoutFile("/p", dir),
      JSON.stringify({ good: { x: 3, y: 4 }, bad: { x: "x", y: 1 } }),
    );
    assert.deepEqual(await loadLayout("/p", dir), { good: { x: 3, y: 4 } });
  });

  test("two projects do not share a layout", async () => {
    const dir = tmp();
    await saveLayout("/one", { a: { x: 1, y: 1 } }, dir);
    await saveLayout("/two", { a: { x: 9, y: 9 } }, dir);
    assert.deepEqual(await loadLayout("/one", dir), { a: { x: 1, y: 1 } });
  });
});

describe("defaultPosition", () => {
  test("columns by kind, rows by index — never a pile at the origin", () => {
    assert.deepEqual(defaultPosition(0, 0), { x: 40, y: 40 });
    assert.notDeepEqual(defaultPosition(1, 0), defaultPosition(0, 0));
    assert.notDeepEqual(defaultPosition(0, 1), defaultPosition(0, 0));
  });
});

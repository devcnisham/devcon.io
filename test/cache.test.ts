import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { ageLabel, checkedSpec, clearCache } from "../lib/ship/cache.ts";

/**
 * The shared check run.
 *
 * Both views show verdicts, and running every command once per view put the
 * round trip between them at roughly thirteen seconds each way. Caching that is
 * only defensible if it stays honest, so these assert the two things that make
 * it honest: it expires, and an edit to `SHIP.md` beats the clock.
 *
 * Each case gets its own temp directory. The cache is keyed by cwd, so sharing
 * one would let an earlier test satisfy a later one — a pass that proves
 * nothing.
 */

const dirs: string[] = [];

function spec(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "devcon-cache-"));
  dirs.push(dir);
  writeFileSync(join(dir, "SHIP.md"), body);
  return dir;
}

const MINIMAL = `# Temp

**One sentence.**

## Done when

- [ ] a command that answers immediately
      \`check: exit 0\`
`;

after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  clearCache();
});

describe("checkedSpec", () => {
  test("a second call inside the TTL reuses the first run", async () => {
    const dir = spec(MINIMAL);
    const one = await checkedSpec(dir, { ttlMs: 60_000 });
    const two = await checkedSpec(dir, { ttlMs: 60_000 });

    assert.ok(one && two);
    // Same instant means the commands did not run again. Comparing verdicts
    // would pass either way, which is the trap.
    assert.equal(two.at, one.at);
  });

  test("…and re-runs once the TTL is past", async () => {
    const dir = spec(MINIMAL);
    let clock = 1_000;
    const now = () => clock;

    const one = await checkedSpec(dir, { ttlMs: 5_000, now });
    clock += 5_001;
    const two = await checkedSpec(dir, { ttlMs: 5_000, now });

    assert.ok(one && two);
    assert.notEqual(two.at, one.at);
    assert.equal(two.at, clock);
  });

  test("editing SHIP.md beats the clock — content wins over the TTL", async () => {
    const dir = spec(MINIMAL);
    const one = await checkedSpec(dir, { ttlMs: 60_000 });

    // Same instant, so only the changed bytes can force a re-run. Seeing
    // yesterday's verdicts after an edit would be worse than any slow render.
    writeFileSync(
      join(dir, "SHIP.md"),
      MINIMAL.replace("One sentence.", "A different sentence."),
    );
    const two = await checkedSpec(dir, { ttlMs: 60_000 });

    assert.ok(one && two);
    assert.equal(two.spec.shipping, "A different sentence.");
    assert.notEqual(two.at, one.at);
  });

  test("no SHIP.md is null, not an error — the repo has not started", async () => {
    const dir = mkdtempSync(join(tmpdir(), "devcon-cache-none-"));
    dirs.push(dir);
    assert.equal(await checkedSpec(dir), null);
  });
});

describe("ageLabel", () => {
  test("reads plainly at every scale", () => {
    const now = 1_000_000;
    assert.equal(ageLabel(now, now), "just now");
    assert.equal(ageLabel(now - 8_000, now), "8s ago");
    assert.equal(ageLabel(now - 120_000, now), "2m ago");
  });

  test("never reports a negative age", () => {
    const now = 1_000_000;
    assert.equal(ageLabel(now + 5_000, now), "just now");
  });
});

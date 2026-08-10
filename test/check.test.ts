import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkAll } from "../lib/ship/check.ts";
import type { Condition } from "../lib/ship/parse.ts";

/**
 * The checker's own behaviour, separate from the sandbox it runs things in.
 *
 * These exist because of a defect that had no test and could not have been
 * caught by reading: a fixed 20s timeout with every check running at once made
 * a verdict depend on the machine. The same repo reported five passing
 * conditions and then four, minutes apart, because a text editor was busy.
 *
 * The timeout is a parameter rather than a constant precisely so this file can
 * drive it to a second instead of waiting two minutes to find out.
 */

const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const cond = (text: string, check: string): Condition => ({
  text,
  claimed: false,
  check,
});

describe("a timeout is not a failure", () => {
  test("a check that outruns its budget is `error`, never `fail`", async () => {
    const [r] = await checkAll([cond("slow", "sleep 30")], REPO, {
      timeoutMs: 1_000,
    });

    // The whole point. `fail` would send a reader to fix a condition that was
    // never answered, which is what the 20s version did to `tsc` under load.
    assert.equal(r.verdict, "error");
    assert.notEqual(r.verdict, "fail");
  });

  test("…and says so, including that a busy machine is the usual cause", async () => {
    const [r] = await checkAll([cond("slow", "sleep 30")], REPO, {
      timeoutMs: 1_000,
    });
    assert.match(r.evidence, /not a failed condition/i);
    assert.match(r.evidence, /re-run/i);
    // The budget it was given, so the reader can tell 1s from 120s.
    assert.match(r.evidence, /1s/);
  });

  test("a command that runs and says no is still `fail`", async () => {
    const [r] = await checkAll([cond("no", "exit 1")], REPO, {
      timeoutMs: 30_000,
    });
    // If this ever reads `error`, the two cases have been collapsed and the
    // distinction above is worthless.
    assert.equal(r.verdict, "fail");
  });

  test("a slow check that finishes inside its budget passes", async () => {
    const [r] = await checkAll([cond("slow but fine", "sleep 2")], REPO, {
      timeoutMs: 30_000,
    });
    assert.equal(r.verdict, "pass", r.evidence);
    assert.ok(r.ms >= 1_800, `took ${r.ms}ms, expected ~2000`);
  });
});

describe("concurrency is bounded", () => {
  test("one at a time really is one at a time", async () => {
    const started = Date.now();
    const checked = await checkAll(
      ["a", "b", "c"].map((n) => cond(n, "sleep 1")),
      REPO,
      { concurrency: 1, timeoutMs: 30_000 },
    );
    const total = Date.now() - started;

    assert.equal(checked.length, 3);
    // Serial is the observable property. Asserting the *fast* direction would
    // be a timing race on a loaded machine — which is the bug this file exists
    // for, and no test should reintroduce it.
    assert.ok(
      total >= 2_700,
      `three 1s checks took ${total}ms, expected ~3000`,
    );
  });

  test("results come back in the order given, not the order they finished", async () => {
    const checked = await checkAll(
      [cond("slow first", "sleep 2"), cond("fast second", "exit 0")],
      REPO,
      { concurrency: 4, timeoutMs: 30_000 },
    );
    assert.deepEqual(
      checked.map((c) => c.text),
      ["slow first", "fast second"],
    );
  });
});

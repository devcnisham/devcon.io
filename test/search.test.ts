import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Checked } from "../lib/ship/check.ts";
import type { Spec } from "../lib/ship/parse.ts";
import { filterSpec, oneParam } from "../lib/ship/search.ts";

/**
 * The workspace filter.
 *
 * Pure over its inputs, so none of this needs a browser. The cases that matter
 * are the ones where a filter quietly loses a row: an empty query, a query
 * that only differs by case, and a query containing characters that would
 * blow up if this ever became a regex.
 */

const cond = (text: string, extra: Partial<Checked> = {}): Checked => ({
  text,
  claimed: false,
  verdict: "pass",
  evidence: "",
  ms: 1,
  ...extra,
});

const CHECKED: Checked[] = [
  cond("Lint is clean and stays a gate", { check: "pnpm lint" }),
  cond("v0.1 is frozen and reachable", {
    check: "git rev-parse --verify v0.1-archive",
    evidence: "0994fce3fdc331d0872ec235a9ed30c72bdba502",
  }),
  cond("The surface typechecks", {
    check: "pnpm exec tsc --noEmit",
    verdict: "fail",
    evidence: "Could not resolve host: github.com",
  }),
];

const SPEC: Spec = {
  name: "Ship",
  shipping: "One sentence.",
  deadline: null,
  cuts: [{ thing: "A step catalog", reason: "the plan is not knowable" }],
  conditions: [],
  assumptions: ["A spec is more useful than a plan"],
};

const TOTAL = CHECKED.length + SPEC.cuts.length + SPEC.assumptions.length;

describe("filterSpec", () => {
  test("an empty query returns everything, untouched", () => {
    for (const q of [undefined, "", "   "]) {
      const r = filterSpec(SPEC, CHECKED, q);
      assert.equal(r.conditions.length, CHECKED.length, `query ${q}`);
      assert.equal(r.cuts.length, 1);
      assert.equal(r.assumptions.length, 1);
      assert.equal(r.query, "");
      assert.equal(r.matches, TOTAL);
    }
  });

  test("matches a condition's prose, ignoring case", () => {
    const r = filterSpec(SPEC, CHECKED, "LINT");
    assert.deepEqual(
      r.conditions.map((c) => c.text),
      ["Lint is clean and stays a gate"],
    );
  });

  test("matches the command, not just the prose", () => {
    const r = filterSpec(SPEC, CHECKED, "--noEmit");
    assert.deepEqual(
      r.conditions.map((c) => c.text),
      ["The surface typechecks"],
    );
  });

  test("matches the evidence — the reason searching this page is useful", () => {
    // Looking up a hash or an error string you just saw in the output is the
    // real use. Matching only the prose would miss every one of those.
    const byHash = filterSpec(SPEC, CHECKED, "0994fce3");
    assert.deepEqual(
      byHash.conditions.map((c) => c.text),
      ["v0.1 is frozen and reachable"],
    );

    const byError = filterSpec(SPEC, CHECKED, "could not resolve host");
    assert.deepEqual(
      byError.conditions.map((c) => c.text),
      ["The surface typechecks"],
    );
  });

  test("matches a verdict, so `fail` narrows to what is failing", () => {
    const r = filterSpec(SPEC, CHECKED, "fail");
    assert.deepEqual(
      r.conditions.map((c) => c.text),
      ["The surface typechecks"],
    );
  });

  test("terms are ANDed and order-independent", () => {
    assert.equal(filterSpec(SPEC, CHECKED, "lint gate").conditions.length, 1);
    assert.equal(filterSpec(SPEC, CHECKED, "gate lint").conditions.length, 1);
    // Both terms must appear somewhere, or the row is out.
    assert.equal(filterSpec(SPEC, CHECKED, "lint frozen").conditions.length, 0);
  });

  test("searches cuts and assumptions too, not only conditions", () => {
    const cut = filterSpec(SPEC, CHECKED, "catalog");
    assert.equal(cut.cuts.length, 1);
    assert.equal(cut.conditions.length, 0);
    assert.equal(cut.matches, 1);

    // The reason, not just the name — a cut without its reason is an omission.
    assert.equal(filterSpec(SPEC, CHECKED, "knowable").cuts.length, 1);
    assert.equal(
      filterSpec(SPEC, CHECKED, "more useful").assumptions.length,
      1,
    );
  });

  test("no match is zero rows, and says which query found nothing", () => {
    const r = filterSpec(SPEC, CHECKED, "kubernetes");
    assert.equal(r.matches, 0);
    assert.equal(r.conditions.length + r.cuts.length + r.assumptions.length, 0);
    assert.equal(r.query, "kubernetes");
    assert.equal(r.total, TOTAL);
  });

  test("regex metacharacters are literal, not a pattern", () => {
    // If this ever became `new RegExp(query)`, `(` throws and `.*` matches
    // everything — a filter that silently shows all rows is worse than one
    // that shows none.
    for (const q of ["(", "[", "*", ".*", "a|b", "\\"]) {
      const r = filterSpec(SPEC, CHECKED, q);
      assert.ok(r.matches <= TOTAL, `query ${q} over-matched`);
    }
    assert.equal(filterSpec(SPEC, CHECKED, ".*").matches, 0);
  });

  test("the query is trimmed but otherwise reported as typed", () => {
    assert.equal(filterSpec(SPEC, CHECKED, "  lint  ").query, "lint");
  });
});

describe("oneParam", () => {
  test("takes the first when a param repeats", () => {
    // `?q=a&q=b` must not become a search for a string nobody typed.
    assert.equal(oneParam(["a", "b"]), "a");
    assert.equal(oneParam("a"), "a");
    assert.equal(oneParam(undefined), undefined);
  });
});

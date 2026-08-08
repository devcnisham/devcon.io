import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_STATS } from "@/lib/catalog/stats";
import {
  countTestCases,
  describeDrift,
  docValues,
  missingMarkers,
  SYNCED_FILES,
  syncText,
  testFiles,
} from "@/lib/docs/sync";

const root = join(import.meta.dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const testSources = testFiles(root).map((f) => read(join("test", f)));

describe("the documented numbers agree with the code", () => {
  it("has no drift in any synced file", () => {
    /**
     * The gate this whole mechanism exists for. Before it, README.md claimed
     * 209 tests and "4 of 62 prompts" while the code said 248 and 63 — nothing
     * anywhere noticed, because prose has no compiler.
     *
     * Asserted as a rendered report rather than a boolean so the failure names
     * the file, the key and both numbers instead of going red silently.
     */
    const values = docValues(countTestCases(testSources));
    const drift = [];
    const unknown: string[] = [];
    for (const file of SYNCED_FILES) {
      const r = syncText(file, read(file), values);
      drift.push(...r.drift);
      unknown.push(...r.unknown);
    }
    expect(describeDrift(drift, unknown)).toBe("");
  });

  it("still carries every marker it is supposed to", () => {
    /**
     * Without this the test above is green against a repo where the markers
     * were deleted — it would be checking nothing, which is the failure mode
     * this project has hit six times.
     *
     * The first version counted markers and required at least ten.
     * Mutation-testing walked straight through it: deleting one marker from
     * README.md left twelve, so the number went back to hand-maintained and
     * nothing complained. Pinned per key per file instead.
     */
    const problems = SYNCED_FILES.flatMap((f) => missingMarkers(f, read(f)));
    expect(problems).toEqual([]);
  });
});

describe("the counting itself", () => {
  it("counts test cases the same way vitest does", () => {
    /**
     * The number in the README is a static count of `it(`/`test(` across
     * test/, because asserting a number that a run produces, during that run,
     * is circular. That only holds while the two agree — they did at 248, and
     * this fails the moment a form appears that the regex cannot see (a
     * templated name, a generated case, a helper that wraps `it`).
     *
     * The cross-check is structural: every file the glob found must contribute
     * at least one case, so a file the regex cannot read shows up here rather
     * than silently lowering the total.
     */
    expect(testSources.length).toBeGreaterThan(5);
    const perFile = testSources.map((s) => countTestCases([s]));
    expect(perFile.filter((n) => n === 0)).toEqual([]);
    expect(countTestCases(testSources)).toBe(
      perFile.reduce((a, b) => a + b, 0),
    );
  });

  it("derives every stat from the catalog rather than a literal", () => {
    // Each track's do-steps must sum to the total, or `trackOf` is dropping
    // steps into a track that doesn't exist and the per-track rows in
    // HANDOFF.md would quietly under-report.
    const summed =
      CATALOG_STATS.academicDo +
      CATALOG_STATS.competitionDo +
      CATALOG_STATS.commercialDo;
    expect(summed).toBe(CATALOG_STATS.doSteps);

    const anti =
      CATALOG_STATS.academicAnti +
      CATALOG_STATS.competitionAnti +
      CATALOG_STATS.commercialAnti;
    expect(anti).toBe(CATALOG_STATS.antiSteps);

    // Execution modes partition the do-steps exactly.
    expect(
      CATALOG_STATS.agent + CATALOG_STATS.needsInput + CATALOG_STATS.human,
    ).toBe(CATALOG_STATS.doSteps);

    // So does verification state.
    expect(
      CATALOG_STATS.verified + CATALOG_STATS.partial + CATALOG_STATS.unverified,
    ).toBe(CATALOG_STATS.doSteps);
  });
});

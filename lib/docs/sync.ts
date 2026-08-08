import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CATALOG_STATS } from "../catalog/stats";

/**
 * Keeps the numbers in the markdown honest.
 *
 * Prose stays hand-written; only the spans between markers are owned by this
 * file. That split is deliberate — generating whole documents produces the kind
 * of README nobody reads, and leaving the numbers by hand produced the one this
 * repo already had, which claimed 209 tests and "4 of 62 prompts" months apart
 * from the truth.
 *
 * ## What is deliberately NOT synced
 *
 * Historical statements. `docs/gaps-plan.md` is explicitly a point-in-time plan
 * and HANDOFF.md's session logs record what was true when they were written —
 * "79 tests written this session", "all 33 tests still green". Rewriting those
 * to today's numbers would not fix a stale document, it would falsify a record.
 * Only present-tense claims about current state carry markers.
 */

/** `<!--catalog:doSteps-->63<!--/catalog-->` */
const MARKER =
  /(<!--\s*catalog:([A-Za-z]+)\s*-->)([\s\S]*?)(<!--\s*\/catalog\s*-->)/g;

export interface Drift {
  file: string;
  key: string;
  found: string;
  expected: string;
}

/**
 * Test count, derived from the test files rather than from a run.
 *
 * Counting `it(` and `test(` statically is what makes this checkable from
 * inside the suite at all — asserting a number that a run produces, during that
 * run, is circular. Verified against `vitest run`: both say the same thing, and
 * the test below fails if they ever stop agreeing.
 */
export function countTestCases(sources: string[]): number {
  return sources.reduce(
    (n, src) => n + (src.match(/^\s*(?:it|test)(?:\.\w+)?\(/gm)?.length ?? 0),
    0,
  );
}

/** Every value a marker may reference. */
export function docValues(testCount: number): Record<string, string> {
  const out: Record<string, string> = { tests: String(testCount) };
  for (const [k, v] of Object.entries(CATALOG_STATS)) out[k] = String(v);
  return out;
}

export interface SyncResult {
  text: string;
  drift: Drift[];
  /** Markers naming something `docValues` doesn't provide. */
  unknown: string[];
}

/**
 * Rewrite every marked span to its current value.
 *
 * Returns the corrected text plus what was wrong, so one pass serves both
 * `--write` and `--check` rather than the two drifting apart.
 */
export function syncText(
  file: string,
  text: string,
  values: Record<string, string>,
): SyncResult {
  const drift: Drift[] = [];
  const unknown: string[] = [];

  const next = text.replace(MARKER, (whole, open, key: string, body, close) => {
    const expected = values[key];
    if (expected === undefined) {
      unknown.push(key);
      return whole;
    }
    if (body !== expected) {
      drift.push({ file, key, found: body, expected });
    }
    return `${open}${expected}${close}`;
  });

  return { text: next, drift, unknown };
}

/** Human-readable, because a failing check should say what to run. */
export function describeDrift(drift: Drift[], unknown: string[]): string {
  const lines: string[] = [];
  for (const d of drift) {
    lines.push(
      `  ${d.file} — ${d.key}: says ${JSON.stringify(d.found)}, catalog says ${JSON.stringify(d.expected)}`,
    );
  }
  for (const u of unknown) {
    lines.push(`  unknown marker: catalog:${u} — no such value`);
  }
  if (!lines.length) return "";
  return [
    `${lines.length} documented number${lines.length === 1 ? "" : "s"} disagree${lines.length === 1 ? "s" : ""} with the code:`,
    ...lines,
    "",
    "Run `pnpm docs:sync` to correct them.",
  ].join("\n");
}

/**
 * The markers each file must carry, and how many of each.
 *
 * Pinned as an exact manifest rather than a count, because mutation-testing
 * showed a count is not enough: deleting one marker from README.md left the
 * totals comfortably above any threshold, so the number quietly went back to
 * being hand-maintained — the exact failure this file exists to prevent.
 *
 * Removing a documented number is a legitimate edit. It just has to be a
 * deliberate one, made here as well as in the prose.
 */
export const REQUIRED_MARKERS: Record<string, Record<string, number>> = {
  "README.md": { providers: 1, tests: 1, partial: 1, doSteps: 1 },
  "CLAUDE.md": { tests: 1, partial: 1, doSteps: 1 },
  "features.md": {
    academicDo: 1,
    academicAnti: 1,
    academicClassified: 1,
    competitionDo: 1,
    competitionAnti: 1,
    competitionClassified: 1,
    commercialDo: 1,
    commercialAnti: 1,
    commercialClassified: 1,
    commercialHuman: 1,
    commercialNeedsInput: 1,
    providers: 1,
    capabilities: 1,
    servesTagged: 1,
    partial: 2,
    verified: 2,
    doSteps: 2,
    tests: 1,
  },
  "HANDOFF.md": {
    tests: 2,
    providers: 3,
    competitionDo: 1,
    competitionAnti: 1,
    capabilities: 1,
    academicDo: 2,
    academicAnti: 2,
    commercialDo: 2,
    commercialAnti: 2,
    doSteps: 2,
    partial: 2,
    verified: 1,
  },
};

/** The files whose marked spans are owned by the catalog. */
export const SYNCED_FILES = Object.keys(REQUIRED_MARKERS);

/** How many times each key is marked in one document. */
export function markerCounts(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const m of text.matchAll(/<!--\s*catalog:([A-Za-z]+)\s*-->/g)) {
    counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  }
  return counts;
}

/** Mismatches between what a file should carry and what it does. */
export function missingMarkers(file: string, text: string): string[] {
  const want = REQUIRED_MARKERS[file] ?? {};
  const got = markerCounts(text);
  const out: string[] = [];
  for (const [key, n] of Object.entries(want)) {
    const have = got[key] ?? 0;
    if (have !== n) {
      out.push(
        `${file} — expected ${n} catalog:${key} marker(s), found ${have}`,
      );
    }
  }
  return out;
}

/**
 * The test files, listed without `fs.globSync`.
 *
 * `globSync` works on this Node but is absent from `@types/node@20`, so it
 * compiled and then failed `pnpm build`'s typecheck — which is the actual gate.
 * `test/` is flat, so a readdir is all this ever needed.
 */
export function testFiles(root: string): string[] {
  return readdirSync(join(root, "test"))
    .filter((f) => f.endsWith(".test.ts"))
    .sort();
}

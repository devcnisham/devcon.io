#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  countTestCases,
  type Drift,
  describeDrift,
  docValues,
  SYNCED_FILES,
  syncText,
  testFiles,
} from "../lib/docs/sync";

/**
 * Rewrites the catalog-owned numbers in the markdown.
 *
 *   pnpm docs:sync     write
 *   pnpm docs:check    fail if anything is stale (also run by the suite)
 *
 * The suite is the real gate; this script exists so the fix is one command
 * rather than a hunt through three files.
 */

const root = join(import.meta.dirname, "..");
const check = process.argv.includes("--check");

const testSources = testFiles(root).map((f) =>
  readFileSync(join(root, "test", f), "utf8"),
);
const values = docValues(countTestCases(testSources));

const allDrift: Drift[] = [];
const allUnknown: string[] = [];

for (const file of SYNCED_FILES) {
  const path = join(root, file);
  const before = readFileSync(path, "utf8");
  const { text, drift, unknown } = syncText(file, before, values);
  allDrift.push(...drift);
  allUnknown.push(...unknown);
  if (!check && text !== before) writeFileSync(path, text);
}

const report = describeDrift(allDrift, allUnknown);

if (check) {
  if (report) {
    console.error(report);
    process.exit(1);
  }
  console.log(
    `Documented numbers agree with the code (${SYNCED_FILES.join(", ")}).`,
  );
} else if (allDrift.length || allUnknown.length) {
  console.log(
    `Updated ${allDrift.length} number${allDrift.length === 1 ? "" : "s"}.`,
  );
  for (const d of allDrift) {
    console.log(`  ${d.file} — ${d.key}: ${d.found} → ${d.expected}`);
  }
  if (allUnknown.length) {
    console.error(`\nUnknown markers, left alone: ${allUnknown.join(", ")}`);
    process.exit(1);
  }
} else {
  console.log("Nothing to update.");
}

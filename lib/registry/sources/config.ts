import { type Feature, featureModule } from "../modules/feature";

/**
 * `project.features.ts` — registration method 3.
 *
 * The file is TypeScript, but this reads it as data. Executing it would mean
 * running the user's code, which is unacceptable in a browser tab and
 * unnecessary: a declaration file that needs to run to be read isn't a
 * declaration file. So the object literals are extracted textually and parsed
 * as JSON5-ish.
 *
 * The consequence is deliberate and documented for the user: computed values,
 * imports and spreads are not supported. A config that needs them should use
 * the SDK instead, which does run.
 */

export const CONFIG_FILENAMES = [
  "project.features.ts",
  "project.features.js",
  "project.features.json",
  ".devcon/features.json",
];

export interface ConfigParseResult {
  features: Feature[];
  /** Things the file contains that this reader deliberately can't handle. */
  warnings: string[];
}

/**
 * Turn a relaxed object literal into JSON.
 *
 * Handles what people actually write: unquoted keys, single quotes, trailing
 * commas. Anything beyond that is reported rather than silently dropped.
 */
function relaxedToJson(src: string): string {
  return (
    src
      // Strip comments before anything else, so a `//` inside them can't
      // confuse the quote handling below.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      // Unquoted keys → quoted.
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
      // Single-quoted strings → double. Values here are ids and names, so the
      // risk of an apostrophe inside one is real but small, and a parse failure
      // is reported rather than swallowed.
      .replace(/'([^'\\]*)'/g, '"$1"')
      // Trailing commas.
      .replace(/,(\s*[}\]])/g, "$1")
  );
}

export function parseFeatureConfig(
  path: string,
  source: string,
): ConfigParseResult {
  const warnings: string[] = [];

  if (/\bimport\b|\brequire\s*\(/.test(source)) {
    warnings.push(
      `${path} contains imports — this file is read as data, not executed, so imported values are ignored. Use the SDK if you need them.`,
    );
  }
  if (/\.\.\./.test(source)) {
    warnings.push(`${path} contains a spread, which cannot be resolved without running the file.`);
  }
  if (/`/.test(source)) {
    warnings.push(`${path} contains a template literal, which is read verbatim.`);
  }

  // Find the array — either a default export or the whole file for .json.
  const arrayStart = source.indexOf("[");
  const arrayEnd = source.lastIndexOf("]");
  if (arrayStart === -1 || arrayEnd <= arrayStart) {
    return {
      features: [],
      warnings: [...warnings, `${path} has no array of features in it.`],
    };
  }

  const body = source.slice(arrayStart, arrayEnd + 1);
  let raw: unknown;
  try {
    raw = JSON.parse(relaxedToJson(body));
  } catch (e) {
    return {
      features: [],
      warnings: [
        ...warnings,
        `${path} could not be read as data: ${e instanceof Error ? e.message : "parse error"}. Supported: plain object literals, no computed values.`,
      ],
    };
  }

  if (!Array.isArray(raw)) {
    return { features: [], warnings: [...warnings, `${path} does not export an array.`] };
  }

  const features: Feature[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.name !== "string" && typeof rec.id !== "string") {
      warnings.push(`${path}: an entry has neither a name nor an id, and was skipped.`);
      continue;
    }
    features.push(
      featureModule.hydrate({
        // A config entry may give only an id; the name falls back to it so the
        // dashboard never renders a blank row.
        name: (rec.name as string) ?? (rec.id as string),
        id: rec.id as string | undefined,
        description: rec.description as string | undefined,
        category: rec.category as string | undefined,
        owner: rec.owner as string | undefined,
        version: rec.version as string | undefined,
        status: rec.status as Feature["status"],
        priority: rec.priority as Feature["priority"],
        tags: Array.isArray(rec.tags) ? (rec.tags as string[]) : [],
        dependsOn: Array.isArray(rec.dependsOn) ? (rec.dependsOn as string[]) : [],
        notes: rec.notes as string | undefined,
        origin: "declared",
        files: [path],
      }),
    );
  }

  return { features, warnings };
}

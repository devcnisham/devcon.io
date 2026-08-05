import { type Feature, featureModule } from "../modules/feature";

/**
 * `@feature` annotations in comments.
 *
 * Registration method 2. The appeal is that the declaration sits on the code it
 * describes, so it moves when the code moves and dies when the code is deleted
 * — which is the failure mode every separate feature list eventually has.
 *
 * Parsed with a regex rather than a TypeScript AST on purpose: this has to run
 * in the browser against a file read from a folder handle, and shipping a
 * parser to do it would cost more than the precision is worth. The cost is that
 * an annotation inside a string literal would be picked up. That is an
 * acceptable false positive for something a person reviews.
 */

/**
 * One `@tag value` line.
 *
 * The comment prefix is optional and covers the forms people actually write:
 * `* @feature X` inside a block, `// @feature X` on its own, and `# @feature X`
 * in Python or Ruby. Requiring the `*` meant a single-line `// @feature` — the
 * most convenient form, and the one the spec's own example implies — was
 * silently ignored.
 */
const TAG = /^\s*(?:\/\/+|\*|#)?\s*@(\w+)\s+(.+?)\s*$/;

export interface AnnotationHit {
  feature: Feature;
  file: string;
  /** 1-indexed, so it can be shown as `file.ts:42`. */
  line: number;
}

/**
 * Parse one file's annotations.
 *
 * A block starts at `@feature <Name>` and continues while subsequent lines are
 * still comment lines carrying tags. Anything else ends it — which means a
 * `@feature` immediately followed by code takes only its own line, and that is
 * the common case.
 */
export function parseAnnotations(path: string, source: string): AnnotationHit[] {
  const lines = source.split("\n");
  const hits: AnnotationHit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const start = TAG.exec(lines[i]);
    if (!start || start[1] !== "feature") continue;

    const fields: Record<string, string> = { feature: start[2] };

    // Walk forward while the following lines are still tags in the same block.
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      // Any line that isn't a tag ends the block: a closing comment delimiter,
      // a blank line, or the code below.
      //
      // There was an explicit check for the closing delimiter here too. It was
      // dead — TAG requires an `@`, so a delimiter line never matches it and
      // the `!tag` break already covers that case. Mutation-testing found it:
      // deleting the check broke nothing, which is the definition of a branch
      // not worth keeping.
      const tag = TAG.exec(line);
      if (!tag) break;
      // A second @feature starts a new block rather than joining this one.
      if (tag[1] === "feature") break;
      fields[tag[1]] = tag[2];
    }

    hits.push({
      file: path,
      line: i + 1,
      feature: featureModule.hydrate({
        name: fields.feature,
        // `@id` is optional; without it the slug of the name is stable enough
        // that re-scanning the same annotation resolves to the same entry.
        id: fields.id,
        description: fields.description,
        category: fields.category,
        owner: fields.owner,
        version: fields.version,
        status: fields.status as Feature["status"],
        priority: fields.priority as Feature["priority"],
        tags: fields.tags
          ? fields.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        dependsOn: fields.dependsOn
          ? fields.dependsOn.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        origin: "annotated",
        files: [path],
      }),
    });
  }

  return hits;
}

/** File types worth opening. Reading every file in a repo to regex it is not free. */
export const ANNOTATABLE = /\.(m?[jt]sx?|py|go|rs|java|kt|rb|php|svelte|vue)$/i;

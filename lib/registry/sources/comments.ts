/**
 * Comment masking — the fix for `@feature` being read out of string literals.
 *
 * Scanning this repo reported `Authentication` as an annotated feature. There
 * is no such feature; the match came from a template literal in
 * `test/registry.test.ts` that contains an example annotation. A registry that
 * invents entries from its own test fixtures is worse than one that misses
 * some, because there is nothing in the UI to tell the two apart.
 *
 * `HANDOFF.md` recorded an AST parser as "the only real fix". It isn't the only
 * one, and it is the expensive one: this has to run in a browser tab against a
 * file read from a folder handle. What is actually needed is far narrower —
 * whether a given character sits inside a comment — and that is a small state
 * machine, not a parser.
 *
 * The output keeps comment text and replaces everything else with spaces,
 * newlines intact. Callers then run their existing line-based matching over the
 * mask and get identical line numbers back.
 *
 * ## What this deliberately does not do
 *
 * It does not recognise regex literals. `/["']/` reads as an opening quote, so
 * the rest of that line is masked as a string. The blast radius is bounded to
 * one line on purpose: single- and double-quoted strings are reset at every
 * newline, because in every language here they cannot span one unescaped. Only
 * backticks and Python triple-quotes carry across lines.
 */

type Style = "c-like" | "hash" | "both";

/**
 * Comment syntax by extension.
 *
 * Python is the reason this is not one rule: `//` there is floor division, not
 * a comment, so treating it as one would mask live code — and masking code is
 * how you turn a false positive into a false negative.
 */
function styleFor(path: string): Style {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "py" || ext === "rb") return "hash";
  if (ext === "php") return "both";
  return "c-like";
}

/**
 * Everything outside a comment, blanked.
 *
 * Length, line count and column positions are all preserved, so a match in the
 * result maps back to the same place in the source.
 */
export function maskNonComments(path: string, source: string): string {
  const style = styleFor(path);
  const cLike = style === "c-like" || style === "both";
  const hash = style === "hash" || style === "both";
  // Docstrings are where a Python annotation actually goes, so triple-quotes
  // are treated as comment text rather than as the strings they technically
  // are. Masking them would trade a false positive for a false negative.
  const docstrings = hash;

  const out: string[] = [];
  let state:
    | "code"
    | "line-comment"
    | "block-comment"
    | "single"
    | "double"
    | "template"
    | "docstring" = "code";
  /** Which triple-quote opened the current docstring. */
  let docQuote = "";

  const keep = (c: string) => out.push(c);
  const blank = (c: string) => out.push(c === "\n" ? "\n" : " ");

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];

    switch (state) {
      case "code": {
        if (cLike && c === "/" && next === "/") {
          state = "line-comment";
          keep(c);
          continue;
        }
        if (cLike && c === "/" && next === "*") {
          state = "block-comment";
          keep(c);
          continue;
        }
        if (hash && c === "#") {
          state = "line-comment";
          keep(c);
          continue;
        }
        if (
          docstrings &&
          (c === '"' || c === "'") &&
          next === c &&
          source[i + 2] === c
        ) {
          state = "docstring";
          docQuote = c;
          keep(c);
          keep(next);
          keep(source[i + 2]);
          i += 2;
          continue;
        }
        if (c === "'") {
          state = "single";
          blank(c);
          continue;
        }
        if (c === '"') {
          state = "double";
          blank(c);
          continue;
        }
        if (c === "`") {
          state = "template";
          blank(c);
          continue;
        }
        blank(c);
        continue;
      }

      case "line-comment": {
        keep(c);
        if (c === "\n") state = "code";
        continue;
      }

      case "block-comment": {
        keep(c);
        if (c === "*" && next === "/") {
          keep(next);
          i += 1;
          state = "code";
        }
        continue;
      }

      case "docstring": {
        keep(c);
        if (c === docQuote && next === docQuote && source[i + 2] === docQuote) {
          keep(next);
          keep(source[i + 2]);
          i += 2;
          state = "code";
        }
        continue;
      }

      case "single":
      case "double":
      case "template": {
        blank(c);
        if (c === "\\") {
          // Consume the escaped character so `\"` does not close the string.
          if (next !== undefined) {
            blank(next);
            i += 1;
          }
          continue;
        }
        if (c === "\n") {
          // Single- and double-quoted strings cannot span a line unescaped, so
          // a newline here means the scanner mis-read something — most likely a
          // regex literal holding a lone quote. Resetting bounds that mistake
          // to the line it started on. Templates legitimately span lines.
          if (state !== "template") state = "code";
          continue;
        }
        const closes =
          (state === "single" && c === "'") ||
          (state === "double" && c === '"') ||
          (state === "template" && c === "`");
        if (closes) state = "code";
        continue;
      }
    }
  }

  return out.join("");
}

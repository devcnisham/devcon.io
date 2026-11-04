/**
 * A `.gitignore`-compatible matcher.
 *
 * Supports the subset that actually matters when indexing a project:
 * comments, blank lines, negation (`!`), directory-only (`dir/`), anchoring
 * (`/root` or any pattern containing a slash), and the `*`, `**`, `?`
 * wildcards. Last matching rule wins, as git does it.
 *
 * Not a complete git implementation — notably, per-directory `.gitignore`
 * files are the caller's job to collect and pass in.
 */

/** Skipped for every project. Heavy, generated, or irrelevant to understanding. */
export const DEFAULT_IGNORES = [
  ".git/",
  "node_modules/",
  ".next/",
  ".nuxt/",
  ".svelte-kit/",
  ".turbo/",
  ".cache/",
  "dist/",
  "build/",
  "out/",
  "coverage/",
  "target/",
  "vendor/",
  "__pycache__/",
  ".venv/",
  "venv/",
  ".idea/",
  ".vscode/",
  ".DS_Store",
  "*.log",
  "*.lock.hcl",
];

export function parseGitignore(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ""))
    .filter((line) => line !== "" && !line.startsWith("#"));
}

type Rule = {
  /** Matches the path itself or anything beneath it. */
  selfOrBelow: RegExp;
  /** Matches only paths *inside* the pattern — used for `dir/` rules. */
  belowOnly: RegExp;
  negated: boolean;
  directoryOnly: boolean;
};

/** Escapes regex metacharacters, leaving the glob characters to be handled. */
function escapeLiteral(segment: string): string {
  return segment.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

/**
 * Converts one glob to a regex.
 *
 * `**` crosses directory boundaries; a single `*` and `?` do not, which is why
 * they compile to `[^/]` classes rather than `.`.
 */
function globToRegex(
  glob: string,
  anchored: boolean,
  mode: "self-or-below" | "below-only"
): RegExp {
  let body = "";

  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];

    if (char === "*") {
      if (glob[i + 1] === "*") {
        // `**/` may match zero directories, so the slash is optional.
        if (glob[i + 2] === "/") {
          body += "(?:.*/)?";
          i += 2;
        } else {
          body += ".*";
          i += 1;
        }
      } else {
        body += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      body += "[^/]";
      continue;
    }

    body += escapeLiteral(char);
  }

  // An unanchored pattern matches at any depth.
  const prefix = anchored ? "^" : "^(?:.*/)?";

  // "self-or-below" so that ignoring a directory also ignores its contents;
  // "below-only" for `dir/` rules applied to files, where a *file* named `dir`
  // must not match but `dir/thing.ts` must.
  const suffix = mode === "below-only" ? "/.+" : "(?:/.*)?";

  return new RegExp(`${prefix}${body}${suffix}$`);
}

function compile(pattern: string): Rule {
  let working = pattern;

  const negated = working.startsWith("!");
  if (negated) working = working.slice(1);

  if (working.startsWith("\\#") || working.startsWith("\\!")) {
    working = working.slice(1);
  }

  const directoryOnly = working.endsWith("/");
  if (directoryOnly) working = working.slice(0, -1);

  // Leading slash anchors and is not part of the path; a slash anywhere else
  // also anchors, per gitignore rules.
  const leadingSlash = working.startsWith("/");
  if (leadingSlash) working = working.slice(1);

  const anchored = leadingSlash || working.includes("/");

  return {
    selfOrBelow: globToRegex(working, anchored, "self-or-below"),
    belowOnly: globToRegex(working, anchored, "below-only"),
    negated,
    directoryOnly,
  };
}

export type Ignore = {
  /** `path` is relative to the project root, with forward slashes. */
  ignores(path: string, isDirectory: boolean): boolean;
};

export function createIgnore(patterns: string[]): Ignore {
  const rules = patterns.map(compile);

  return {
    ignores(path, isDirectory) {
      const normalized = path.replace(/^\.\//, "").replace(/\/$/, "");
      let ignored = false;

      // Last matching rule wins, so every rule is evaluated in order.
      for (const rule of rules) {
        // A `dir/` rule never matches a *file* named `dir`, but does match
        // every file inside that directory.
        const test =
          rule.directoryOnly && !isDirectory
            ? rule.belowOnly
            : rule.selfOrBelow;

        if (test.test(normalized)) {
          ignored = !rule.negated;
        }
      }

      return ignored;
    },
  };
}

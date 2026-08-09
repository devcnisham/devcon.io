/**
 * Reads SHIP.md.
 *
 * The format is deliberately plain markdown with no custom syntax, so the file
 * stays useful when this tool is not installed — an agent that has never heard
 * of devcon can still read it and know what to build and what not to.
 *
 * The one convention is `check:` on a line under a done-when item, naming a
 * shell command that must exit 0. Everything else is prose.
 */

export interface Cut {
  /** What is not being built. */
  thing: string;
  /** Why not. A cut without a reason is just an omission. */
  reason: string;
}

export interface Condition {
  text: string;
  /** Author's own tick. Claimed, not proven — `check` is what proves it. */
  claimed: boolean;
  /** Shell command that must exit 0. Absent means a human decides. */
  check?: string;
}

export interface Spec {
  name: string;
  /** The one sentence. What lands, for whom. */
  shipping: string;
  deadline: string | null;
  cuts: Cut[];
  conditions: Condition[];
  /** What the spec takes on faith. Wrong assumption, wrong spec. */
  assumptions: string[];
}

/**
 * Everything under `## <name>` up to the next `##`.
 *
 * Line-walked rather than regexed. The first version ended the match with
 * `(?=^##\s|\Z)` — but `\Z` is Perl/Python, not JavaScript, so it compiled to
 * "the literal letter z". Every section silently truncated at its first `z`:
 * "frozen" became "fro" and took the remaining thirteen conditions with it.
 * It looked like a formatting bug in the markdown, not a parser bug.
 */
function section(md: string, name: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex(
    (l) => l.trim().toLowerCase() === `## ${name.toLowerCase()}`,
  );
  if (start === -1) return "";

  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

/**
 * Bullets, with wrapped lines folded back in.
 *
 * Reasons and conditions are prose and will wrap. Reading only the bullet's
 * first line silently drops the second half of every long one.
 */
function bullets(block: string): string[] {
  const out: string[] = [];
  for (const line of block.split("\n")) {
    if (/^\s*-\s+/.test(line)) out.push(line.trim());
    else if (line.trim() && out.length)
      out[out.length - 1] += ` ${line.trim()}`;
  }
  return out;
}

export function parseSpec(md: string): Spec {
  const name = /^#\s+(.+)$/m.exec(md)?.[1]?.trim() ?? "Untitled";

  // The first bold line under the title is the one sentence.
  const shipping =
    /^\*\*(.+?)\*\*\s*$/ms
      .exec(md.split(/^##\s/m)[0] ?? "")?.[1]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";

  const deadlineRaw = /^Deadline:\s*(.+)$/im.exec(md)?.[1]?.trim() ?? null;
  const deadline =
    deadlineRaw && !/^none\b/i.test(deadlineRaw) ? deadlineRaw : null;

  const cuts: Cut[] = [];
  for (const b of bullets(section(md, "Not shipping"))) {
    // `- **thing** — reason`. Em dash, en dash or hyphen all work; nobody
    // remembers which one a parser wants.
    const m = /^-\s+\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/s.exec(b);
    if (m) {
      cuts.push({
        thing: m[1].trim(),
        reason: m[2].replace(/\s+/g, " ").trim(),
      });
    }
  }

  const conditions: Condition[] = [];
  for (const b of bullets(section(md, "Done when"))) {
    const m = /^-\s+\[([ xX])\]\s+(.+)$/s.exec(b);
    if (!m) continue;

    // The check rides on the same folded bullet, so pull it out and keep the
    // prose clean.
    let text = m[2];
    let check: string | undefined;
    const c = /`check:\s*(.+?)`/.exec(text);
    if (c) {
      check = c[1].trim();
      text = text.replace(c[0], "");
    }

    conditions.push({
      text: text.replace(/\s+/g, " ").trim(),
      claimed: m[1] !== " ",
      check,
    });
  }

  const assumptions = bullets(section(md, "Assumptions"))
    .map((b) => /^-\s+(.+)$/s.exec(b)?.[1]?.replace(/\s+/g, " ").trim())
    .filter((x): x is string => Boolean(x));

  return { name, shipping, deadline, cuts, conditions, assumptions };
}

/**
 * Language detection and breakdown.
 *
 * Attribution is by file extension, which is what GitHub's own tooling does
 * for the overwhelming majority of files. Content sniffing would add cost and
 * complexity for a handful of ambiguous cases.
 */

export type LanguageKind = "programming" | "markup" | "data" | "prose";

export type Language = {
  name: string;
  kind: LanguageKind;
  /** Used for the breakdown bar; roughly GitHub's palette. */
  color: string;
};

const L = (name: string, color: string, kind: LanguageKind = "programming") =>
  ({ name, kind, color }) satisfies Language;

export const LANGUAGES: Record<string, Language> = {
  ts: L("TypeScript", "#3178c6"),
  tsx: L("TypeScript", "#3178c6"),
  mts: L("TypeScript", "#3178c6"),
  cts: L("TypeScript", "#3178c6"),
  js: L("JavaScript", "#f1e05a"),
  jsx: L("JavaScript", "#f1e05a"),
  mjs: L("JavaScript", "#f1e05a"),
  cjs: L("JavaScript", "#f1e05a"),
  py: L("Python", "#3572a5"),
  java: L("Java", "#b07219"),
  php: L("PHP", "#4f5d95"),
  go: L("Go", "#00add8"),
  rs: L("Rust", "#dea584"),
  cs: L("C#", "#178600"),
  cpp: L("C++", "#f34b7d"),
  cc: L("C++", "#f34b7d"),
  cxx: L("C++", "#f34b7d"),
  hpp: L("C++", "#f34b7d"),
  // A bare .h could be C, C++, or Objective-C. C is the safer attribution:
  // guessing C++ would misreport every C project that ships headers.
  c: L("C", "#555555"),
  h: L("C", "#555555"),
  rb: L("Ruby", "#701516"),
  kt: L("Kotlin", "#a97bff"),
  kts: L("Kotlin", "#a97bff"),
  swift: L("Swift", "#f05138"),
  dart: L("Dart", "#00b4ab"),
  scala: L("Scala", "#c22d40"),
  ex: L("Elixir", "#6e4a7e"),
  exs: L("Elixir", "#6e4a7e"),
  lua: L("Lua", "#000080"),
  r: L("R", "#198ce7"),
  pl: L("Perl", "#0298c3"),
  hs: L("Haskell", "#5e5086"),
  zig: L("Zig", "#ec915c"),
  m: L("Objective-C", "#438eff"),
  sh: L("Shell", "#89e051"),
  bash: L("Shell", "#89e051"),
  zsh: L("Shell", "#89e051"),
  fish: L("Shell", "#89e051"),
  ps1: L("PowerShell", "#012456"),
  sql: L("SQL", "#e38c00"),
  prisma: L("Prisma", "#0c344b"),

  html: L("HTML", "#e34c26", "markup"),
  vue: L("Vue", "#41b883", "markup"),
  svelte: L("Svelte", "#ff3e00", "markup"),
  astro: L("Astro", "#ff5a03", "markup"),
  css: L("CSS", "#563d7c", "markup"),
  scss: L("Sass", "#c6538c", "markup"),
  sass: L("Sass", "#c6538c", "markup"),
  less: L("Less", "#1d365d", "markup"),

  json: L("JSON", "#7f7f7f", "data"),
  jsonc: L("JSON", "#7f7f7f", "data"),
  yml: L("YAML", "#cb171e", "data"),
  yaml: L("YAML", "#cb171e", "data"),
  toml: L("TOML", "#9c4221", "data"),
  xml: L("XML", "#0060ac", "data"),
  csv: L("CSV", "#7f7f7f", "data"),
  env: L("Env", "#7f7f7f", "data"),

  md: L("Markdown", "#083fa1", "prose"),
  mdx: L("MDX", "#083fa1", "prose"),
  txt: L("Text", "#7f7f7f", "prose"),
  rst: L("reStructuredText", "#141414", "prose"),
};

const OTHER_COLOR = "#9ca3af";

export function detectLanguage(path: string): Language | null {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dot = name.lastIndexOf(".");

  // No extension, or a dotfile with nothing after the dot.
  if (dot <= 0) return null;

  return LANGUAGES[name.slice(dot + 1)] ?? null;
}

export type LanguageShare = {
  name: string;
  color: string;
  bytes: number;
  percent: number;
};

export type LanguageBreakdown = {
  languages: LanguageShare[];
  primary: string | null;
  codeBytes: number;
  dataBytes: number;
  proseBytes: number;
};

/**
 * Distributes 100 points across shares using largest-remainder allocation.
 *
 * Rounding each share independently produces totals like 99 or 101, which
 * looks broken next to a bar that fills the width.
 */
function toPercentages(
  entries: Array<{ name: string; color: string; bytes: number }>,
  total: number
): LanguageShare[] {
  if (total === 0) return [];

  const exact = entries.map((entry) => ({
    ...entry,
    raw: (entry.bytes / total) * 100,
  }));

  // Everything present gets at least 1, so a real language never shows as 0%.
  const shares = exact.map((entry) => ({
    ...entry,
    percent: Math.max(1, Math.floor(entry.raw)),
  }));

  let remainder = 100 - shares.reduce((sum, s) => sum + s.percent, 0);

  // Hand out what is left to the largest fractional parts first; take back
  // from the largest shares if the floors already overshot.
  const byRemainder = [...shares].sort(
    (a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw))
  );

  let cursor = 0;
  while (remainder > 0 && byRemainder.length > 0) {
    byRemainder[cursor % byRemainder.length].percent++;
    remainder--;
    cursor++;
  }

  const byLargest = [...shares].sort((a, b) => b.percent - a.percent);
  cursor = 0;
  while (remainder < 0 && byLargest.length > 0) {
    const candidate = byLargest[cursor % byLargest.length];
    if (candidate.percent > 1) {
      candidate.percent--;
      remainder++;
    }
    cursor++;
    if (cursor > 1000) break; // cannot reduce further
  }

  return shares.map(({ name, color, bytes, percent }) => ({
    name,
    color,
    bytes,
    percent,
  }));
}

export function languageBreakdown(
  files: Array<{ path: string; size: number }>
): LanguageBreakdown {
  const byLanguage = new Map<string, { color: string; bytes: number }>();
  let codeBytes = 0;
  let dataBytes = 0;
  let proseBytes = 0;

  for (const file of files) {
    const language = detectLanguage(file.path);

    // A repository is not "40% JSON" because its lockfile is large, so data
    // and prose are counted but kept out of the language denominator.
    if (language?.kind === "data") {
      dataBytes += file.size;
      continue;
    }
    if (language?.kind === "prose") {
      proseBytes += file.size;
      continue;
    }

    const name = language?.name ?? "Other";
    const color = language?.color ?? OTHER_COLOR;

    const existing = byLanguage.get(name);
    byLanguage.set(name, {
      color,
      bytes: (existing?.bytes ?? 0) + file.size,
    });
    codeBytes += file.size;
  }

  const entries = [...byLanguage.entries()]
    .map(([name, value]) => ({ name, color: value.color, bytes: value.bytes }))
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));

  const languages = toPercentages(entries, codeBytes);

  return {
    languages,
    primary: languages[0]?.name ?? null,
    codeBytes,
    dataBytes,
    proseBytes,
  };
}

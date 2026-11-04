import type { LanguageBreakdown as Breakdown } from "@/features/codebase/lib/languages";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Language breakdown, weighted by bytes.
 *
 * The bar segments use the percentages directly, which is only safe because
 * they are allocated to sum to exactly 100 — independently rounded shares
 * would leave a visible gap or overflow.
 */
export function LanguageBreakdown({ breakdown }: { breakdown: Breakdown }) {
  if (breakdown.languages.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No source code recognised — this looks like a data or documentation
        repository.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-muted flex h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={breakdown.languages
          .map((language) => `${language.name} ${language.percent}%`)
          .join(", ")}
      >
        {breakdown.languages.map((language) => (
          <span
            key={language.name}
            style={{
              width: `${language.percent}%`,
              backgroundColor: language.color,
            }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {breakdown.languages.map((language) => (
          <li key={language.name} className="flex items-center gap-1.5 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: language.color }}
            />
            <span>{language.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {language.percent}%
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs">
        {formatBytes(breakdown.codeBytes)} of source.
        {breakdown.dataBytes > 0
          ? ` ${formatBytes(breakdown.dataBytes)} of data`
          : ""}
        {breakdown.proseBytes > 0
          ? ` and ${formatBytes(breakdown.proseBytes)} of documentation`
          : ""}
        {breakdown.dataBytes > 0 || breakdown.proseBytes > 0
          ? " excluded from the percentages."
          : ""}
      </p>
    </div>
  );
}

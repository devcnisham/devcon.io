import Link from "next/link";
import type { Filtered } from "@/lib/ship/search.ts";

/**
 * Filtering the workspace, without client JavaScript.
 *
 * A plain `GET` form. Typing and pressing Enter navigates to
 * `/work/workspace?q=…` and the server renders the filtered page. A
 * type-to-filter box would have needed `"use client"` and ended the
 * zero-page-chunk property for a feature that works without it.
 *
 * The round trip is cheap because the check run is cached — submitting reuses
 * the last one instead of re-running every command.
 */
export function Search({ result }: { result: Filtered }) {
  const { query, matches, total } = result;

  return (
    <div className="mb-6">
      <form method="get" action="/work/workspace" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Filter conditions, cuts and assumptions"
          aria-label="Filter this spec"
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-black/25 px-3 py-2 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-muted)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        />
        {/* Enter submits, but a visible control is the only affordance for
            anyone navigating by keyboard or touch. */}
        <button
          type="submit"
          className="shrink-0 rounded-xl border border-[var(--color-line)] bg-white/[0.04] px-3.5 py-2 text-[13.5px] text-[var(--color-text)] transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Filter
        </button>
      </form>

      {query && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[12.5px] text-[var(--color-muted)]">
          <span>
            {matches === 0 ? "Nothing matches" : `${matches} of ${total} shown`}{" "}
            for <span className="text-[var(--color-text)]">“{query}”</span>
          </span>
          {/* A link, not a reset button — clearing must work without JS too. */}
          <Link
            href="/work/workspace"
            className="rounded underline underline-offset-4 hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            clear
          </Link>
        </p>
      )}
    </div>
  );
}

/** What an empty result says, rather than an empty page. */
export function NoMatches({ query }: { query: string }) {
  return (
    <p className="py-8 text-[13.5px] text-[var(--color-muted)] leading-relaxed">
      No condition, cut or assumption mentions{" "}
      <span className="text-[var(--color-text)]">“{query}”</span>. The filter
      searches each condition&rsquo;s text, its command and its evidence — so a
      hash or an error string from the output will find it.
    </p>
  );
}

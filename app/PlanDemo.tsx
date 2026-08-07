"use client";

import { useEffect, useState } from "react";

/**
 * The hero, and the only argument this page makes.
 *
 * DevCon's claim is that the intelligence is deciding what to leave out. A
 * bulleted list saying so is the template answer and reads as marketing. This
 * shows it instead: a plan arrives whole, then most of it strikes itself out
 * with the reason attached, and five steps are left standing.
 *
 * The step titles are real catalog entries and the reasons are the shape the
 * engine actually generates. It is still labelled an example, because it is not
 * live output — this page runs no engine, and implying otherwise is the kind of
 * small lie the rest of the product goes out of its way to avoid.
 */

interface Row {
  title: string;
  /** Absent means the step survives. Present is why it was dropped. */
  reason?: string;
  /** An anti-step: not hidden, shown louder than the rest. */
  avoid?: boolean;
}

const ROWS: Row[] = [
  { title: "Pin the one thing you're shipping first" },
  { title: "Separate dev, staging and production" },
  { title: "Set up a monorepo", reason: "one app, not four" },
  { title: "Get secrets out of the repo and into the platform" },
  { title: "Add a feature-flag service", reason: "no users to flag for yet" },
  { title: "Design the data model before the features" },
  { title: "Write a migration rollback plan", reason: "no migrations yet" },
  { title: "Wire authentication", reason: "nothing behind a login" },
  { title: "Build the one core feature properly" },
  { title: "Add analytics dashboards", reason: "no traffic to read" },
  { title: "Set up a design system", reason: "under 6 screens" },
  { title: "Don't rewrite what already works", avoid: true },
  { title: "Configure a CDN", reason: "your host already does this" },
  { title: "Add a message queue", reason: "no background work" },
  { title: "Write end-to-end tests", reason: "the flow still changes daily" },
  { title: "Set up error monitoring", reason: "not shipped yet" },
];

const KEPT = ROWS.filter((r) => !r.reason).length;

export function PlanDemo() {
  /**
   * `false` is the whole plan, `true` is the plan after subtraction.
   *
   * Starts settled when the visitor has asked for reduced motion, so they get
   * the end state with no transition rather than a version of the page that
   * withholds its own point until an animation they cannot see has finished.
   */
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) {
      setSettled(true);
      return;
    }
    const t = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <figure className="m-0">
      <figcaption className="mb-4 flex items-baseline justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        <span>Example plan</span>
        <span aria-live="polite" className="tabular-nums text-neutral-400">
          <span className="text-neutral-100">
            {settled ? KEPT : ROWS.length}
          </span>
          <span className="text-neutral-400"> / {ROWS.length} steps</span>
        </span>
      </figcaption>

      <ol className="space-y-px overflow-hidden rounded-xl border border-white/10 bg-black/30">
        {ROWS.map((row, i) => {
          const dropped = settled && Boolean(row.reason);
          return (
            <li
              key={row.title}
              className="flex items-baseline gap-3 px-3 py-2 sm:px-4"
            >
              <span
                aria-hidden
                className={`mt-[7px] h-1 w-1 shrink-0 rounded-full transition-colors duration-500 ${
                  row.avoid
                    ? "bg-amber-400"
                    : dropped
                      ? "bg-neutral-700"
                      : "bg-sky-400"
                }`}
                style={{ transitionDelay: `${i * 28}ms` }}
              />

              {/**
               * Title and reason stack on mobile and sit side by side from
               * `sm` up.
               *
               * The reason used to be `hidden sm:block`, which was the wrong
               * call: on a phone every dropped step showed as struck through
               * with nothing saying why. "Hidden, with a reason attached" is
               * the entire claim, so hiding the reason left the narrowest
               * viewport making the opposite argument.
               */}
              <span className="min-w-0 flex-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
                <span
                  /**
                   * Dropped rows are dimmed by colour only, never by opacity.
                   *
                   * The row used to carry `opacity: 0.45`, which measured fine
                   * on the computed colour and was badly wrong in practice —
                   * blending neutral-400 at 45% over the background puts the
                   * reason text near 2.6:1. The reasons are the most important
                   * content in this demo, so that was the one thing the design
                   * must not have made unreadable.
                   *
                   * The strikethrough already says "removed". neutral-400 keeps
                   * every row at 7.66:1 while staying visibly quieter than the
                   * neutral-100 steps that survived.
                   */
                  className={`block text-[13px] leading-relaxed transition-colors duration-500 sm:text-sm ${
                    row.avoid
                      ? "text-amber-300"
                      : dropped
                        ? "text-neutral-400 line-through decoration-neutral-600"
                        : "text-neutral-100"
                  }`}
                  style={{ transitionDelay: `${i * 28}ms` }}
                >
                  {row.title}
                </span>

                {row.reason ? (
                  <span
                    className="mt-0.5 block shrink-0 font-mono text-[11px] leading-relaxed text-neutral-400 transition-opacity duration-500 sm:mt-0"
                    style={{
                      opacity: dropped ? 1 : 0,
                      transitionDelay: `${i * 28}ms`,
                    }}
                  >
                    {row.reason}
                  </span>
                ) : null}
              </span>

              {row.avoid ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-amber-400/80">
                  don&apos;t
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[13px] leading-relaxed text-neutral-400">
        Struck-through steps are hidden, each with the reason it didn&apos;t
        apply. The amber one is an anti-step — work DevCon tells you{" "}
        <em className="not-italic text-amber-300">not</em> to do.
      </p>
    </figure>
  );
}

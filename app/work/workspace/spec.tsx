import type { Checked, Verdict } from "@/lib/ship/check.ts";
import type { Cut } from "@/lib/ship/parse.ts";

/**
 * How a checked spec is drawn.
 *
 * The one rule the layout has to carry: **the tick and the verdict are shown
 * separately, never merged.** A merged single state would hide the only thing
 * this tool knows that you do not — that a box you ticked disagrees with the
 * command underneath it.
 */

const VERDICT: Record<Verdict, { label: string; chip: string }> = {
  pass: {
    label: "pass",
    chip: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  },
  fail: {
    label: "fail",
    chip: "border-rose-400/25 bg-rose-500/10 text-rose-300",
  },
  error: {
    label: "error",
    chip: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  },
  human: {
    label: "yours",
    chip: "border-white/10 bg-white/[0.05] text-neutral-400",
  },
};

export function Chip({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span
      className={`shrink-0 rounded-md border px-1.5 py-0.5 font-medium text-[11px] leading-none ${v.chip}`}
    >
      {v.label}
    </span>
  );
}

/** The author's own tick, kept visually distinct from the verdict beside it. */
function Claim({ claimed }: { claimed: boolean }) {
  return (
    <span
      role="img"
      aria-label={claimed ? "ticked" : "not ticked"}
      className={`mt-0.5 grid size-[15px] shrink-0 place-items-center rounded border text-[10px] leading-none ${
        claimed
          ? "border-white/25 bg-white/15 text-neutral-200"
          : "border-white/12"
      }`}
    >
      {/* Empty when unticked rather than a transparent tick — a hidden glyph
          still reaches screen readers and text extraction, which read every
          unticked box as ticked. */}
      {claimed ? "✓" : ""}
    </span>
  );
}

export function Condition({ c }: { c: Checked }) {
  return (
    <li className="flex gap-3 border-white/[0.05] border-b py-3 last:border-b-0">
      <Claim claimed={c.claimed} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2.5">
          <p className="min-w-0 flex-1 text-[13.5px] text-neutral-200 leading-relaxed">
            {c.text}
          </p>
          <Chip verdict={c.verdict} />
          {c.ms > 0 && (
            <span className="shrink-0 pt-0.5 text-[11px] text-neutral-600 tabular-nums">
              {c.ms}ms
            </span>
          )}
        </div>
        {c.check && (
          <p className="mt-1.5 font-mono text-[11.5px] text-neutral-500 [overflow-wrap:anywhere]">
            {c.check}
          </p>
        )}
        {/* Evidence is never summarised away — a check that cannot show its
            working is not a check. */}
        {c.verdict !== "human" && c.evidence && (
          <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.05] bg-black/25 px-2.5 py-1.5 font-mono text-[11px] text-neutral-400 leading-relaxed">
            {c.evidence}
          </pre>
        )}
      </div>
    </li>
  );
}

/**
 * Ticked boxes whose command disagrees.
 *
 * Given the top of the page because it is the only thing here you could not
 * have worked out by reading your own file.
 */
export function Drift({ lying }: { lying: Checked[] }) {
  if (lying.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-rose-400/25 bg-rose-500/[0.07] p-4">
      <p className="font-medium text-[13px] text-rose-200">
        {lying.length === 1
          ? "One box is ticked that its own check disagrees with."
          : `${lying.length} boxes are ticked that their own checks disagree with.`}
      </p>
      <ul className="mt-2 space-y-1">
        {lying.map((c) => (
          <li key={c.text} className="text-[13px] text-rose-100/70">
            {c.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Cuts({ cuts }: { cuts: Cut[] }) {
  if (cuts.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-medium text-[11px] text-neutral-500 uppercase tracking-[0.14em]">
        Not shipping
      </h2>
      <ul className="mt-3 space-y-3">
        {cuts.map((c) => (
          <li key={c.thing} className="text-[13.5px] leading-relaxed">
            <span className="text-neutral-200">{c.thing}</span>
            {/* The reason, not the list, is the part worth keeping. */}
            <span className="text-neutral-500"> — {c.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Assumptions({ assumptions }: { assumptions: string[] }) {
  if (assumptions.length === 0) return null;
  return (
    <section className="mt-10 pb-16">
      <h2 className="font-medium text-[11px] text-neutral-500 uppercase tracking-[0.14em]">
        Assumptions
      </h2>
      <p className="mt-1.5 text-[12.5px] text-neutral-600">
        If one of these is wrong, the spec is wrong — not the build.
      </p>
      <ul className="mt-3 space-y-2.5">
        {assumptions.map((a) => (
          <li
            key={a}
            className="text-[13.5px] text-neutral-400 leading-relaxed"
          >
            {a}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One row of the rail's count. */
export function Count({
  label,
  n,
  verdict,
}: {
  label: string;
  n: number;
  verdict?: Verdict;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span
        className={`text-[12.5px] ${verdict === "fail" && n > 0 ? "text-rose-300" : "text-neutral-500"}`}
      >
        {label}
      </span>
      <span
        className={`text-[13px] tabular-nums ${n === 0 ? "text-neutral-600" : "text-neutral-300"}`}
      >
        {n}
      </span>
    </div>
  );
}

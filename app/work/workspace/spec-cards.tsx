import Link from "next/link";
import type { Gap } from "@/lib/detect.ts";
import type { Checked, Verdict } from "@/lib/ship/check.ts";
import type { Cut } from "@/lib/ship/parse.ts";

/**
 * How a checked spec is drawn.
 *
 * The rule the layout has to carry: **the tick and the verdict are two marks,
 * never one.** A single merged state would hide the only thing this tool knows
 * that you do not — that a box you ticked disagrees with the command under it.
 */

const VERDICT: Record<Verdict, { label: string; chip: string }> = {
  pass: {
    label: "pass",
    chip: "border-[var(--color-pass)]/30 bg-[var(--color-pass)]/10 text-[var(--color-pass)]",
  },
  fail: {
    label: "fail",
    chip: "border-[var(--color-fail)]/30 bg-[var(--color-fail)]/10 text-[var(--color-fail)]",
  },
  error: {
    label: "error",
    chip: "border-[var(--color-cut)]/30 bg-[var(--color-cut)]/10 text-[var(--color-cut)]",
  },
  human: {
    label: "yours",
    chip: "border-[var(--color-line)] bg-white/[0.04] text-[var(--color-muted)]",
  },
};

export function Count({
  n,
  label,
  hint,
  tone = "text",
}: {
  n: number;
  label: string;
  hint: string;
  tone?: "text" | "pass" | "fail" | "cut";
}) {
  const colour = {
    text: "text-[var(--color-text)]",
    pass: "text-[var(--color-pass)]",
    fail: "text-[var(--color-fail)]",
    cut: "text-[var(--color-cut)]",
  }[tone];
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/50 px-3.5 py-2.5">
      <p className={`font-medium text-xl tabular-nums ${colour}`}>{n}</p>
      <p className="text-[12px] text-[var(--color-muted)]">{label}</p>
      <p className="text-[10.5px] text-[var(--color-muted)]/70 leading-snug">
        {hint}
      </p>
    </div>
  );
}

/** The author's own tick, kept visually apart from the verdict beside it. */
function Claim({ claimed }: { claimed: boolean }) {
  return (
    <span
      role="img"
      aria-label={claimed ? "ticked" : "not ticked"}
      className={`mt-0.5 grid size-[15px] shrink-0 place-items-center rounded border text-[10px] leading-none ${
        claimed
          ? "border-white/25 bg-white/15 text-[var(--color-text)]"
          : "border-white/15"
      }`}
    >
      {/* Empty when unticked. A transparent tick still reaches screen readers
          and text extraction, which then read every unticked box as ticked. */}
      {claimed ? "✓" : ""}
    </span>
  );
}

export function ConditionCard({ c }: { c: Checked }) {
  const v = VERDICT[c.verdict];
  return (
    <li className="rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/40 p-3.5">
      <div className="flex gap-3">
        <Claim claimed={c.claimed} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2.5">
            <p className="min-w-0 flex-1 text-[13.5px] text-[var(--color-text)] leading-relaxed">
              {c.text}
            </p>
            <span
              className={`shrink-0 rounded-md border px-1.5 py-0.5 font-medium text-[11px] leading-none ${v.chip}`}
            >
              {v.label}
            </span>
            {c.ms > 0 && (
              <span className="shrink-0 pt-0.5 text-[11px] text-[var(--color-muted)]/70 tabular-nums">
                {c.ms}ms
              </span>
            )}
          </div>

          {c.check && (
            <p className="mt-1.5 font-mono text-[11.5px] text-[var(--color-muted)] [overflow-wrap:anywhere]">
              {c.check}
            </p>
          )}

          {/* Evidence is shown, never summarised away — a check that cannot
              show its working is not a check. */}
          {c.verdict !== "human" && c.evidence && (
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--color-line)] bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-[var(--color-muted)] leading-relaxed">
              {c.evidence}
            </pre>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Ticked boxes whose command disagrees.
 *
 * Given the top of the page because it is the only thing here you could not
 * have worked out by reading your own file. Computed from the whole spec, so a
 * filter can never hide it.
 */
export function Drift({ lying }: { lying: Checked[] }) {
  if (lying.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--color-fail)]/30 bg-[var(--color-fail)]/[0.07] p-4">
      <p className="font-medium text-[13px] text-[var(--color-fail)]">
        {lying.length === 1
          ? "One box is ticked that its own check disagrees with."
          : `${lying.length} boxes are ticked that their own checks disagree with.`}
      </p>
      <ul className="mt-2 space-y-1">
        {lying.map((c) => (
          <li key={c.text} className="text-[13px] text-[var(--color-fail)]/75">
            {c.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CutCard({ cut }: { cut: Cut }) {
  return (
    <li className="rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/40 px-3.5 py-3">
      <p className="text-[13.5px] leading-relaxed">
        <span className="text-[var(--color-cut)]">{cut.thing}</span>
        {/* The reason, not the list, is the part worth keeping. */}
        <span className="text-[var(--color-muted)]"> — {cut.reason}</span>
      </p>
    </li>
  );
}

/** What the page shows when a project has no `SHIP.md` at all. */
export function NoSpec({ name, gaps }: { name: string; gaps: Gap[] }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-[var(--color-line)] border-dashed p-6">
        <p className="text-[14px] text-[var(--color-text)]">
          <span className="font-mono">{name}</span> has no{" "}
          <span className="font-mono">SHIP.md</span>
        </p>
        <p className="mt-2 text-[13px] text-[var(--color-muted)] leading-relaxed">
          That file is what this page reads: one sentence on what ships, what
          you are cutting and why, and the conditions that decide when it is
          done — each with a command that proves it. Without one there is
          nothing to check, so here is what the folder itself says instead.
        </p>
      </div>

      {gaps.length > 0 && (
        <ul className="mt-4 space-y-2">
          {gaps.map((g) => (
            <li
              key={g.id}
              className={`rounded-xl border px-3.5 py-3 text-[13.5px] ${
                g.urgent
                  ? "border-[var(--color-fail)]/30 bg-[var(--color-fail)]/[0.06] text-[var(--color-fail)]"
                  : "border-[var(--color-line)] bg-[var(--color-raised)]/40 text-[var(--color-muted)]"
              }`}
            >
              {g.label}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11.5px] text-[var(--color-muted)]/80 leading-relaxed">
        Read from the folder, not a checklist. devcon does not write this file
        for you yet.
      </p>
    </div>
  );
}

/** No project chosen on the dashboard. */
export function NoProject() {
  return (
    <div className="mx-auto max-w-sm text-center">
      <p className="text-[13.5px] text-[var(--color-muted)] leading-relaxed">
        No project open. Choose one on the dashboard and its{" "}
        <span className="font-mono">SHIP.md</span> is checked here — every
        command run inside the sandbox, because the repo may not be yours.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded text-[13px] text-[var(--color-muted)] underline underline-offset-4 transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        Open the dashboard
      </Link>
    </div>
  );
}

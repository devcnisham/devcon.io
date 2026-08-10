import type { Probe } from "@/lib/diagnostics.ts";

/**
 * The settings page's pieces.
 *
 * Nothing here is editable, and the page says so rather than drawing a switch
 * that does nothing. Every value is imported from the module that uses it or
 * probed from this machine, so a row cannot drift from the behaviour it
 * describes the way a hand-typed settings screen would.
 */

export function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-medium text-[var(--color-text)] text-lg tracking-tight">
        {title}
      </h2>
      {note && (
        <p className="mt-1 max-w-xl text-[12.5px] text-[var(--color-muted)] leading-relaxed">
          {note}
        </p>
      )}
      <dl className="mt-4 divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/40">
        {children}
      </dl>
    </section>
  );
}

export function Row({
  label,
  value,
  hint,
  mono = false,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint: string;
  mono?: boolean;
  tone?: "muted" | "pass" | "fail" | "cut";
}) {
  const colour = {
    muted: "text-[var(--color-muted)]",
    pass: "text-[var(--color-pass)]",
    fail: "text-[var(--color-fail)]",
    cut: "text-[var(--color-cut)]",
  }[tone];

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <dt className="text-[13.5px] text-[var(--color-text)]">{label}</dt>
        <dd
          className={`[overflow-wrap:anywhere] ${mono ? "font-mono text-[11.5px]" : "text-[13px]"} ${colour}`}
        >
          {value}
        </dd>
      </div>
      <p className="mt-1 max-w-xl text-[11.5px] text-[var(--color-muted)]/75 leading-relaxed">
        {hint}
      </p>
    </div>
  );
}

/**
 * One probe of this machine.
 *
 * A problem is shown as the value, in the failure colour, with the reason
 * underneath — rather than a green tick beside a feature that will not run
 * here.
 */
export function ProbeRow({ probe }: { probe: Probe }) {
  const bad = Boolean(probe.problem);
  return (
    <Row
      label={probe.label}
      value={probe.value}
      tone={bad ? "fail" : "pass"}
      mono={probe.label === "Node" || probe.label === "Platform"}
      hint={bad ? (probe.problem ?? probe.hint) : probe.hint}
    />
  );
}

/** A rule this tool holds itself to, stated where it can be checked against. */
export function Rule({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-cut)]/25 bg-[var(--color-cut)]/[0.05] px-4 py-3">
      <p className="text-[13px] text-[var(--color-text)]">{title}</p>
      <p className="mt-1 max-w-xl text-[12px] text-[var(--color-muted)] leading-relaxed">
        {children}
      </p>
    </div>
  );
}

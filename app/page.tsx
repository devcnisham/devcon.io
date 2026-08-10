import Link from "next/link";
import { readSpec } from "@/lib/ship/cache.ts";
import { Shell } from "./shell";

/**
 * Home — what this repo is planning, and the way into it.
 *
 * It reads `SHIP.md` but deliberately does **not** run the checks. Parsing is
 * microseconds; the checks are seconds, and a landing page that takes thirteen
 * seconds to say hello is a broken landing page. So this shows the *shape* of
 * the plan — the sentence, how much is claimed, what was cut — and sends you to
 * the work page for the evidence.
 *
 * The distinction is stated on screen rather than implied. A count of ticked
 * boxes is a claim, and this page has not checked a single one of them; saying
 * so is the whole discipline.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const root = process.cwd();
  const spec = await readSpec(root);

  return (
    <Shell here="/">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
        <h1 className="font-medium text-[var(--color-text)] text-2xl tracking-tight">
          devcon
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-[var(--color-muted)] leading-relaxed">
          A shipping critic that runs inside your coding agent, keeps one{" "}
          <span className="font-mono text-[var(--color-text)]">SHIP.md</span> in
          your repo, reads what you actually built, and tells you what to cut.
        </p>

        {spec ? (
          <section className="mt-10 rounded-2xl border border-[var(--color-line)] bg-[var(--color-raised)]/60 p-6">
            <h2 className="font-medium text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
              This repo
            </h2>

            <p className="mt-3 font-medium text-[var(--color-text)] text-lg leading-snug">
              {spec.name}
            </p>
            <p className="mt-2 text-[14px] text-[var(--color-muted)] leading-relaxed">
              {spec.shipping}
            </p>

            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              <Stat
                n={spec.conditions.length}
                label="conditions"
                hint="what done means"
              />
              <Stat
                n={spec.conditions.filter((c) => c.claimed).length}
                label="ticked"
                hint="claimed, not checked"
              />
              <Stat n={spec.cuts.length} label="cut" hint="and why" cut />
            </dl>

            {/* The point of the whole tool, said before you click. */}
            <p className="mt-6 text-[12.5px] text-[var(--color-muted)] leading-relaxed">
              Nothing on this page has been verified — a tick is the
              author&rsquo;s claim. The work page runs each condition&rsquo;s
              command and shows what is actually true.
            </p>

            <Link
              href="/work"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-white/[0.04] px-4 py-2 text-[13.5px] text-[var(--color-text)] transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Open the work page
              <span aria-hidden>→</span>
            </Link>
          </section>
        ) : (
          <section className="mt-10 rounded-2xl border border-[var(--color-line)] border-dashed p-6">
            <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">
              No <span className="font-mono">SHIP.md</span> in{" "}
              <span className="font-mono text-[var(--color-text)]">{root}</span>
              . That file is the whole interface: one sentence on what ships,
              what you are cutting and why, and the conditions that decide when
              it is done — each with a command that proves it.
            </p>
          </section>
        )}
      </div>
    </Shell>
  );
}

/** One number, with the caveat that makes it honest sitting under it. */
function Stat({
  n,
  label,
  hint,
  cut = false,
}: {
  n: number;
  label: string;
  hint: string;
  cut?: boolean;
}) {
  return (
    <div>
      <dd
        className={`font-medium text-2xl tabular-nums ${
          cut ? "text-[var(--color-cut)]" : "text-[var(--color-text)]"
        }`}
      >
        {n}
      </dd>
      <dt className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">
        {label}
      </dt>
      <p className="text-[11px] text-[var(--color-muted)]/70">{hint}</p>
    </div>
  );
}

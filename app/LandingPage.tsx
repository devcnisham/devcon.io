import { PlanDemo } from "./PlanDemo";
import { WaitlistForm } from "./WaitlistForm";

/**
 * The landing page.
 *
 * Server-rendered. It used to be `"use client"` end to end, which meant a
 * headline and one email input carried the whole hydration path; the only
 * genuinely interactive parts are now the two components imported above.
 *
 * One bold element and nothing else: `PlanDemo` performs the subtraction this
 * product is actually about, and everything around it stays quiet. A second
 * flourish would compete with the only thing worth remembering here.
 */

const FACTS = [
  {
    label: "One engine",
    body: "Academic, competition and commercial are three contexts over one catalog — not three products.",
  },
  {
    label: "Every step carries a prompt",
    body: "Context-rich and built from your actual stack, ready to paste into whichever coding agent you use.",
  },
  {
    label: "Nothing is hidden silently",
    body: "Every step it drops keeps the reason it was dropped, so you can disagree with it.",
  },
];

export function LandingPage() {
  return (
    <main
      className="min-h-dvh text-neutral-200"
      style={{
        background: `
          radial-gradient(900px 600px at 12% -5%, rgba(56,132,180,0.12), transparent 60%),
          radial-gradient(800px 500px at 88% 5%, rgba(120,80,180,0.10), transparent 55%),
          #0a0a0b
        `,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between">
          <span className="font-mono text-sm tracking-tight text-neutral-300">
            devcon
          </span>
          <a
            href="/start"
            className="rounded font-mono text-xs text-neutral-400 underline-offset-4 transition-colors hover:text-neutral-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            Open the app →
          </a>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12 sm:py-16">
          {/* Top-aligned, not centred. The demo column is roughly twice the
              height of the argument column, so centring left a large dead gap
              above the eyebrow and pushed the CTA down for no reason. */}
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16">
            {/* The argument. */}
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sky-400/80">
                Plans that subtract
              </p>

              <h1 className="mt-5 text-balance text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl">
                Ship the project, not the plan.
              </h1>

              <p className="mt-5 max-w-lg text-pretty text-[17px] leading-relaxed text-neutral-400">
                Point DevCon at an idea or an existing repo. It returns the
                short, ordered sequence of steps to ship it — and hides
                everything that doesn&apos;t apply, with a reason attached.
              </p>

              <div className="mt-8 max-w-md">
                <WaitlistForm />
              </div>
            </div>

            {/* The proof. */}
            <PlanDemo />
          </div>

          <ul className="mt-16 grid gap-x-10 gap-y-8 border-t border-white/8 pt-10 sm:grid-cols-3">
            {FACTS.map((f) => (
              <li key={f.label}>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-300">
                  {f.label}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <footer className="border-t border-white/8 pt-6 font-mono text-[11px] leading-relaxed text-neutral-400">
          Early access. We&apos;ll email when invites open. Nothing here has run
          a cohort yet, and no prompt has been verified against two agents — the
          plan you get is the catalog&apos;s judgement, not a measured result.
        </footer>
      </div>
    </main>
  );
}

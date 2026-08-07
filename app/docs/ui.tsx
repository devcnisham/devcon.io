import type { ReactNode } from "react";

/**
 * Docs primitives. All server components — this page ships no client JS of its
 * own, and the navigation is plain anchor links rather than a scroll-spy,
 * because a highlight that tracks your scroll position is not worth a
 * hydration boundary on a reference page.
 */

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.85em] text-neutral-200">
      {children}
    </code>
  );
}

export function Note({
  children,
  tone = "default",
}: {
  children: ReactNode;
  /** `strong` is for the things this project refuses to soften. */
  tone?: "default" | "strong";
}) {
  const strong = tone === "strong";
  return (
    <aside
      className={`my-6 rounded-lg border-l-2 py-3 pl-4 pr-4 text-[15px] leading-relaxed ${
        strong
          ? "border-amber-400/70 bg-amber-400/[0.04] text-amber-100/90"
          : "border-white/15 bg-white/[0.02] text-neutral-300"
      }`}
    >
      {children}
    </aside>
  );
}

export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    /* Its own scroll container. The page itself must never scroll sideways —
       that bug already cost this app 300px of horizontal scroll once. */
    <div className="my-6 -mx-1 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-white/12">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-2 py-2.5 font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-neutral-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-white/6 align-top">
              {r.map((cell, i) => (
                <td
                  key={`${r[0]}-${head[i]}`}
                  className={`px-2 py-3 leading-relaxed ${
                    i === 0
                      ? "whitespace-nowrap font-mono text-[13px] text-neutral-100"
                      : "text-neutral-300"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      /* Anchored headings land under the sticky header rather than behind it. */
      className="scroll-mt-24 border-t border-white/8 pt-10 [&_p]:mt-4 [&_p]:max-w-2xl [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-neutral-300 [&_li]:mt-2 [&_li]:max-w-2xl [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-neutral-300 [&_strong]:font-medium [&_strong]:text-neutral-100 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-neutral-600"
    >
      <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-white">
        <a
          href={`#${id}`}
          className="group rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          {title}
          <span
            aria-hidden
            className="ml-2 font-mono text-[15px] text-neutral-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            #
          </span>
        </a>
      </h2>
      {children}
    </section>
  );
}

export function DocsShell({
  sections,
  children,
}: {
  sections: { id: string; title: string }[];
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-dvh text-neutral-200"
      style={{
        background: `
          radial-gradient(900px 600px at 12% -5%, rgba(56,132,180,0.10), transparent 60%),
          #0a0a0b
        `,
      }}
    >
      {/* Keyboard users should not have to tab the whole nav on every load. */}
      <a
        href="#docs-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-neutral-100 focus:px-4 focus:py-2 focus:text-[14px] focus:font-medium focus:text-neutral-950"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0a0a0b]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <a
            href="/"
            className="rounded font-mono text-sm tracking-tight text-neutral-300 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            devcon
          </a>
          <nav className="flex items-center gap-5 font-mono text-xs text-neutral-400">
            <span className="text-neutral-100">docs</span>
            <a
              href="/start"
              className="rounded underline-offset-4 transition-colors hover:text-neutral-100 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              Open the app →
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14 lg:py-14">
        {/* On mobile this is a plain list above the content; from lg it sticks
            beside it. No scroll-spy — see the note at the top of this file. */}
        <nav
          aria-label="On this page"
          className="lg:sticky lg:top-24 lg:self-start"
        >
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">
            On this page
          </h2>
          <ol className="mt-3 space-y-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="rounded text-[13px] leading-snug text-neutral-400 underline-offset-4 transition-colors hover:text-neutral-100 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main id="docs-content" className="min-w-0 space-y-12">
          {children}

          <footer className="border-t border-white/8 pt-6 font-mono text-[11px] leading-relaxed text-neutral-400">
            Counts on this page are read from the catalog when the site is
            built, so they cannot disagree with the product.
          </footer>
        </main>
      </div>
    </div>
  );
}

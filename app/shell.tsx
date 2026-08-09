import Link from "next/link";

/**
 * Top-level chrome. Two destinations only — home and work.
 *
 * Workspace and canvas are not siblings of these; they are two views of the
 * same work page, so they live under `/work` rather than in this nav.
 */

const ROUTES = [
  { href: "/", label: "home" },
  { href: "/work", label: "work" },
];

export function Shell({
  here,
  children,
  /** The work page owns the viewport; home scrolls normally. */
  bleed = false,
}: {
  here: string;
  children: React.ReactNode;
  bleed?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-5 py-3 sm:px-6">
        <Link
          href="/"
          className="rounded font-mono text-sm tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          devcon
        </Link>
        <nav className="flex items-center gap-5 font-mono text-xs">
          {ROUTES.map((r) => {
            // `/` only matches exactly; `/work` also owns its child views.
            // Written as a variable because the inline version was a nested
            // ternary whose precedence made every route look active.
            const active =
              r.href === "/" ? here === "/" : here.startsWith(r.href);
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={`rounded underline-offset-4 transition-colors hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  active
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main
        className={bleed ? "relative flex min-h-0 flex-1 flex-col" : "flex-1"}
      >
        {children}
      </main>
    </div>
  );
}

/** What an empty surface says. One line, no instructions it cannot honour. */
export function Empty({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
      {label}
    </p>
  );
}

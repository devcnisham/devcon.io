import Link from "next/link";

/**
 * Shared chrome for the three empty surfaces.
 *
 * Deliberately the only thing that exists right now. The spec reader and the
 * done-when checker still live in `lib/ship/` and are wired to nothing — hidden,
 * not deleted, so the shells can be planned against without a half-built
 * feature arguing for itself.
 */

const ROUTES = [
  { href: "/", label: "home" },
  { href: "/canvas", label: "canvas" },
  { href: "/workspace", label: "workspace" },
];

export function Shell({
  here,
  children,
  /** Canvas fills the viewport; home and workspace scroll normally. */
  bleed = false,
}: {
  here: string;
  children: React.ReactNode;
  bleed?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-5 py-3 sm:px-6">
        <span className="font-mono text-sm tracking-tight">devcon</span>
        <nav className="flex items-center gap-5 font-mono text-xs">
          {ROUTES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              aria-current={r.href === here ? "page" : undefined}
              className={`rounded underline-offset-4 transition-colors hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                r.href === here
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className={bleed ? "relative min-h-0 flex-1" : "flex-1"}>
        {children}
      </main>
    </div>
  );
}

/** What an empty surface says. One line, no instructions it cannot honour yet. */
export function Empty({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
      {label}
    </p>
  );
}

import Link from "next/link";

/**
 * The chrome around dashboard, connectors and console.
 *
 * `here` is passed in rather than read from the router because a layout cannot
 * see which child is rendering — marking the active link from a layout needs
 * `useSelectedLayoutSegment`, a client hook, and that would put JavaScript on
 * every one of these pages to underline one word.
 *
 * A column on a wide screen, a row above the content on a narrow one. The work
 * page already taught this repo what happens when a two-pane layout is imposed
 * at every width: two independent scroll boxes and content trapped in half a
 * phone.
 */

const NAV = [
  { href: "/", label: "Dashboard", hint: "Projects and import" },
  { href: "/connectors", label: "Connectors", hint: "Services and MCP" },
  { href: "/console", label: "Console", hint: "How devcon behaves" },
] as const;

export function HomeShell({
  here,
  title,
  intro,
  children,
}: {
  here: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="shrink-0 border-[var(--color-line)] border-b px-5 py-4 lg:w-56 lg:border-r lg:border-b-0 lg:py-6">
        <Link
          href="/"
          className="rounded font-mono text-[var(--color-text)] text-sm tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          devcon
        </Link>

        <nav aria-label="Sections" className="mt-4 flex gap-1 lg:mt-8 lg:block">
          {NAV.map((item) => {
            const active = item.href === here;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 lg:mb-0.5 ${
                  active
                    ? "bg-white/[0.07] text-[var(--color-text)]"
                    : "text-[var(--color-muted)] hover:bg-white/[0.03] hover:text-[var(--color-text)]"
                }`}
              >
                <span className="block text-[13.5px]">{item.label}</span>
                <span className="hidden text-[11.5px] text-[var(--color-muted)]/70 lg:block">
                  {item.hint}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-8 sm:px-8 lg:px-10 lg:py-12">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="font-medium text-[var(--color-text)] text-xl tracking-tight">
            {title}
          </h1>
          {intro && (
            <p className="mt-2 max-w-xl text-[13.5px] text-[var(--color-muted)] leading-relaxed">
              {intro}
            </p>
          )}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

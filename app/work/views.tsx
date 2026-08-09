import Link from "next/link";

/**
 * The workspace/canvas switch.
 *
 * Rendered by each view rather than by the shared layout, which is the only
 * way to mark the active tab without client JavaScript: a layout cannot see
 * which child is rendering, and `useSelectedLayoutSegment` would drag a
 * hydration boundary in for what is two links.
 */

const VIEWS = [
  { href: "/work/workspace", label: "workspace" },
  { href: "/work/canvas", label: "canvas" },
] as const;

export function ViewTabs({ active }: { active: "workspace" | "canvas" }) {
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-[var(--color-line)] px-5 py-2 sm:px-6">
      {VIEWS.map((v) => {
        const on = v.label === active;
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-md px-2.5 py-1 font-mono text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              on
                ? "bg-white/[0.07] text-[var(--color-text)]"
                : "text-[var(--color-muted)] hover:bg-white/[0.04] hover:text-[var(--color-text)]"
            }`}
          >
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}

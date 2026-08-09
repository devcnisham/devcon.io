import Link from "next/link";

/**
 * The floating workspace/canvas switch.
 *
 * Rendered by each view rather than by the shared layout — the only way to
 * mark the active segment without client JavaScript, since a layout cannot see
 * which child is rendering and `useSelectedLayoutSegment` is a client hook.
 *
 * Floats over the surface rather than sitting in a bar, so the canvas keeps the
 * full height and nothing is reserved for chrome that is two links wide.
 */

const VIEWS = [
  { href: "/work/workspace", label: "workspace" },
  { href: "/work/canvas", label: "canvas" },
] as const;

export function ViewTabs({ active }: { active: "workspace" | "canvas" }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
      <nav
        aria-label="View"
        className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-[#16191f]/85 p-1 shadow-lg shadow-black/40 backdrop-blur"
      >
        {VIEWS.map((v) => {
          const on = v.label === active;
          return (
            <Link
              key={v.href}
              href={v.href}
              aria-current={on ? "page" : undefined}
              className={`rounded-xl px-3.5 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                on
                  ? "bg-white/[0.11] text-white"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {v.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

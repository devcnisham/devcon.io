"use client";

import type { Plan, ProjectProfile } from "@/lib/catalog/types";

export const LEFT_WIDTH = 232;
export const LEFT_COLLAPSED = 56;

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  overview: "M3 10h4l2-5 3 10 2-5h3",
  steps: "M4 10l3 3 8-8M4 15h12",
  board: "M3.5 4h4v12h-4z M8.5 4h4v8h-4z M13.5 4h3v10h-3z",
  prompts: "M11 2.5L4 11h4.5L9 17.5 16 9h-4.5L11 2.5z",
  hidden: "M3 10s2.5-4.5 7-4.5S17 10 17 10s-2.5 4.5-7 4.5S3 10 3 10z M4 4l12 12",
  anti: "M10 3.5L17 16H3L10 3.5z M10 8v3.5 M10 13.5v.5",
  deliver: "M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z M7 10h6M7 13h4",
  integrations:
    "M10 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z M10 2.5v2 M10 15.5v2 M2.5 10h2 M15.5 10h2",
  settings: "M4 6h12 M4 10h12 M4 14h12 M7.5 4.5v3 M12.5 8.5v3 M6.5 12.5v3",
} as const;

export type LeftSection = keyof typeof ICONS;

/**
 * Left rail. Mirrors the docs sidebar on the right, but this one is about the
 * plan rather than the files: what's in it, what's been cut, what's owed.
 *
 * Collapses to an icon rail rather than disappearing — unlike the docs panel,
 * these counts are worth glancing at while working on the canvas.
 */
export function LeftSidebar({
  profile,
  plan,
  completed,
  active,
  onSelect,
  collapsed,
  onToggleCollapsed,
}: {
  profile: ProjectProfile;
  plan: Plan;
  completed: Set<string>;
  active: LeftSection;
  onSelect: (s: LeftSection) => void;
  /** Owned by the page so the content area can reserve the right width. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const items: { key: LeftSection; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "steps", label: "Tasks", count: plan.steps.length },
    { key: "prompts", label: "Prompts", count: plan.steps.length },
    { key: "board", label: "Board" },
    { key: "anti", label: "Don't do", count: plan.antiSteps.length },
    { key: "hidden", label: "Hidden", count: plan.hidden.length },
    {
      key: "deliver",
      label: "Deliverables",
      count: profile.academic.deliverables.length,
    },
    { key: "integrations", label: "Integrations" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <aside
      className="absolute bottom-3 left-3 top-3 z-20 flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-neutral-950/85 shadow-2xl shadow-black/50 backdrop-blur-xl transition-[width] duration-200"
      style={{ width: collapsed ? LEFT_COLLAPSED : LEFT_WIDTH }}
    >
      {/* Labels stay mounted and are clipped by the aside's overflow-hidden.
          Unmounting them meant the text vanished instantly while the width
          took 200ms to follow — an empty wide rail on collapse, and wrapped
          text in a narrow one on expand. */}
      <header className="flex h-[41px] shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <span
          className={`min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold text-neutral-100 transition-opacity duration-150 ${
            collapsed ? "opacity-0" : "opacity-100"
          }`}
        >
          Plan
        </span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand" : "Collapse"}
          className="shrink-0 rounded px-1.5 py-0.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? "›" : "‹"}
        </button>
      </header>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const isActive = active === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  title={collapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg py-2 pl-[9px] pr-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-white/12 text-white"
                      : "text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-100"
                  }`}
                >
                  <Icon path={ICONS[item.key]} />
                  <span
                    className={`min-w-0 flex-1 truncate whitespace-nowrap transition-opacity duration-150 ${
                      collapsed ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`shrink-0 rounded-full bg-white/10 px-1.5 font-mono text-[10px] text-neutral-400 transition-opacity duration-150 ${
                      collapsed || item.count === undefined
                        ? "opacity-0"
                        : "opacity-100"
                    }`}
                  >
                    {item.count ?? ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <footer
        className={`shrink-0 border-t border-white/10 px-3 py-2.5 transition-opacity duration-150 ${
          collapsed ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-neutral-300 transition-all"
            style={{
              width: `${
                plan.steps.length
                  ? Math.round((completed.size / plan.steps.length) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
        <p className="mt-1.5 whitespace-nowrap font-mono text-[10px] text-neutral-500">
          {completed.size}/{plan.steps.length} done
        </p>
      </footer>
    </aside>
  );
}

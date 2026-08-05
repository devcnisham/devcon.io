"use client";

export type ViewKey = "workspace" | "canvas";

const TABS: { key: ViewKey; label: string; ready: boolean }[] = [
  { key: "workspace", label: "workspace", ready: true },
  { key: "canvas", label: "Canvas", ready: true },
];

/**
 * View switcher. Canvas is built; workspace is the ordered-list view and is
 * not started yet.
 *
 * The unbuilt tab stays visible but is marked "soon" rather than being hidden
 * — a tab that silently does nothing when clicked is worse than one that says
 * what it is.
 */
export function ViewTabs({
  value,
  onChange,
}: {
  value: ViewKey;
  onChange: (v: ViewKey) => void;
}) {
  return (
    <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-white/12 bg-neutral-900/75 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl">
      {TABS.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => tab.ready && onChange(tab.key)}
            aria-current={active}
            className={`relative rounded-lg px-3.5 py-1.5 text-sm transition-colors ${
              active
                ? "bg-white/12 text-white"
                : tab.ready
                  ? "text-neutral-400 hover:bg-white/6 hover:text-neutral-200"
                  : "cursor-not-allowed text-neutral-600"
            }`}
          >
            {tab.label}
            {!tab.ready ? (
              <span className="ml-1.5 rounded bg-white/8 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-neutral-500">
                soon
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

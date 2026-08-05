"use client";

import { useState } from "react";

export interface DockItem {
  id: string;
  label: string;
  /** Emoji or short glyph. Swap for real icons when we have them. */
  glyph: string;
  /** Tint behind the glyph. */
  tint: string;
  /** Renders the running-app dot beneath the tile. */
  running?: boolean;
  onClick?: () => void;
}

/**
 * macOS-style dock.
 *
 * Data-driven so items can be added without touching layout — pass whatever
 * belongs here and the dock lays it out, magnifies on hover, and groups by
 * separator.
 */
export function Dock({ groups }: { groups: DockItem[][] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const renderTile = (item: DockItem, all: DockItem[], index: number) => {
    const hoveredIndex = all.findIndex((i) => i.id === hovered);
    const distance = hoveredIndex === -1 ? 99 : Math.abs(index - hoveredIndex);

    // Neighbours lift slightly too — that falloff is what reads as "dock"
    // rather than "a row of buttons that grow".
    const scale = distance === 0 ? 1.45 : distance === 1 ? 1.2 : distance === 2 ? 1.06 : 1;
    const lift = distance === 0 ? -12 : distance === 1 ? -5 : distance === 2 ? -1 : 0;

    return (
      <button
        key={item.id}
        type="button"
        aria-label={item.label}
        onClick={item.onClick}
        onMouseEnter={() => setHovered(item.id)}
        onMouseLeave={() => setHovered(null)}
        className="group relative flex h-14 w-12 shrink-0 flex-col items-center justify-end"
      >
        {/* Only the tile scales. Transforming the whole button would scale the
            tooltip with it and shift where it lands — which is what made the
            label drift away from its icon. */}
        <span
          className="flex h-11 w-11 items-center justify-center rounded-[11px] text-[21px] leading-none shadow-lg shadow-black/40 ring-1 ring-white/10"
          style={{
            background: item.tint,
            transform: `translateY(${lift}px) scale(${scale})`,
            transition: "transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
            transformOrigin: "bottom center",
          }}
        >
          {item.glyph}
        </span>

        {/* Sits outside the scaled tile, so it stays put and stays legible. */}
        <span className="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-neutral-900/95 px-2 py-1 text-[11px] text-neutral-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
          {item.label}
        </span>

        <span
          className={`mt-1.5 h-[3px] w-[3px] shrink-0 rounded-full ${
            item.running ? "bg-neutral-300" : "bg-transparent"
          }`}
        />
      </button>
    );
  };

  // Magnification falls off by distance across the WHOLE dock, so it has to
  // be computed on the flattened list — not per group, or the effect would
  // reset at every separator.
  const all = groups.flat();
  let offset = 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center">
      <div className="pointer-events-auto flex items-end gap-1 rounded-[20px] border border-white/12 bg-neutral-900/70 px-2.5 py-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl">
        {groups
          .filter((g) => g.length > 0)
          .map((group, gi) => {
            const start = offset;
            offset += group.length;
            return (
              <span key={group[0].id} className="flex items-end gap-1">
                {gi > 0 ? (
                  <span className="mx-1.5 h-10 w-px shrink-0 self-center bg-white/15" />
                ) : null}
                {group.map((item, i) => renderTile(item, all, start + i))}
              </span>
            );
          })}
      </div>
    </div>
  );
}

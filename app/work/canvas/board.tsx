"use client";

import { useCallback, useRef, useState } from "react";
import type { Layout, Point } from "@/lib/canvas.ts";

/**
 * The one client component in v2.
 *
 * **What it bought:** dragging, two-finger panning and shift-drag selection.
 * None of those can be server-rendered — there is no HTML or CSS that moves an
 * element to where a pointer released it and remembers that. The cards, their
 * contents and their first positions are still built on the server; this file
 * only moves them.
 *
 * **What it cost:** 4.4 KB gzip, measured by building with and without it.
 * **What it did not cost:** a dependency. React Flow is the obvious choice and
 * most of its ~50 KB would go unused — no edges, no handles, no minimap, no
 * connection logic.
 *
 * Not built, and not pretended: zoom, undo, edges, grouping, snapping.
 */

export interface CardNode {
  id: string;
  kind: "project" | "gap" | "integration" | "spec";
  title: string;
  body?: string;
  urgent?: boolean;
}

const TONE: Record<CardNode["kind"], string> = {
  project: "border-[var(--color-line)] bg-[var(--color-raised)]",
  spec: "border-[var(--color-pass)]/35 bg-[var(--color-pass)]/[0.07]",
  gap: "border-[var(--color-cut)]/35 bg-[var(--color-cut)]/[0.07]",
  integration: "border-[var(--color-line)] bg-[var(--color-raised)]",
};

interface Marquee {
  from: Point;
  to: Point;
}

const rectOf = (m: Marquee) => ({
  left: Math.min(m.from.x, m.to.x),
  top: Math.min(m.from.y, m.to.y),
  right: Math.max(m.from.x, m.to.x),
  bottom: Math.max(m.from.y, m.to.y),
});

export function Board({
  nodes,
  initial,
  save,
}: {
  nodes: CardNode[];
  initial: Layout;
  /** Server action. Positions are persisted on drop, not on every frame. */
  save: (layout: Layout) => Promise<void>;
}) {
  const [layout, setLayout] = useState<Layout>(initial);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  const surface = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  /** Which cards are moving, and where the pointer was when they started. */
  const drag = useRef<{ ids: string[]; from: Point; start: Layout } | null>(
    null,
  );

  const persist = useCallback(
    (next: Layout) => {
      void save(next);
    },
    [save],
  );

  const onCardDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();

      // Dragging a card that is part of a selection moves the whole selection.
      const ids = selected.has(id) && selected.size > 1 ? [...selected] : [id];
      if (!selected.has(id)) setSelected(new Set([id]));

      const start: Layout = {};
      for (const i of ids) start[i] = layout[i] ?? { x: 0, y: 0 };
      drag.current = { ids, from: { x: e.clientX, y: e.clientY }, start };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [layout, selected],
  );

  const onSurfaceDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== surface.current) return;

    if (e.shiftKey) {
      // Shift-drag draws a selection box instead of panning.
      const at = { x: e.clientX, y: e.clientY };
      setMarquee({ from: at, to: at });
    } else {
      drag.current = null;
      setSelected(new Set());
    }
    surface.current?.setPointerCapture?.(e.pointerId);
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (marquee) {
        setMarquee({ ...marquee, to: { x: e.clientX, y: e.clientY } });
        return;
      }
      const d = drag.current;
      if (!d) return;

      const dx = e.clientX - d.from.x;
      const dy = e.clientY - d.from.y;
      setLayout((prev) => {
        const next = { ...prev };
        for (const id of d.ids) {
          next[id] = { x: d.start[id].x + dx, y: d.start[id].y + dy };
        }
        return next;
      });
    },
    [marquee],
  );

  const onUp = useCallback(() => {
    if (marquee) {
      // Hit-test against the rendered boxes rather than assumed card sizes —
      // a card's height depends on how long its text is.
      const box = rectOf(marquee);
      const hit = new Set<string>();
      for (const [id, el] of cards.current) {
        const r = el.getBoundingClientRect();
        const overlaps =
          r.left < box.right &&
          r.right > box.left &&
          r.top < box.bottom &&
          r.bottom > box.top;
        if (overlaps) hit.add(id);
      }
      setSelected(hit);
      setMarquee(null);
      return;
    }

    if (drag.current) {
      drag.current = null;
      setLayout((current) => {
        persist(current);
        return current;
      });
    }
  }, [marquee, persist]);

  /**
   * Two-finger drag.
   *
   * A trackpad reports it as a wheel event, which is also how a mouse wheel
   * arrives — both should move the board, so neither is special-cased.
   */
  const onWheel = useCallback((e: React.WheelEvent) => {
    setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
  }, []);

  const box = marquee ? rectOf(marquee) : null;

  return (
    <div
      ref={surface}
      onPointerDown={onSurfaceDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
      className="absolute inset-0 touch-none overflow-hidden"
    >
      {nodes.map((n) => {
        const at = layout[n.id] ?? { x: 40, y: 40 };
        const isSelected = selected.has(n.id);
        return (
          <article
            key={n.id}
            ref={(el) => {
              if (el) cards.current.set(n.id, el);
              else cards.current.delete(n.id);
            }}
            onPointerDown={(e) => onCardDown(e, n.id)}
            style={{
              transform: `translate3d(${at.x + pan.x}px, ${at.y + pan.y}px, 0)`,
            }}
            className={`absolute top-0 left-0 w-60 cursor-grab touch-none select-none rounded-xl border p-3 shadow-lg shadow-black/30 active:cursor-grabbing ${TONE[n.kind]} ${
              isSelected ? "z-10 ring-2 ring-white/50" : ""
            }`}
          >
            <p
              className={`font-medium text-[13px] ${
                n.urgent
                  ? "text-[var(--color-fail)]"
                  : "text-[var(--color-text)]"
              }`}
            >
              {n.title}
            </p>
            {n.body && (
              <p className="mt-1 text-[12px] text-[var(--color-muted)] leading-relaxed">
                {n.body}
              </p>
            )}
          </article>
        );
      })}

      {box && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed border border-white/50 bg-white/10"
          style={{
            left: box.left,
            top: box.top,
            width: box.right - box.left,
            height: box.bottom - box.top,
          }}
        />
      )}

      {/* The gestures are not discoverable, so they are stated. */}
      <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-[var(--color-muted)]/60">
        drag a card · two fingers to pan · shift-drag to select
        {selected.size > 0 && ` · ${selected.size} selected`}
      </p>
    </div>
  );
}

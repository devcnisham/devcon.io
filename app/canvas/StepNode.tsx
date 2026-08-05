"use client";

import { Handle, Position } from "@xyflow/react";
import type { Step } from "@/lib/catalog/types";

export interface StepNodeData {
  step: Step;
  state: "done" | "active" | "blocked" | "ready";
  [key: string]: unknown;
}

const STATE_STYLES: Record<StepNodeData["state"], string> = {
  done: "border-white/10 bg-neutral-900/70 text-neutral-500",
  active:
    "border-amber-400/80 bg-neutral-900/90 text-white shadow-2xl shadow-amber-500/20 ring-2 ring-amber-400/25",
  ready: "border-white/25 bg-neutral-900/85 text-neutral-50 shadow-xl shadow-black/40",
  blocked: "border-white/10 bg-neutral-900/70 text-neutral-400 shadow-lg shadow-black/30",
};

const SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

const STATE_LABEL: Record<StepNodeData["state"], string> = {
  done: "done",
  active: "now",
  ready: "unblocked",
  blocked: "waiting",
};

function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function StepNode({
  data,
  selected,
}: {
  data: StepNodeData;
  selected?: boolean;
}) {
  const { step, state } = data;

  return (
    <div
      className={`w-[280px] rounded-xl border px-4 py-3 backdrop-blur-md transition-colors ${STATE_STYLES[state]} ${
        selected ? "!border-sky-400 ring-2 ring-sky-400/40" : ""
      }`}
    >
      {/* A connection point at the middle of each side. Each side carries both
          a target and a source handle stacked at the same point, so a user can
          drag a connection out of — or into — any side. React Flow only joins
          source → target, so one alone would make half the drags impossible. */}
      {SIDES.map(({ id, position }) => (
        <span key={id}>
          <Handle
            id={`${id}-t`}
            type="target"
            position={position}
            className="!h-3 !w-3 !border-2 !border-neutral-400 !bg-neutral-900 !opacity-0 transition-opacity"
          />
          <Handle
            id={`${id}-s`}
            type="source"
            position={position}
            className="!h-3 !w-3 !border-2 !border-neutral-400 !bg-neutral-900 hover:!border-sky-400 hover:!bg-sky-500"
          />
        </span>
      ))}

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
          {step.phase}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${
            state === "active"
              ? "bg-amber-400/20 text-amber-300"
              : state === "ready"
                ? "bg-white/10 text-neutral-300"
                : "text-neutral-500"
          }`}
        >
          {STATE_LABEL[state]}
        </span>
      </div>

      <p className="text-[15px] font-semibold leading-snug">{step.title}</p>

      <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-neutral-400">
        <span>{formatEstimate(step.est_minutes)}</span>
        {step.mark_weight ? (
          <span className="text-emerald-400">{step.mark_weight}% of grade</span>
        ) : null}
        {step.criticality === "must" ? (
          <span className="text-neutral-300">must</span>
        ) : null}
      </div>

    </div>
  );
}

"use client";

import { Handle, Position } from "@xyflow/react";
import {
  CAPABILITY_LABEL,
  type Provider,
} from "@/lib/catalog/providers";

export interface IntegrationNodeData {
  provider: Provider;
  /** What this connection resolves to — a repo slug, a project name. */
  identity: string | null;
  /** Titles of the plan steps this service is wired into. */
  serves: string[];
  [key: string]: unknown;
}

const SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

/** Same deterministic tint the Integrations rows use, so a service is recognisable across both. */
const TINTS = [
  "linear-gradient(150deg,#38bdf8,#0369a1)",
  "linear-gradient(150deg,#a78bfa,#5b21b6)",
  "linear-gradient(150deg,#34d399,#065f46)",
  "linear-gradient(150deg,#fbbf24,#b45309)",
  "linear-gradient(150deg,#fb7185,#9f1239)",
  "linear-gradient(150deg,#94a3b8,#334155)",
];

function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * A connected service, on the canvas.
 *
 * Deliberately a different shape from a step: a step is work you do, a service
 * is a thing that exists. Drawing them identically would suggest you can tick a
 * service off.
 */
export function IntegrationNode({
  data,
  selected,
}: {
  data: IntegrationNodeData;
  selected?: boolean;
}) {
  const { provider, identity, serves } = data;
  const mcp = provider.mcp_server;

  return (
    <div
      className={`w-[240px] rounded-2xl border px-3.5 py-3 backdrop-blur-md transition-colors ${
        selected
          ? "border-sky-400 ring-2 ring-sky-400/40"
          : "border-emerald-400/30 bg-emerald-400/[0.04]"
      }`}
    >
      {SIDES.map(({ id, position }) => (
        <span key={id}>
          <Handle
            id={`${id}-t`}
            type="target"
            position={position}
            className="!h-3 !w-3 !border-2 !border-emerald-400/60 !bg-neutral-900 !opacity-0"
          />
          <Handle
            id={`${id}-s`}
            type="source"
            position={position}
            className="!h-3 !w-3 !border-2 !border-emerald-400/60 !bg-neutral-900 hover:!bg-emerald-500"
          />
        </span>
      ))}

      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white/90 ring-1 ring-white/10"
          style={{ background: tintFor(provider.id) }}
          aria-hidden
        >
          {provider.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-50">
            {provider.name}
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-widest text-emerald-400/70">
            {CAPABILITY_LABEL[provider.capability]}
          </span>
        </span>
        {mcp ? (
          <span className="shrink-0 rounded bg-sky-400/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-sky-300">
            MCP
          </span>
        ) : null}
      </div>

      {/* The actual thing, when it's knowable. "GitHub" is a category;
          "devcnisham/devcon.io" is the project. */}
      {identity ? (
        <p className="mt-2 truncate rounded-md bg-black/40 px-2 py-1 font-mono text-[11px] text-amber-300/90">
          {identity}
        </p>
      ) : (
        <p className="mt-2 font-mono text-[10px] text-neutral-600">
          not linked to a specific project yet
        </p>
      )}

      {serves.length ? (
        <p className="mt-2 text-[11px] leading-snug text-neutral-500">
          Used by {serves.length} step{serves.length === 1 ? "" : "s"}:{" "}
          <span className="text-neutral-400">{serves.slice(0, 2).join(", ")}</span>
          {serves.length > 2 ? ` +${serves.length - 2}` : ""}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-neutral-600">
          No step in this plan uses it.
        </p>
      )}
    </div>
  );
}

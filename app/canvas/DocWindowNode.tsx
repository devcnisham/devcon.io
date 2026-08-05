"use client";

import { Handle, NodeResizer, Position } from "@xyflow/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocNode } from "@/lib/docs/types";

export interface DocNodeData {
  doc: DocNode;
  onClose: (id: string) => void;
  onChange: (docId: string, content: string) => void;
  [key: string]: unknown;
}

const SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

/**
 * A document as a first-class canvas node — draggable, resizable, connectable.
 *
 * Previously this was a floating div layered over the canvas, which meant it
 * couldn't be positioned relative to the graph or wired to the steps it
 * describes. As a node it participates in the same space as everything else.
 */
export function DocWindowNode({
  id,
  data,
  selected,
}: {
  id: string;
  data: DocNodeData;
  selected?: boolean;
}) {
  const { doc, onClose, onChange } = data;
  const [editing, setEditing] = useState(false);

  return (
    <>
      <NodeResizer
        minWidth={320}
        minHeight={220}
        isVisible={selected}
        lineClassName="!border-sky-400/60"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-sky-400 !bg-neutral-900"
      />

      {SIDES.map(({ id: side, position }) => (
        <span key={side}>
          <Handle
            id={`${side}-t`}
            type="target"
            position={position}
            className="!h-3 !w-3 !border-2 !border-neutral-400 !bg-neutral-900 !opacity-0"
          />
          <Handle
            id={`${side}-s`}
            type="source"
            position={position}
            className="!h-3 !w-3 !border-2 !border-neutral-400 !bg-neutral-900 hover:!border-sky-400 hover:!bg-sky-500"
          />
        </span>
      ))}

      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-neutral-950/92 shadow-2xl shadow-black/60 backdrop-blur-xl ${
          selected ? "border-sky-400" : "border-white/15"
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-2.5">
          <span className="flex items-center gap-1.5">
            {/* nodrag so clicking the button doesn't start a node drag. */}
            <button
              type="button"
              onClick={() => onClose(id)}
              title="Close"
              className="nodrag h-3 w-3 rounded-full bg-red-500 transition-opacity hover:opacity-80"
            />
            <span className="h-3 w-3 rounded-full bg-amber-400/70" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
          </span>

          <span className="ml-1 min-w-0 flex-1 truncate text-center text-xs font-medium text-neutral-300">
            {doc.name}
          </span>

          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`nodrag shrink-0 rounded px-2 py-0.5 font-mono text-[10px] transition-colors ${
              editing
                ? "bg-amber-400/20 text-amber-300"
                : "text-neutral-500 hover:bg-white/10 hover:text-neutral-200"
            }`}
          >
            {editing ? "preview" : "edit"}
          </button>
        </div>

        {/* nodrag + nowheel: scrolling, selecting, and typing inside the window
            must not pan the canvas or drag the node. */}
        <div className="nodrag nowheel min-h-0 flex-1 cursor-auto overflow-hidden">
          {editing ? (
            <textarea
              value={doc.content ?? ""}
              onChange={(e) => onChange(doc.id, e.target.value)}
              spellCheck={false}
              placeholder="# Start writing…"
              className="h-full w-full resize-none bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
            />
          ) : doc.content ? (
            <article className="doc-prose h-full overflow-y-auto px-5 py-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {doc.content}
              </ReactMarkdown>
            </article>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-full w-full px-5 py-4 text-left text-sm text-neutral-500 hover:text-neutral-300"
            >
              Empty file — click to start writing.
            </button>
          )}
        </div>
      </div>
    </>
  );
}

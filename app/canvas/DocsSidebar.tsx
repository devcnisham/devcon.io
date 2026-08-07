"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type DocNode, addChild, removeNode } from "@/lib/docs/types";

const WIDTH = 288;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The panel's own glyph. Same mark whether it's floating or in the header. */
function DocIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path
        d="M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"
        strokeLinejoin="round"
      />
      <path d="M7 9h6M7 12h6" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5 shrink-0 text-neutral-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path
        d="M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"
        strokeLinejoin="round"
      />
      <path d="M7 10h6M7 13h4" strokeLinecap="round" />
    </svg>
  );
}

interface Hit {
  node: DocNode;
  /** Folder names above it, for disambiguating same-named files. */
  path: string[];
  /** Text around the content match, or null when only the name matched. */
  snippet: string | null;
}

/**
 * Search names and bodies.
 *
 * Returns a flat list rather than a filtered tree — when you're searching you
 * want to scan results, not navigate a hierarchy, and a filtered tree hides
 * the very structure that made it readable.
 */
function searchDocs(
  nodes: DocNode[],
  query: string,
  path: string[] = [],
): Hit[] {
  const q = query.toLowerCase();
  const out: Hit[] = [];

  for (const node of nodes) {
    if (node.kind === "folder") {
      out.push(...searchDocs(node.children ?? [], query, [...path, node.name]));
      continue;
    }

    const nameHit = node.name.toLowerCase().includes(q);
    const body = node.content ?? "";
    const at = body.toLowerCase().indexOf(q);

    if (!nameHit && at === -1) continue;

    let snippet: string | null = null;
    if (at !== -1) {
      const start = Math.max(0, at - 24);
      const raw = body.slice(start, at + q.length + 40).replace(/\s+/g, " ");
      snippet = `${start > 0 ? "…" : ""}${raw.trim()}…`;
    }

    out.push({ node, path, snippet });
  }

  return out;
}

/** One line of body text, so a card hints at its contents. */
function previewOf(content?: string): string | null {
  if (!content) return null;
  const line = content
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0);
  return line ? (line.length > 44 ? `${line.slice(0, 44)}…` : line) : null;
}

function DocCard({
  node,
  depth,
  openIds,
  onOpen,
  onAdd,
  onRemove,
  actions,
}: {
  node: DocNode;
  depth: number;
  openIds: Set<string>;
  onOpen: (doc: DocNode) => void;
  onAdd: (parentId: string, kind: DocNode["kind"]) => void;
  onRemove: (id: string) => void;
  /** Rendered inside this folder's body — used for the root card's controls. */
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isFolder = node.kind === "folder";

  if (isFolder) {
    return (
      <li>
        <div className="group rounded-lg border border-white/10 bg-white/[0.04] transition-colors hover:border-white/20">
          <div className="flex items-center gap-2 px-2.5 py-2">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <Chevron open={open} />
              <span className="truncate text-sm font-semibold text-neutral-100">
                {node.name}
              </span>
              <span className="shrink-0 rounded-full bg-white/10 px-1.5 font-mono text-[10px] text-neutral-400">
                {node.children?.length ?? 0}
              </span>
            </button>

            <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                title="New file"
                onClick={() => {
                  setOpen(true);
                  onAdd(node.id, "file");
                }}
                className="rounded px-1 font-mono text-[10px] text-neutral-400 hover:bg-white/15 hover:text-white"
              >
                +md
              </button>
              <button
                type="button"
                title="New folder"
                onClick={() => {
                  setOpen(true);
                  onAdd(node.id, "folder");
                }}
                className="rounded px-1 font-mono text-[10px] text-neutral-400 hover:bg-white/15 hover:text-white"
              >
                +/
              </button>
            </span>
          </div>

          {open && (node.children?.length || actions) ? (
            <div className="border-t border-white/8 px-2 pb-2 pt-2">
              {node.children?.length ? (
                <ul className="space-y-1.5">
                  {node.children.map((child) => (
                    <DocCard
                      key={child.id}
                      node={child}
                      depth={depth + 1}
                      openIds={openIds}
                      onOpen={onOpen}
                      onAdd={onAdd}
                      onRemove={onRemove}
                    />
                  ))}
                </ul>
              ) : null}
              {actions}
            </div>
          ) : null}
        </div>
      </li>
    );
  }

  const preview = previewOf(node.content);
  const isOpen = openIds.has(node.id);

  return (
    <li>
      <div
        className={`group relative rounded-md border px-2.5 py-2 transition-colors ${
          isOpen
            ? "border-sky-400/60 bg-sky-400/10"
            : "border-white/10 bg-black/25 hover:border-white/25 hover:bg-white/[0.06]"
        }`}
      >
        <button
          type="button"
          onClick={() => onOpen(node)}
          className="flex w-full min-w-0 items-start gap-2 text-left"
        >
          <span className="mt-0.5">
            <FileIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-neutral-100">
              {node.name}
            </span>
            {preview ? (
              <span className="mt-0.5 block truncate text-[11px] text-neutral-500">
                {preview}
              </span>
            ) : null}
          </span>
        </button>

        <button
          type="button"
          title="Delete"
          onClick={() => onRemove(node.id)}
          className="absolute right-1.5 top-1.5 rounded px-1 text-xs text-neutral-500 opacity-0 transition-opacity hover:bg-white/15 hover:text-red-300 group-hover:opacity-100"
        >
          ×
        </button>
      </div>
    </li>
  );
}

export function DocsSidebar({
  docs,
  setDocs,
  onOpenDoc,
  openIds,
  pinned,
  setPinned,
}: {
  docs: DocNode[];
  setDocs: React.Dispatch<React.SetStateAction<DocNode[]>>;
  /** Opens the file as a window on the canvas. */
  onOpenDoc: (doc: DocNode) => void;
  /** Doc ids currently open as canvas nodes, so the tree can mark them. */
  openIds: Set<string>;
  /** Lifted so the dock can toggle the panel too. */
  pinned: boolean;
  setPinned: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  /**
   * Click to open, click to close. No hover behaviour.
   *
   * Hover-peek was tried and removed: a panel that appears because the pointer
   * passed nearby moves under the cursor unasked, which is worse than one
   * extra click.
   */
  const visible = pinned;

  const [query, setQuery] = useState("");
  const hits = useMemo(
    () => (query.trim() ? searchDocs(docs, query.trim()) : null),
    [docs, query],
  );

  const [importing, setImporting] = useState(false);
  const [fetchOpen, setFetchOpen] = useState(false);
  const [fetchUrl, setFetchUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(
    (parentId: string, kind: DocNode["kind"]) => {
      const id = `${parentId}-${kind}-${Math.random().toString(36).slice(2, 8)}`;
      const node: DocNode =
        kind === "folder"
          ? { id, name: "New folder", kind, children: [] }
          : { id, name: "untitled.md", kind, content: "" };
      setDocs((prev) => addChild(prev, parentId, node));
    },
    [setDocs],
  );

  const handleRemove = useCallback(
    (id: string) => setDocs((prev) => removeNode(prev, id)),
    [setDocs],
  );

  /** Import markdown from disk. Fully client-side — no backend needed. */
  const handleImport = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setImporting(true);
      try {
        const imported = await Promise.all(
          Array.from(files).map(async (file) => ({
            id: `import-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            kind: "file" as const,
            content: await file.text(),
          })),
        );
        setDocs((prev) =>
          imported.reduce((acc, node) => addChild(acc, "docs", node), prev),
        );
      } finally {
        setImporting(false);
      }
    },
    [setDocs],
  );

  return (
    <>
      {/* Floating trigger while closed. When open the same control lives in
          the panel header instead. */}
      {!visible ? (
        <button
          type="button"
          onClick={() => setPinned(true)}
          title="Show docs"
          className="absolute right-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-neutral-900/90 text-neutral-300 shadow-xl backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
        >
          <DocIcon />
        </button>
      ) : null}

      <aside
        className="absolute bottom-3 right-3 top-3 z-20 flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-neutral-950/85 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-200 ease-out"
        style={{
          width: WIDTH,
          transform: visible ? "translateX(0)" : `translateX(${WIDTH + 24}px)`,
        }}
      >
        <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <span className="text-sm font-semibold text-neutral-100">Docs</span>
          <button
            type="button"
            onClick={() => setPinned(false)}
            title="Hide docs"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/50 bg-amber-400/15 text-amber-300 transition-colors hover:bg-amber-400/25"
          >
            <DocIcon />
          </button>
        </header>

        <div className="shrink-0 border-b border-white/10 px-2.5 py-2">
          <div className="relative">
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5L17 17" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs…"
              className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-7 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-white/25 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                title="Clear"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-xs text-neutral-500 hover:text-neutral-200"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
          <input
            ref={fileInput}
            type="file"
            accept=".md,.markdown,.txt"
            multiple
            className="hidden"
            onChange={(e) => {
              handleImport(e.target.files);
              e.target.value = "";
            }}
          />

          {hits ? (
            hits.length === 0 ? (
              <p className="px-1 py-2 text-xs text-neutral-600">
                Nothing matches “{query}”.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {hits.map(({ node, path, snippet }) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onOpenDoc(node)}
                      className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                        openIds.has(node.id)
                          ? "border-sky-400/60 bg-sky-400/10"
                          : "border-white/10 bg-black/25 hover:border-white/25"
                      }`}
                    >
                      <span className="flex items-baseline gap-1.5">
                        <span className="truncate text-[13px] text-neutral-100">
                          {node.name}
                        </span>
                        {path.length ? (
                          <span className="shrink-0 truncate font-mono text-[10px] text-neutral-600">
                            {path.join("/")}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-neutral-500">
                        {snippet ?? "name match"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
          <ul className="space-y-2">
            {docs.map((node, i) => (
              <DocCard
                key={node.id}
                node={node}
                depth={0}
                openIds={openIds}
                onOpen={onOpenDoc}
                onAdd={handleAdd}
                onRemove={handleRemove}
                // Import controls live inside the root card rather than in a
                // page-level footer — they act on this tree, so they belong
                // where the tree is.
                actions={
                  i === 0 ? (
                    <div className="mt-1.5 space-y-1.5">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          disabled={importing}
                          className="flex-1 rounded-md border border-white/12 bg-white/[0.06] px-2 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-white/12 disabled:opacity-50"
                        >
                          {importing ? "Importing…" : "+ Import .md"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFetchOpen((v) => !v)}
                          className="flex-1 rounded-md border border-white/12 bg-white/[0.06] px-2 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-white/12"
                        >
                          + Fetch
                        </button>
                      </div>

                      {fetchOpen ? (
                        <div className="rounded-md border border-white/10 bg-black/30 p-2">
                          <input
                            value={fetchUrl}
                            onChange={(e) => setFetchUrl(e.target.value)}
                            placeholder="https://github.com/owner/repo"
                            className="w-full rounded border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-white/25 focus:outline-none"
                          />
                          <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-amber-400/80">
                            Needs a server route — the browser can&apos;t fetch a
                            third-party repo directly (CORS). Wired when the
                            backend lands.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null
                }
              />
            ))}
          </ul>
          )}
        </nav>

        <footer className="shrink-0 border-t border-white/10 px-3 py-2 font-mono text-[10px] text-neutral-500">
          {hits
            ? `${hits.length} match${hits.length === 1 ? "" : "es"}`
            : openIds.size > 0
              ? `${openIds.size} open on canvas`
              : "click a file to open it on the canvas"}
        </footer>
      </aside>
    </>
  );
}

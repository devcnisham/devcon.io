"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type WorkspaceMeta,
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  originLabel,
  relativeTime,
} from "@/lib/workspaces/store";
import { WorkspaceThumb } from "../WorkspaceThumb";

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2.5 6.5A1.5 1.5 0 014 5h3.2l1.4 1.8H16a1.5 1.5 0 011.5 1.5v6.2A1.5 1.5 0 0116 16H4a1.5 1.5 0 01-1.5-1.5v-8z" strokeLinejoin="round" />
    </svg>
  );
}
function RepoIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="15" r="2" />
      <circle cx="14" cy="10" r="2" />
      <path d="M6 7v6M8 15h1.5A2.5 2.5 0 0012 12.5V12" strokeLinecap="round" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8.5 11.5a3 3 0 004.24 0l2.5-2.5a3 3 0 10-4.24-4.24l-1 1" strokeLinecap="round" />
      <path d="M11.5 8.5a3 3 0 00-4.24 0l-2.5 2.5a3 3 0 104.24 4.24l1-1" strokeLinecap="round" />
    </svg>
  );
}

type ActionKey = "new" | "folder" | "repo" | "link";

/**
 * Still genuinely blocked. `folder` is NOT in here any more — the dev-only
 * scan route makes it real, and leaving an apology on a working button is
 * worse than having no button.
 */
const NEEDS_BACKEND: Record<"repo" | "link", string> = {
  repo: "Cloning would need a server route that shells out to git — a command-execution surface I'd rather not add for convenience. Clone it yourself, then use Open folder.",
  link: "Opening from a link needs the project token to resolve server-side, which needs the backend.",
};

export default function HomePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // localStorage is client-only, so read after mount rather than during render.
  useEffect(() => setWorkspaces(listWorkspaces()), []);

  const [folderOpen, setFolderOpen] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleNew = () => {
    const meta = createWorkspace();
    router.push(`/canvas?w=${meta.id}`);
  };

  /** Validate the path by scanning it before creating anything. */
  const openFolder = async () => {
    const target = pathInput.trim();
    if (!target) return;
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch(`/api/scan?path=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (data.error) {
        setScanError(data.hint ? `${data.error} — ${data.hint}` : data.error);
        return;
      }
      const meta = createWorkspace(data.name ?? "Project", "folder", data.root);
      router.push(`/canvas?w=${meta.id}`);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleDelete = (id: string) => {
    deleteWorkspace(id);
    setWorkspaces(listWorkspaces());
  };

  const actions: { key: ActionKey; label: string; icon: React.ReactNode }[] = [
    { key: "new", label: "New workspace", icon: <PlusIcon /> },
    { key: "folder", label: "Open folder", icon: <FolderIcon /> },
    { key: "repo", label: "Clone repo", icon: <RepoIcon /> },
    { key: "link", label: "Open from link", icon: <LinkIcon /> },
  ];

  return (
    <main
      className="min-h-screen text-neutral-200"
      style={{
        background: `
          radial-gradient(900px 600px at 12% -5%, rgba(56,132,180,0.10), transparent 60%),
          radial-gradient(800px 500px at 88% 5%, rgba(120,80,180,0.08), transparent 55%),
          #0a0a0b
        `,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-8 py-20">
        <h1 className="mb-6 text-xl font-semibold text-white">Open or create</h1>

        <div className="flex flex-wrap gap-3">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => {
                setNotice(null);
                if (a.key === "new") return handleNew();
                if (a.key === "folder") {
                  setFolderOpen((v) => !v);
                  return;
                }
                setFolderOpen(false);
                setNotice(NEEDS_BACKEND[a.key as "repo" | "link"]);
              }}
              className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.03] px-5 py-3.5 text-[15px] text-neutral-200 transition-colors hover:border-white/25 hover:bg-white/[0.07]"
            >
              <span className="text-neutral-400">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>

        {folderOpen ? (
          <div className="mt-4 max-w-2xl rounded-xl border border-white/15 bg-white/[0.03] p-4">
            <p className="mb-2 text-sm text-neutral-300">
              Absolute path to a repo on this machine.
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && openFolder()}
                placeholder="/Users/you/code/my-project"
                className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-2 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
              />
              <button
                type="button"
                onClick={openFolder}
                disabled={scanning}
                className="shrink-0 rounded-lg border border-white/15 bg-white/[0.08] px-4 py-2 text-sm text-neutral-100 transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                {scanning ? "Scanning…" : "Open"}
              </button>
            </div>
            {scanError ? (
              <p className="mt-2 rounded-lg border border-red-400/30 bg-red-400/[0.08] px-3 py-2 text-sm text-red-300">
                {scanError}
              </p>
            ) : null}
            <p className="mt-2.5 text-xs leading-relaxed text-neutral-500">
              Reads structure only — dependency names, config filenames, the
              directory tree, and key <em>names</em> from{" "}
              <code className="font-mono">.env.example</code>. Never source
              code, never <code className="font-mono">.env</code>. The scan
              route is dev-only and returns 404 in production.
            </p>
          </div>
        ) : null}

        {notice ? (
          <p className="mt-4 max-w-2xl rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-4 py-2.5 text-sm leading-relaxed text-amber-200/90">
            {notice}
          </p>
        ) : null}

        <div className="mt-14">
          <h2 className="mb-5 flex items-baseline gap-2 text-lg font-semibold text-white">
            Recent
            <span className="font-mono text-sm font-normal text-neutral-500">
              · {workspaces.length}
            </span>
          </h2>

          {workspaces.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No workspaces yet. Create one to get started.
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
              {workspaces.map((w) => (
                <li key={w.id}>
                  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-colors hover:border-white/25">
                    <button
                      type="button"
                      onClick={() => router.push(`/canvas?w=${w.id}`)}
                      className="block w-full text-left"
                    >
                      <span className="block aspect-[4/3] w-full border-b border-white/10">
                        <WorkspaceThumb id={w.id} />
                      </span>
                      <span className="block px-4 py-3">
                        <span className="block truncate text-[15px] text-neutral-100">
                          {w.name}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-neutral-500">
                          {originLabel(w.origin)} · {relativeTime(w.updatedAt)}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      title="Remove"
                      onClick={() => handleDelete(w.id)}
                      className="absolute right-2 top-2 rounded-md border border-white/15 bg-neutral-950/80 px-1.5 py-0.5 text-xs text-neutral-400 opacity-0 backdrop-blur transition-opacity hover:text-red-300 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

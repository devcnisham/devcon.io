"use client";

import { useState } from "react";
import type { ProjectProfile } from "@/lib/catalog/types";
import { type Inference, profileFromDigest } from "@/lib/scan/profile";
import { type RepoDigest, type ScanResult, isScanError } from "@/lib/scan/types";

export function ProjectLoader({
  onLoaded,
  onClear,
  loaded,
}: {
  onLoaded: (profile: ProjectProfile, digest: RepoDigest, ev: Inference["evidence"]) => void;
  onClear: () => void;
  loaded: RepoDigest | null;
}) {
  const [open, setOpen] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    const target = pathInput.trim();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scan?path=${encodeURIComponent(target)}`);
      const data: ScanResult = await res.json();
      if (isScanError(data)) {
        setError(data.hint ? `${data.error} — ${data.hint}` : data.error);
        return;
      }
      const { profile, evidence } = profileFromDigest(data);
      onLoaded(profile, data, evidence);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  if (loaded) {
    return (
      <span className="flex items-center gap-2">
        <span
          className="max-w-[200px] truncate rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-300"
          title={loaded.root}
        >
          {loaded.name}
        </span>
        <button
          type="button"
          onClick={onClear}
          title="Back to sample projects"
          className="rounded border border-white/15 px-2 py-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </span>
    );
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-white/15 px-2 py-1 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        open project
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-50 w-[420px] rounded-xl border border-white/15 bg-neutral-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <p className="mb-2 text-xs text-neutral-400">
            Absolute path to a repo on this machine.
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scan()}
              placeholder="/Users/you/code/my-project"
              className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-2 font-mono text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={scan}
              disabled={busy}
              className="shrink-0 rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2 text-xs text-neutral-100 transition-colors hover:bg-white/15 disabled:opacity-50"
            >
              {busy ? "Scanning…" : "Scan"}
            </button>
          </div>

          {error ? (
            <p className="mt-2 rounded-lg border border-red-400/30 bg-red-400/[0.08] px-2.5 py-1.5 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <p className="mt-2.5 text-[11px] leading-relaxed text-neutral-500">
            Reads structure only — dependency names, config filenames, directory
            tree, and key <em>names</em> from{" "}
            <code className="font-mono">.env.example</code>. Never source code,
            never <code className="font-mono">.env</code>. Dev-server only; the
            route returns 404 in production.
          </p>
        </div>
      ) : null}
    </span>
  );
}

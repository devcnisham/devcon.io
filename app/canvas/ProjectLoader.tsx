"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectProfile } from "@/lib/catalog/types";
import { buildDigest } from "@/lib/scan/digest";
import { type Inference, profileFromDigest } from "@/lib/scan/profile";
import type { FileSource } from "@/lib/scan/source";
import { droppedCoverage, droppedSource } from "@/lib/scan/sources/dropped";
import { folderPickerAvailable, pickFolder } from "@/lib/scan/sources/folder";
import {
  GitHubScanError,
  githubSource,
  parseRepoInput,
} from "@/lib/scan/sources/github";
import { type ScanResult, isScanError } from "@/lib/scan/types";

/** Local-path scanning only exists on a dev server — the route 404s in production. */
const DEV_SCAN = process.env.NODE_ENV !== "production";

type Tab = "folder" | "github" | "files" | "path";

export function ProjectLoader({
  onLoaded,
  onClear,
  loaded,
  open,
  setOpen,
}: {
  onLoaded: (
    profile: ProjectProfile,
    digest: import("@/lib/scan/types").RepoDigest,
    ev: Inference["evidence"],
  ) => void;
  onClear: () => void;
  loaded: import("@/lib/scan/types").RepoDigest | null;
  /** Lifted so the canvas empty state can open this panel too. */
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>(
    folderPickerAvailable() ? "folder" : "github",
  );
  const [pathInput, setPathInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The picker only exists in Chromium, and that isn't knowable during SSR.
  useEffect(() => {
    if (!folderPickerAvailable() && tab === "folder") setTab("github");
  }, [tab]);

  /** One place where a source becomes a loaded project, whichever tab produced it. */
  const ingest = async (source: FileSource, label: string) => {
    setBusy(label);
    setError(null);
    try {
      const digest = await buildDigest(source);
      const { profile, evidence } = profileFromDigest(digest);
      onLoaded(profile, digest, evidence);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that project");
    } finally {
      setBusy(null);
    }
  };

  const openFolder = async () => {
    setError(null);
    const source = await pickFolder();
    if (!source) return; // Dismissed the picker. Not an error.
    await ingest(source, "Reading folder…");
  };

  const openGithub = async () => {
    const target = parseRepoInput(repoInput);
    if (!target) {
      setError("Give a repo as owner/name or a github.com URL.");
      return;
    }
    setBusy("Reading repo…");
    setError(null);
    try {
      await ingest(await githubSource(target), "Reading repo…");
    } catch (e) {
      if (e instanceof GitHubScanError) {
        setError(e.hint ? `${e.message} — ${e.hint}` : e.message);
      } else {
        setError(e instanceof Error ? e.message : "Could not reach GitHub");
      }
      setBusy(null);
    }
  };

  const openFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    setNote(
      droppedCoverage(list) === "manifest-only"
        ? "Read from loose files: no directory tree, so nothing can be pre-marked as already done."
        : null,
    );
    await ingest(droppedSource(list), "Reading files…");
  };

  const scanPath = async () => {
    const target = pathInput.trim();
    if (!target) return;
    setBusy("Scanning…");
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
      setBusy(null);
    }
  };

  if (loaded) {
    return (
      <span className="flex items-center gap-2">
        <span
          className="max-w-[220px] truncate rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-300"
          title={loaded.gitRemote?.url ?? loaded.root}
        >
          {loaded.gitRemote
            ? `${loaded.gitRemote.owner}/${loaded.gitRemote.repo}`
            : loaded.name}
        </span>
        <button
          type="button"
          onClick={onClear}
          title="Close this project"
          className="rounded border border-white/15 px-2 py-1 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </span>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    ...(folderPickerAvailable()
      ? [{ key: "folder" as const, label: "Folder" }]
      : []),
    { key: "github", label: "GitHub" },
    { key: "files", label: "Files" },
    ...(DEV_SCAN ? [{ key: "path" as const, label: "Path" }] : []),
  ];

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded border border-white/15 px-2 py-1 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        open project
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-50 w-[440px] rounded-xl border border-white/15 bg-neutral-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="mb-3 flex gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setError(null);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  tab === t.key
                    ? "border-sky-400/40 bg-sky-400/15 text-sky-200"
                    : "border-white/12 bg-white/[0.03] text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "folder" ? (
            <div>
              <p className="mb-2 text-xs leading-relaxed text-neutral-400">
                Your browser reads the folder on this machine. Nothing is
                uploaded and no server is involved — the digest never leaves the
                page.
              </p>
              <button
                type="button"
                onClick={openFolder}
                disabled={Boolean(busy)}
                className="w-full rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-2 text-xs text-sky-100 transition-colors hover:bg-sky-400/25 disabled:opacity-50"
              >
                {busy ?? "Choose folder…"}
              </button>
            </div>
          ) : null}

          {tab === "github" ? (
            <div>
              <p className="mb-2 text-xs text-neutral-400">
                A public repository. No sign-in.
              </p>
              <div className="flex gap-2">
                <input
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && openGithub()}
                  placeholder="owner/repo or a github.com URL"
                  className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-2 font-mono text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={openGithub}
                  disabled={Boolean(busy)}
                  className="shrink-0 rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2 text-xs text-neutral-100 transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  {busy ?? "Read"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                Private repos need a sign-in DevCon doesn&apos;t have yet.
                There is deliberately no field here that takes a token.
              </p>
            </div>
          ) : null}

          {tab === "files" ? (
            <div>
              <p className="mb-2 text-xs leading-relaxed text-neutral-400">
                Works in every browser. A whole folder gives the best result;{" "}
                <code className="font-mono">package.json</code> and{" "}
                <code className="font-mono">.env.example</code> alone are enough
                to start.
              </p>
              <input
                ref={fileInput}
                type="file"
                multiple
                onChange={(e) => openFiles(e.target.files)}
                className="block w-full text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border file:border-white/15 file:bg-white/[0.08] file:px-3 file:py-1.5 file:text-xs file:text-neutral-100"
              />
            </div>
          ) : null}

          {tab === "path" && DEV_SCAN ? (
            <div>
              <p className="mb-2 text-xs text-neutral-400">
                Absolute path to a repo on this machine.
              </p>
              <div className="flex gap-2">
                <input
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && scanPath()}
                  placeholder="/Users/you/code/my-project"
                  className="min-w-0 flex-1 rounded-lg border border-white/12 bg-black/40 px-3 py-2 font-mono text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={scanPath}
                  disabled={Boolean(busy)}
                  className="shrink-0 rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2 text-xs text-neutral-100 transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  {busy ?? "Scan"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                Dev server only. The route returns 404 in production — reading
                an arbitrary path on a deployed host would be a file-read
                primitive for anyone who can reach the URL.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="mt-2.5 rounded-lg border border-red-400/30 bg-red-400/[0.08] px-2.5 py-1.5 text-xs text-red-300">
              {error}
            </p>
          ) : null}
          {note ? (
            <p className="mt-2.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-2.5 py-1.5 text-xs text-amber-200/80">
              {note}
            </p>
          ) : null}

          <p className="mt-3 border-t border-white/8 pt-2.5 text-[11px] leading-relaxed text-neutral-500">
            Reads structure only — dependency names, config filenames, the
            directory tree, and key <em>names</em> from{" "}
            <code className="font-mono">.env.example</code>. Never source code,
            never <code className="font-mono">.env</code>, and no field anywhere
            accepts a key value.
          </p>
        </div>
      ) : null}
    </span>
  );
}

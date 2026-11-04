"use client";

import * as React from "react";
import { FolderOpen, RotateCw, Save, X } from "lucide-react";
import {
  createFileListSource,
  createHandleSource,
  supportsDirectoryPicker,
} from "@/features/codebase/lib/browser-source";
import {
  scanProject,
  type ScanProgress,
  type ScanResult,
  type ScanSource,
} from "@/features/codebase/lib/scan";
import type { InspectionSummary as Summary } from "@/features/codebase/lib/inspect";
import { readGitInfo, type GitInfo } from "@/features/codebase/lib/git-info";
import { InspectionSummary } from "@/features/codebase/components/inspection-summary";
import { DetectionSummary } from "@/features/codebase/components/detection-summary";
import { LanguageBreakdown } from "@/features/codebase/components/language-breakdown";
import { ToolchainSummary } from "@/features/codebase/components/toolchain-summary";
import { DependencySummary } from "@/features/codebase/components/dependency-summary";
import {
  analyzeProject,
  type ProjectAnalysis,
} from "@/features/codebase/lib/analyze";
import { diffIndex, type IndexSnapshot } from "@/features/codebase/lib/cache";
import {
  loadLatestImportAction,
  saveImportAction,
} from "@/features/codebase/lib/actions";
import {
  resolveSaveResult,
  type SaveState,
} from "@/features/codebase/lib/save-state";
import { AuthAlert } from "@/features/auth";
import { Button } from "@/components/ui/button";
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

type State =
  | { phase: "idle" }
  | { phase: "scanning"; progress: ScanProgress | null }
  | {
      phase: "done";
      result: ScanResult;
      summary: Summary;
      git: GitInfo;
      analysis: ProjectAnalysis;
      unchangedSince: number | null;
    }
  | { phase: "error"; message: string };

/**
 * Local project import.
 *
 * Nothing leaves the browser: files are read in the page to build an index.
 * Rescan is only offered when a live directory handle exists, which is the
 * File System Access API path — the directory-input fallback is a snapshot.
 */
export function ImportProject({ projectId }: { projectId: string }) {
  const [state, setState] = React.useState<State>({ phase: "idle" });
  // The handle drives what renders (the Rescan button), so it is state, not a
  // ref — a ref read during render neither triggers an update nor is safe.
  const [handle, setHandle] = React.useState<FileSystemDirectoryHandle | null>(
    null
  );
  const [previousSnapshot, setPreviousSnapshot] =
    React.useState<IndexSnapshot | null>(null);
  const [saveState, setSaveState] = React.useState<SaveState>({
    status: "idle",
  });
  // The saved scan this project already has, shown as a status line on mount
  // (load-back wiring, final review round). A line only — the full breakdown
  // is a fresh scan's job, so nothing of the old scan is re-rendered.
  const [savedScan, setSavedScan] = React.useState<{
    scannedAt: string;
    fileCount: number;
  } | null>(null);
  // Identifies the current scan. Every completed scan bumps it, so a save
  // started on an older scan can tell (via resolveSaveResult) that the scan
  // it saved is no longer the one on screen.
  const scanTokenRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const canRescan = handle !== null;

  // Load-back: opening the import screen for a project that already has a
  // saved scan shows its status line instead of pretending nothing exists.
  // A failure or a missing scan renders nothing — the screen is exactly as
  // it was before the wiring.
  React.useEffect(() => {
    let cancelled = false;
    loadLatestImportAction(projectId).then((result) => {
      if (cancelled || !result.ok || !result.data) return;
      const scan = result.data as {
        entries?: unknown[];
        analysis?: { summary?: { fileCount?: number } };
        scannedAt?: Date | string;
      };
      if (!scan.scannedAt) return;
      setSavedScan({
        scannedAt:
          scan.scannedAt instanceof Date
            ? scan.scannedAt.toISOString()
            : String(scan.scannedAt),
        // The analysis JSONB carries the InspectionSummary; entries.length is
        // the fallback when a scan predates it.
        fileCount:
          scan.analysis?.summary?.fileCount ?? scan.entries?.length ?? 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function runScan(source: ScanSource) {
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ phase: "scanning", progress: null });

    try {
      const result = await scanProject(source, {
        signal: controller.signal,
        onProgress: (progress) => setState({ phase: "scanning", progress }),
      });

      if (result.cancelled) {
        // A cancelled scan is discarded rather than shown — a partial index
        // would misrepresent the project.
        setState({ phase: "idle" });
        return;
      }

      // Git data lives inside .git/, which the scanner deliberately ignores,
      // so it is read separately.
      const git = await readGitInfo(source);
      const analysis = await analyzeProject(source, result.indexed);

      // Compare against the previous scan to report how much was unchanged.
      const diff = diffIndex(previousSnapshot, analysis.snapshot);
      setPreviousSnapshot(analysis.snapshot);
      // A fresh scan has not been saved — the saved-state line resets, and
      // the token moves on so any in-flight save is unbound from the scan it
      // started on (see handleSave).
      scanTokenRef.current += 1;
      setSaveState({ status: "idle" });

      setState({
        phase: "done",
        result,
        summary: analysis.summary,
        git,
        analysis,
        unchangedSince: previousSnapshot ? diff.unchanged.length : null,
      });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      abortRef.current = null;
    }
  }

  async function handleSave() {
    if (state.phase !== "done") return;
    // Bind this save to the scan it started on. If a rescan completes while
    // the action is in flight, the token will have moved on and this result
    // must not mark the new scan as saved.
    const tokenAtSave = scanTokenRef.current;
    setSaveState({ status: "saving" });

    const result = await saveImportAction({
      projectId,
      // Browsers do not expose a real filesystem path — the folder name is
      // the honest substitute for the codebase's rootPath.
      rootPath: handle?.name ?? "local folder",
      indexed: state.result.indexed,
      skipped: state.result.skipped,
      errors: state.result.errors,
      analysis: state.analysis,
    });

    setSaveState(resolveSaveResult(tokenAtSave, scanTokenRef.current, result));
  }

  async function pickFolder() {
    if (!supportsDirectoryPicker()) {
      inputRef.current?.click();
      return;
    }

    try {
      const picker = window.showDirectoryPicker;
      if (!picker) throw new Error("Directory picker unavailable");

      const picked = await picker({ mode: "read" });
      setHandle(picked);
      await runScan(createHandleSource(picked));
    } catch (error) {
      // Dismissing the picker is a choice, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;

      setState({
        phase: "error",
        message:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Permission to read that folder was denied. Pick it again and choose Allow."
            : error instanceof Error
              ? error.message
              : String(error),
      });
    }
  }

  const progress = state.phase === "scanning" ? state.progress : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={pickFolder} disabled={state.phase === "scanning"}>
          <FolderOpen className="size-4" />
          Select project folder
        </Button>

        {canRescan && state.phase !== "scanning" ? (
          <Button
            variant="outline"
            onClick={() => handle && runScan(createHandleSource(handle))}
            // Belt and braces alongside the scan-token binding: a rescan
            // mid-save would outdate the in-flight save's subject.
            disabled={saveState.status === "saving"}
          >
            <RotateCw className="size-4" />
            Rescan
          </Button>
        ) : null}

        {state.phase === "done" ? (
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={
              saveState.status === "saving" || saveState.status === "saved"
            }
          >
            <Save className="size-4" />
            Save index
          </Button>
        ) : null}

        {state.phase === "scanning" ? (
          <Button variant="outline" onClick={() => abortRef.current?.abort()}>
            <X className="size-4" />
            Cancel
          </Button>
        ) : null}
      </div>

      {savedScan ? (
        <p className="text-muted-foreground text-sm">
          Saved scan from{" "}
          <time dateTime={savedScan.scannedAt}>
            {new Date(savedScan.scannedAt).toLocaleString()}
          </time>{" "}
          — {savedScan.fileCount} file
          {savedScan.fileCount === 1 ? "" : "s"} indexed.
        </p>
      ) : null}

      {/* Fallback for browsers without the File System Access API. */}
      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error non-standard but universally supported
        webkitdirectory=""
        multiple
        hidden
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) {
            setHandle(null); // snapshot only — no rescan
            void runScan(createFileListSource(files));
          }
        }}
      />

      <p className="text-muted-foreground text-sm">
        Files are read in your browser to build an index. Nothing is uploaded.
      </p>

      {state.phase === "error" ? (
        <AuthAlert variant="error" message={state.message} />
      ) : null}

      {state.phase === "scanning" ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <div className="flex items-center gap-2 text-sm">
            <Spinner />
            <span>
              Scanned {progress?.scanned ?? 0} · indexed{" "}
              {progress?.indexed ?? 0} · skipped {progress?.skipped ?? 0}
            </span>
          </div>
          {/* Total entry count is unknown until the walk finishes, so this is
              deliberately indeterminate rather than a fabricated percentage. */}
          <Progress value={null}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <p className="text-muted-foreground truncate text-xs">
            {progress?.currentPath ?? "Starting…"}
          </p>
        </div>
      ) : null}

      {state.phase === "done" ? (
        <>
          <ScanSummary
            result={state.result}
            canRescan={canRescan}
            save={saveState}
          />

          {state.unchangedSince !== null ? (
            <p className="text-muted-foreground text-xs">
              Rescan complete — {state.unchangedSince} file
              {state.unchangedSince === 1 ? "" : "s"} unchanged since the last
              scan.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t pt-4">
            <h2 className="text-sm font-medium">
              What this project is made of
            </h2>
            <InspectionSummary summary={state.summary} git={state.git} />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4">
            <h2 className="text-sm font-medium">How to run it</h2>
            <ToolchainSummary toolchain={state.analysis.toolchain} />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4">
            <h2 className="text-sm font-medium">Dependencies</h2>
            <DependencySummary report={state.analysis.dependencies} />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4">
            <h2 className="text-sm font-medium">Languages</h2>
            <LanguageBreakdown breakdown={state.analysis.languages} />
          </div>

          <div className="flex flex-col gap-3 border-t pt-4">
            <h2 className="text-sm font-medium">
              What this project appears to be
            </h2>
            <DetectionSummary
              frameworks={state.analysis.frameworks}
              features={state.analysis.features}
              architecture={state.analysis.architecture}
              runtimes={state.analysis.runtimes}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ScanSummary({
  result,
  canRescan,
  save,
}: {
  result: ScanResult;
  canRescan: boolean;
  save: SaveState;
}) {
  const bucket = (reason: string) =>
    result.skipped.filter((file) => file.reason === reason).length;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Indexed", result.indexed.length],
            ["Ignored", bucket("ignored")],
            ["Binary", bucket("binary")],
            ["Too large", bucket("large")],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {result.errors.length > 0 ? (
        <div className="border-destructive/40 flex flex-col gap-1 rounded-lg border p-3">
          <p className="text-sm font-medium">
            {result.errors.length} file
            {result.errors.length === 1 ? "" : "s"} could not be read
          </p>
          <p className="text-muted-foreground text-xs">
            The rest of the project was indexed normally.
          </p>
          <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
            {result.errors.slice(0, 5).map((error) => (
              <li key={error.path} className="truncate">
                {error.path} — {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!canRescan ? (
        <p className="text-muted-foreground text-xs">
          Your browser gave a snapshot of the folder rather than live access, so
          rescanning means picking it again. Chrome and Edge support live
          access.
        </p>
      ) : null}

      {save.status === "idle" ? (
        <p className="text-muted-foreground text-xs">
          The index is not saved yet — save it to attach it to this project.
        </p>
      ) : save.status === "saving" ? (
        <p className="text-muted-foreground text-xs">Saving the index…</p>
      ) : save.status === "saved" ? (
        <AuthAlert variant="success" message="Index saved." />
      ) : (
        <AuthAlert variant="error" message={save.message} />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Presentation,
  Table2,
  Upload,
  Send,
  Plus,
  Download,
  History,
  Copy,
  Trash2,
  Pencil,
  FolderOpen,
  MessageSquare,
  X,
  RotateCcw,
  Check,
  LoaderCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type {
  FileContent,
  FileJob,
  FileKind,
  FileRevision,
  FileSnapshot,
  WorkspaceFile,
} from "../types";
import { DocumentEditor } from "./document-editor";
import { SlideEditor } from "./slide-editor";
import { SheetEditor } from "./sheet-editor";
import "../files.css";

type Detail = {
  file: WorkspaceFile;
  revision: FileRevision;
  revisions: FileRevision[];
  originalUrl?: string;
};
type SaveState = "saved" | "dirty" | "saving" | "failed" | "conflict";
const fileLabels: Record<FileKind, string> = {
  document: "Document",
  presentation: "Slides",
  spreadsheet: "Spreadsheet",
};
const fileIcons = {
  document: FileText,
  presentation: Presentation,
  spreadsheet: Table2,
};
const formats: Record<FileKind, string[]> = {
  document: ["docx", "pdf", "md"],
  presentation: ["pptx", "pdf"],
  spreadsheet: ["xlsx", "csv", "pdf"],
};
const emptySnapshot: FileSnapshot = {
  files: [],
  messages: [],
  jobs: [],
  canEdit: false,
  aiAvailable: false,
  workerAvailable: false,
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const body = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(body.error || "The request could not be completed."),
      { status: response.status, body }
    );
  return body as T;
}
function json(method: string, value?: unknown): RequestInit {
  return {
    method,
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  };
}

export function FileWorkspace({ projectId }: { projectId: string }) {
  const base = `/api/projects/${encodeURIComponent(projectId)}/files`;
  const [snapshot, setSnapshot] = useState<FileSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState<FileContent | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<FileKind>("document");
  const [tab, setTab] = useState<"chat" | "file">("file");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [originalOpen, setOriginalOpen] = useState(false);
  const [conflictRevision, setConflictRevision] = useState<FileRevision | null>(
    null
  );
  const [alternate, setAlternate] = useState<FileRevision | null>(null);
  const [versionPreview, setVersionPreview] = useState<FileRevision | null>(
    null
  );
  const [editorMode, setEditorMode] = useState<"preview" | "edit">("edit");
  const [streamText, setStreamText] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);
  const draftRef = useRef<FileContent | null>(null);
  const detailRef = useRef<Detail | null>(null);
  const savingRef = useRef(false);
  const loadVersion = useRef(0);
  const completedJobs = useRef(new Set<string>());
  const watchedJobs = useRef(new Set<string>());
  const streamRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    const data = await api<FileSnapshot>(base);
    setSnapshot(data);
    return data;
  }, [base]);
  const loadFile = useCallback(
    async (fileId: string, force = false) => {
      if (!force && savingRef.current) {
        setError("Please wait for your changes to finish saving.");
        return;
      }
      if (
        !force &&
        dirtyRef.current &&
        !window.confirm(
          "This file has unsaved changes. Discard them and open another file?"
        )
      )
        return;
      const version = ++loadVersion.current;
      try {
        const data = await api<Detail>(`${base}/${fileId}`);
        if (version !== loadVersion.current) return;
        detailRef.current = data;
        draftRef.current = data.revision.content;
        dirtyRef.current = false;
        setDetail(data);
        setDraft(data.revision.content);
        setSaveState("saved");
        setConflictRevision(null);
        setAlternate(null);
        setVersionPreview(null);
        setEditorMode("edit");
        setOriginalOpen(false);
        setLibraryOpen(false);
        setTab("file");
      } catch (cause) {
        setError((cause as Error).message);
      }
    },
    [base]
  );

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void refresh()
        .then((data) => {
          if (!cancelled && data.files.length)
            void loadFile(data.files[0].id, true);
        })
        .catch((cause) => {
          if (!cancelled) setError((cause as Error).message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      streamRef.current?.close();
    };
  }, [refresh, loadFile]);

  useEffect(() => {
    if (!libraryOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLibraryOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [libraryOpen]);

  const changeDraft = (content: FileContent) => {
    draftRef.current = content;
    dirtyRef.current = true;
    setDraft(content);
    setSaveState((state) =>
      state === "conflict" || state === "saving" ? state : "dirty"
    );
    setAlternate(null);
  };
  const save = useCallback(
    async (baseRevisionId?: string) => {
      const current = detailRef.current,
        content = draftRef.current;
      if (!current || !content || savingRef.current) return;
      savingRef.current = true;
      setSaveState("saving");
      try {
        const result = await api<{
          file: WorkspaceFile;
          revision: FileRevision;
        }>(
          `${base}/${current.file.id}`,
          json("PATCH", {
            action: "save",
            baseRevisionId: baseRevisionId ?? current.revision.id,
            content,
          })
        );
        if (detailRef.current?.file.id !== current.file.id) return;
        const updated = {
          ...current,
          file: result.file,
          revision: result.revision,
          revisions: [result.revision, ...current.revisions],
        };
        detailRef.current = updated;
        setDetail(updated);
        setConflictRevision(null);
        const changed =
          JSON.stringify(draftRef.current) !== JSON.stringify(content);
        dirtyRef.current = changed;
        setSaveState(changed ? "dirty" : "saved");
        setSnapshot((old) => ({
          ...old,
          files: old.files.map((item) =>
            item.id === result.file.id ? result.file : item
          ),
        }));
      } catch (cause) {
        const failure = cause as Error & {
          status?: number;
          body?: { revision?: FileRevision };
        };
        if (failure.status === 409 && failure.body?.revision) {
          setConflictRevision(failure.body.revision);
          setSaveState("conflict");
        } else {
          setError(failure.message);
          setSaveState("failed");
        }
      } finally {
        savingRef.current = false;
      }
    },
    [base]
  );
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => {
      void save();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draft, saveState, save]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, []);

  const observeJob = useCallback(
    (jobId: string) => {
      streamRef.current?.close();
      setStreamText("");
      const source = new EventSource(`${base}/jobs/${jobId}/stream`);
      streamRef.current = source;
      source.addEventListener("progress", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          if (data.text) setStreamText(data.text);
        } catch {
          /* Polling remains available. */
        }
      });
      source.addEventListener("done", () => {
        source.close();
        setStreamText("");
        void refresh().catch(() => undefined);
      });
      source.onerror = () => {
        source.close();
        setStreamText("");
      };
    },
    [base, refresh]
  );

  useEffect(() => {
    const active = snapshot.jobs.some(
      (job) => job.status === "queued" || job.status === "running"
    );
    if (!active) return;
    const timer = window.setInterval(() => {
      void refresh().catch((cause) => setError((cause as Error).message));
    }, 1800);
    return () => window.clearInterval(timer);
  }, [snapshot.jobs, refresh]);
  useEffect(() => {
    for (const job of snapshot.jobs) {
      if (job.status !== "succeeded" || completedJobs.current.has(job.id))
        continue;
      completedJobs.current.add(job.id);
      const isRecent = watchedJobs.current.has(job.id);
      if (
        isRecent &&
        job.result?.fileId &&
        !dirtyRef.current &&
        !savingRef.current &&
        !job.result.conflict &&
        job.kind !== "export"
      )
        void loadFile(job.result.fileId, true);
    }
  }, [snapshot.jobs, loadFile]);

  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const create = () =>
    action(async () => {
      if (
        dirtyRef.current &&
        !window.confirm("Discard unsaved changes and create another file?")
      )
        return;
      const name = window
        .prompt(
          `Name your ${fileLabels[kind].toLowerCase()}`,
          `Untitled ${fileLabels[kind].toLowerCase()}`
        )
        ?.trim();
      if (!name) return;
      const result = await api<{ file: WorkspaceFile }>(
        base,
        json("POST", { name, kind })
      );
      await refresh();
      await loadFile(result.file.id, true);
    });
  const fileAction = (type: "rename" | "duplicate" | "delete") =>
    action(async () => {
      if (!detail) return;
      if (type !== "rename" && (dirtyRef.current || savingRef.current))
        throw new Error("Save or resolve your current changes first.");
      if (type === "delete") {
        if (!window.confirm(`Delete “${detail.file.name}”?`)) return;
        await api(`${base}/${detail.file.id}`, json("DELETE"));
        detailRef.current = null;
        draftRef.current = null;
        setDetail(null);
        setDraft(null);
        const next = await refresh();
        if (next.files[0]) await loadFile(next.files[0].id, true);
      } else {
        const name =
          type === "rename"
            ? window.prompt("File name", detail.file.name)?.trim()
            : undefined;
        if (type === "rename" && !name) return;
        const result = await api<{ file: WorkspaceFile }>(
          `${base}/${detail.file.id}`,
          json("PATCH", { action: type, ...(name ? { name } : {}) })
        );
        await refresh();
        if (type === "duplicate") await loadFile(result.file.id, true);
        else {
          const updated = { ...detailRef.current!, file: result.file };
          detailRef.current = updated;
          setDetail(updated);
        }
      }
    });
  const importFile = (file?: File) =>
    action(async () => {
      if (!file) return;
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Choose a file smaller than 20 MB.");
      const form = new FormData();
      form.append("file", file);
      const result = await api<{ jobId: string }>(`${base}/import`, {
        method: "POST",
        body: form,
      });
      watchedJobs.current.add(result.jobId);
      await refresh();
    });
  const send = () =>
    action(async () => {
      if (!prompt.trim()) return;
      if (dirtyRef.current || savingRef.current)
        throw new Error("Save your edits before asking for a revision.");
      const result = await api<{ jobId: string }>(
        `${base}/chat`,
        json("POST", {
          message: prompt.trim(),
          kind,
          ...(detail
            ? { fileId: detail.file.id, baseRevisionId: detail.revision.id }
            : {}),
        })
      );
      watchedJobs.current.add(result.jobId);
      setPrompt("");
      await refresh();
      observeJob(result.jobId);
    });
  const exportFile = (format: string) =>
    action(async () => {
      if (!detail) return;
      if (dirtyRef.current || savingRef.current)
        throw new Error("Save your edits before downloading.");
      await api<{ jobId: string }>(
        `${base}/${detail.file.id}/export`,
        json("POST", {
          revisionId: alternate?.id ?? versionPreview?.id ?? detail.revision.id,
          format,
        })
      );
      setExportOpen(false);
      await refresh();
    });
  const revisionAction = (revisionId: string, type: "restore" | "apply") =>
    action(async () => {
      if (!detail) return;
      if (
        (dirtyRef.current || savingRef.current) &&
        !window.confirm("Discard your unsaved draft and use this revision?")
      )
        return;
      await api(
        `${base}/${detail.file.id}`,
        json("PATCH", {
          action: type,
          revisionId,
          baseRevisionId: detail.revision.id,
        })
      );
      await loadFile(detail.file.id, true);
      await refresh();
    });
  const previewAlternate = (job: FileJob) =>
    action(async () => {
      if (!job.result?.fileId || !job.result.revisionId) return;
      if (detail?.file.id !== job.result.fileId) {
        await loadFile(job.result.fileId);
        if (
          dirtyRef.current ||
          detailRef.current?.file.id !== job.result.fileId
        )
          return;
      }
      const data = await api<Detail>(`${base}/${job.result.fileId}`);
      const revision = data.revisions.find(
        (item) => item.id === job.result?.revisionId
      );
      if (revision) {
        setAlternate(revision);
        setTab("file");
      }
    });
  const importPending =
    !!detail &&
    snapshot.jobs.some(
      (job) =>
        job.fileId === detail.file.id &&
        job.kind === "import" &&
        (job.status === "queued" || job.status === "running")
    );
  const readOnly =
    !snapshot.canEdit ||
    !!alternate ||
    !!versionPreview ||
    editorMode === "preview" ||
    importPending;
  const visibleContent = alternate?.content ?? versionPreview?.content ?? draft;
  const versions =
    detail?.revisions.filter((revision) => !revision.conflict) ?? [];
  const versionIndex = versions.findIndex(
    (revision) => revision.id === (versionPreview?.id ?? detail?.revision.id)
  );
  const unsaved = saveState !== "saved";
  const generationActive = snapshot.jobs.some(
    (job) =>
      job.kind === "generate" && ["queued", "running"].includes(job.status)
  );

  if (loading)
    return (
      <div className="file-loading" role="status">
        <LoaderCircle className="file-spin" />
        Opening your file workspace…
      </div>
    );
  return (
    <section className="file-workspace" aria-label="Project file workspace">
      <header className="file-workspace-header">
        <div>
          <h1>Project files</h1>
          <p>A place to think, create, and keep your work.</p>
        </div>
        <div className="file-header-status">
          <span
            className={`file-status-dot ${snapshot.aiAvailable ? "ready" : ""}`}
          />
          {snapshot.aiAvailable
            ? "DeepSeek connected"
            : "AI connection required"}
        </div>
      </header>
      {error && (
        <div role="alert" className="file-alert error">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {!snapshot.canEdit && (
        <div className="file-alert">
          You have view-only access. You can preview files and download existing
          results.
        </div>
      )}
      <div className="file-mobile-bar">
        <button
          onClick={() => setLibraryOpen(!libraryOpen)}
          aria-expanded={libraryOpen}
        >
          <FolderOpen size={16} />
          Files ({snapshot.files.length})
        </button>
        <div role="tablist" aria-label="Workspace view">
          <button
            role="tab"
            aria-selected={tab === "chat"}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            role="tab"
            aria-selected={tab === "file"}
            onClick={() => setTab("file")}
          >
            Artifact
          </button>
        </div>
      </div>
      <div className={`file-workspace-panels mobile-${tab}`}>
        {libraryOpen && (
          <button
            className="file-library-backdrop"
            aria-label="Close file library"
            onClick={() => setLibraryOpen(false)}
          />
        )}
        <aside
          className={`file-library ${libraryOpen ? "open" : ""}`}
          aria-label="File library"
        >
          <div className="file-panel-heading">
            <h2>
              Your files <span>({snapshot.files.length})</span>
            </h2>
            <button
              aria-label="Close library"
              onClick={() => setLibraryOpen(false)}
            >
              <X size={15} />
            </button>
          </div>
          <label className="file-sr" htmlFor="file-create-kind">
            New file type
          </label>
          <select
            id="file-create-kind"
            value={kind}
            disabled={!snapshot.canEdit}
            onChange={(e) => setKind(e.target.value as FileKind)}
          >
            <option value="document">Document</option>
            <option value="presentation">Slides</option>
            <option value="spreadsheet">Spreadsheet</option>
          </select>
          <div className="file-library-actions">
            <button
              className="file-primary"
              disabled={busy || !snapshot.canEdit}
              onClick={() => void create()}
            >
              <Plus size={15} />
              Create
            </button>
            <button
              disabled={busy || !snapshot.canEdit || !snapshot.workerAvailable}
              title={
                !snapshot.workerAvailable
                  ? "File conversion worker is not connected"
                  : "Upload an existing file"
              }
              onClick={() => uploadRef.current?.click()}
            >
              <Upload size={15} />
              Upload
            </button>
          </div>
          <input
            ref={uploadRef}
            hidden
            type="file"
            accept=".docx,.pptx,.xlsx,.csv,.pdf"
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <nav className="file-list" aria-label="Project files">
            {snapshot.files.map((file) => {
              const Icon = fileIcons[file.kind];
              return (
                <button
                  key={file.id}
                  aria-current={
                    detail?.file.id === file.id ? "true" : undefined
                  }
                  onClick={() => void loadFile(file.id)}
                >
                  <Icon size={17} />
                  <span>
                    <strong>{file.name}</strong>
                    <small>
                      {fileLabels[file.kind]} ·{" "}
                      {new Date(file.updatedAt).toLocaleDateString()}
                    </small>
                  </span>
                </button>
              );
            })}
            {!snapshot.files.length && (
              <p className="file-library-empty">
                Your first brief, deck, or spreadsheet starts here.
              </p>
            )}
          </nav>
          <p className="file-library-note">
            DOCX · PPTX · XLSX · CSV · PDF
            <br />
            Uploads up to 20 MB
            {!snapshot.workerAvailable && (
              <>
                <br />
                Conversion worker not connected
              </>
            )}
          </p>
        </aside>
        <aside className="file-chat" aria-label="File assistant">
          <div className="file-panel-heading">
            <h2>
              <MessageSquare size={16} /> DevCon
            </h2>
            <span>DeepSeek</span>
          </div>
          <div className="file-messages" aria-live="polite">
            {!snapshot.messages.length && (
              <div className="file-chat-intro">
                <div className="file-assistant-mark" aria-hidden="true">
                  ✳
                </div>
                <h3>What shall we make?</h3>
                <p>
                  A first draft, a fresh perspective, or the finishing touches.
                  Tell me what you have in mind.
                </p>
                <button
                  disabled={!snapshot.canEdit || !snapshot.aiAvailable}
                  onClick={() => {
                    setKind("document");
                    setPrompt(
                      "Create a clear project brief with goals, milestones, risks, and next steps."
                    );
                  }}
                >
                  Draft a project brief <span>↗</span>
                </button>
                <button
                  disabled={!snapshot.canEdit || !snapshot.aiAvailable}
                  onClick={() => {
                    setKind("presentation");
                    setPrompt(
                      "Create a 6-slide project presentation covering the problem, solution, audience, roadmap, milestones, and next steps."
                    );
                  }}
                >
                  Build a presentation <span>↗</span>
                </button>
                <button
                  disabled={!snapshot.canEdit || !snapshot.aiAvailable}
                  onClick={() => {
                    setKind("spreadsheet");
                    setPrompt(
                      "Create a project budget spreadsheet with categories, estimated costs, actual costs, and totals using formulas."
                    );
                  }}
                >
                  Plan a budget <span>↗</span>
                </button>
              </div>
            )}
            {snapshot.messages.map((message) => (
              <article
                className={`file-message role-${message.role}`}
                key={message.id}
              >
                <span>{message.role === "user" ? "You" : "DevCon"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {streamText && (
              <article className="file-message role-assistant">
                <span>DevCon · working</span>
                <p>{streamText}</p>
              </article>
            )}
            {generationActive && !streamText && (
              <p className="file-typing">
                <LoaderCircle size={14} className="file-spin" />
                Shaping your file…
              </p>
            )}
          </div>
          <form
            className="file-compose"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label htmlFor="file-prompt">
              {detail
                ? `Revise “${detail.file.name}”`
                : `Create a ${fileLabels[kind].toLowerCase()}`}
            </label>
            <textarea
              id="file-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                snapshot.aiAvailable
                  ? "Describe what you want to make or change…"
                  : "Connect DeepSeek to create files with chat"
              }
              disabled={!snapshot.canEdit || !snapshot.aiAvailable}
              rows={3}
              maxLength={12000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div>
              <small>⌘ / Ctrl + Enter to send</small>
              <button
                className="file-primary"
                disabled={
                  busy ||
                  generationActive ||
                  !prompt.trim() ||
                  !snapshot.canEdit ||
                  !snapshot.aiAvailable ||
                  unsaved
                }
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </aside>
        <main
          className={`file-editor-panel ${readOnly ? "artifact-preview" : "artifact-edit"}`}
          aria-label="Artifact"
        >
          {detail && visibleContent ? (
            <>
              <header className="file-editor-header">
                <div className="file-editor-name">
                  <strong>{detail.file.name}</strong>
                  <span
                    className={`file-save-state state-${saveState}`}
                    role="status"
                  >
                    {saveState === "saved" ? (
                      <>
                        <Check size={12} />
                        Saved
                      </>
                    ) : saveState === "saving" ? (
                      <>
                        <LoaderCircle size={12} className="file-spin" />
                        Saving…
                      </>
                    ) : saveState === "dirty" ? (
                      "Unsaved changes"
                    ) : saveState === "conflict" ? (
                      "Conflict · draft preserved"
                    ) : (
                      "Save failed · draft preserved"
                    )}
                  </span>
                </div>
                <div className="file-editor-actions">
                  <button
                    aria-label="Rename file"
                    title="Rename"
                    disabled={!snapshot.canEdit || busy}
                    onClick={() => void fileAction("rename")}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label="Duplicate file"
                    title="Duplicate"
                    disabled={!snapshot.canEdit || busy || unsaved}
                    onClick={() => void fileAction("duplicate")}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    aria-label="Delete file"
                    title="Delete"
                    disabled={!snapshot.canEdit || busy || unsaved}
                    onClick={() => void fileAction("delete")}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    aria-label="Version history"
                    title="Version history"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen(!historyOpen)}
                  >
                    <History size={15} />
                  </button>
                  <div className="file-export">
                    <button
                      disabled={busy || unsaved || !snapshot.canEdit}
                      aria-expanded={exportOpen}
                      onClick={() => setExportOpen(!exportOpen)}
                    >
                      <Download size={15} />
                      Export
                    </button>
                    {exportOpen && (
                      <div className="file-export-menu">
                        {formats[detail.file.kind].map((format) => (
                          <button
                            key={format}
                            disabled={
                              !snapshot.workerAvailable && format !== "md"
                            }
                            onClick={() => void exportFile(format)}
                          >
                            {format.toUpperCase()}
                            <small>
                              {!snapshot.workerAvailable && format !== "md"
                                ? "Worker required"
                                : "Download"}
                            </small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </header>
              <div className="file-artifact-controls">
                <div
                  className="file-mode-switch"
                  role="group"
                  aria-label="Artifact view"
                >
                  <button
                    aria-pressed={
                      editorMode === "preview" ||
                      !!versionPreview ||
                      !!alternate
                    }
                    onClick={() => setEditorMode("preview")}
                  >
                    Preview
                  </button>
                  <button
                    aria-pressed={
                      editorMode === "edit" && !versionPreview && !alternate
                    }
                    disabled={
                      !snapshot.canEdit ||
                      !!versionPreview ||
                      !!alternate ||
                      importPending
                    }
                    onClick={() => setEditorMode("edit")}
                  >
                    Edit
                  </button>
                </div>
                <span className="file-artifact-type">
                  {fileLabels[detail.file.kind]}
                </span>
                <div
                  className="file-version-navigation"
                  aria-label="Version navigation"
                >
                  <button
                    aria-label="Previous version"
                    title="Previous version"
                    disabled={
                      unsaved ||
                      busy ||
                      versionIndex < 0 ||
                      versionIndex >= versions.length - 1 ||
                      !!alternate
                    }
                    onClick={() => {
                      setVersionPreview(versions[versionIndex + 1]);
                      setEditorMode("preview");
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span>
                    Version {Math.max(1, versions.length - versionIndex)} of{" "}
                    {versions.length}
                  </span>
                  <button
                    aria-label="Next version"
                    title="Next version"
                    disabled={
                      unsaved || busy || versionIndex <= 0 || !!alternate
                    }
                    onClick={() => {
                      const next = versions[versionIndex - 1];
                      setVersionPreview(
                        next.id === detail.revision.id ? null : next
                      );
                      setEditorMode("preview");
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
              {versionPreview && (
                <div className="file-alert">
                  <span>You’re viewing an earlier version.</span>
                  <button onClick={() => setVersionPreview(null)}>
                    Back to latest
                  </button>
                  <button
                    disabled={busy || !snapshot.canEdit}
                    onClick={() =>
                      void revisionAction(versionPreview.id, "restore")
                    }
                  >
                    Restore this version
                  </button>
                </div>
              )}
              {saveState === "failed" && (
                <div className="file-alert error">
                  Your changes are still here.{" "}
                  <button disabled={busy} onClick={() => void save()}>
                    Retry saving
                  </button>
                </div>
              )}
              {conflictRevision && (
                <div className="file-alert warning">
                  <span>
                    This file changed elsewhere. Your draft is preserved.
                  </span>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "Discard this draft and use the saved version?"
                        )
                      )
                        void loadFile(detail.file.id, true);
                    }}
                  >
                    Use saved version
                  </button>
                  <button onClick={() => void save(conflictRevision.id)}>
                    Save my draft as a new revision
                  </button>
                </div>
              )}
              {alternate && (
                <div className="file-alert warning">
                  <span>
                    Previewing an AI alternative. Your current version is
                    unchanged.
                  </span>
                  <button onClick={() => setAlternate(null)}>
                    Keep current
                  </button>
                  <button
                    disabled={busy || !snapshot.canEdit}
                    onClick={() => void revisionAction(alternate.id, "apply")}
                  >
                    Apply this version
                  </button>
                </div>
              )}
              {importPending && (
                <div className="file-alert">
                  <LoaderCircle size={14} className="file-spin" />
                  Converting your upload. Editing will be available when the
                  import finishes.
                </div>
              )}
              {!!detail.file.warnings.length && (
                <details className="file-conversion-warnings" open>
                  <summary>
                    <AlertTriangle size={14} />
                    Import notes · review before editing
                  </summary>
                  <ul>
                    {detail.file.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
              {detail.originalUrl && (
                <div className="file-original-links">
                  <a href={detail.originalUrl} target="_blank" rel="noreferrer">
                    Download original {detail.file.originalName}
                  </a>
                  {detail.file.originalName?.toLowerCase().endsWith(".pdf") && (
                    <button onClick={() => setOriginalOpen(!originalOpen)}>
                      {originalOpen
                        ? "Hide original PDF"
                        : "Preview original PDF"}
                    </button>
                  )}
                </div>
              )}
              {originalOpen && detail.originalUrl && (
                <iframe
                  className="file-original-pdf"
                  title="Original PDF"
                  src={detail.originalUrl}
                  sandbox="allow-same-origin"
                />
              )}
              <div className="file-editor-body">
                {visibleContent.kind === "document" ? (
                  <DocumentEditor
                    key={detail.file.id}
                    content={visibleContent}
                    readOnly={readOnly}
                    onChange={changeDraft}
                  />
                ) : visibleContent.kind === "presentation" ? (
                  <SlideEditor
                    key={detail.file.id}
                    content={visibleContent}
                    readOnly={readOnly}
                    onChange={changeDraft}
                  />
                ) : (
                  <SheetEditor
                    key={detail.file.id}
                    content={visibleContent}
                    readOnly={readOnly}
                    onChange={changeDraft}
                  />
                )}
              </div>
              {historyOpen && (
                <aside className="file-revisions" aria-label="Version history">
                  <div className="file-panel-heading">
                    <h2>Version history</h2>
                    <button
                      aria-label="Close history"
                      onClick={() => setHistoryOpen(false)}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {detail.revisions.map((revision) => (
                    <div key={revision.id}>
                      <span>
                        <strong>
                          {revision.source === "ai"
                            ? "AI revision"
                            : revision.source === "import"
                              ? "Imported file"
                              : revision.source === "restore"
                                ? "Restored version"
                                : "Edited version"}
                          {revision.conflict ? " · alternative" : ""}
                        </strong>
                        <small>
                          {new Date(revision.createdAt).toLocaleString()}
                        </small>
                      </span>
                      {revision.id === detail.revision.id ? (
                        <small>Current</small>
                      ) : (
                        <button
                          disabled={!snapshot.canEdit || busy || unsaved}
                          onClick={() =>
                            void revisionAction(revision.id, "restore")
                          }
                        >
                          <RotateCcw size={13} />
                          Restore
                        </button>
                      )}
                    </div>
                  ))}
                </aside>
              )}
            </>
          ) : (
            <div className="file-editor-empty">
              <div className="file-empty-pages">
                <FileText />
                <Presentation />
                <Table2 />
              </div>
              <h2>Your ideas, with room to grow.</h2>
              <p>
                Open a file, bring one along, or let’s start something together.
              </p>
              <button
                className="file-primary"
                disabled={!snapshot.canEdit || busy}
                onClick={() => void create()}
              >
                <Plus size={16} />
                Create your first file
              </button>
            </div>
          )}
        </main>
      </div>
      {!!snapshot.jobs.length && (
        <section className="file-jobs" aria-label="File activity">
          <div className="file-panel-heading">
            <h2>File activity</h2>
            <span>
              {
                snapshot.jobs.filter(
                  (job) => job.status === "running" || job.status === "queued"
                ).length
              }{" "}
              active
            </span>
          </div>
          {snapshot.jobs.slice(0, 8).map((job) => (
            <div className={`file-job status-${job.status}`} key={job.id}>
              <span className="file-job-icon">
                {job.status === "running" || job.status === "queued" ? (
                  <LoaderCircle size={15} className="file-spin" />
                ) : job.status === "failed" ? (
                  <AlertTriangle size={15} />
                ) : (
                  <Check size={15} />
                )}
              </span>
              <div>
                <strong>
                  {job.kind === "generate"
                    ? "AI creation"
                    : job.kind === "import"
                      ? "File import"
                      : "File export"}
                  <span>{job.status}</span>
                </strong>
                {job.error && <p>{job.error}</p>}
                {(job.status === "running" || job.status === "queued") && (
                  <progress
                    max={100}
                    value={job.progress}
                    aria-label="Job progress"
                  />
                )}
                {job.revisionId && (
                  <small>Revision {job.revisionId.slice(0, 8)}</small>
                )}
              </div>
              {job.status === "failed" && (
                <button
                  disabled={busy || !snapshot.canEdit}
                  onClick={() =>
                    void action(async () => {
                      const result = await api<{ jobId: string }>(
                        `${base}/jobs/${job.id}/retry`,
                        json("POST")
                      );
                      watchedJobs.current.add(result.jobId);
                      await refresh();
                      if (job.kind === "generate") observeJob(result.jobId);
                    })
                  }
                >
                  Retry
                </button>
              )}
              {job.result?.downloadUrl && (
                <a
                  className="file-button"
                  href={job.result.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={14} />
                  Download
                </a>
              )}
              {job.result?.conflict && (
                <button onClick={() => void previewAlternate(job)}>
                  Review AI alternative
                </button>
              )}
              {job.result?.fileId &&
                job.kind !== "export" &&
                !job.result.conflict && (
                  <button onClick={() => void loadFile(job.result!.fileId!)}>
                    Open file
                  </button>
                )}
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

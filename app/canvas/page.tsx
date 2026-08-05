"use client";

import {
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionLineType,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectProfile } from "@/lib/catalog/types";
import {
  type DocNode,
  SEED_DOCS,
  addChild,
  updateContent,
} from "@/lib/docs/types";
import { layoutSteps } from "@/lib/engine/layout";
import { unblockedSteps } from "@/lib/engine/order";
import { buildPlan, marksAvailable, planMinutes } from "@/lib/engine/plan";
import { FIXTURES } from "@/lib/fixtures/profiles";
import {
  DEFAULT_PREFS,
  type Prefs,
  type ProfileOverrides,
} from "@/lib/settings/types";
import {
  type CustomTask,
  type TaskState,
  type TaskStatus,
  emptyTaskState,
} from "@/lib/tasks/types";
import { useSearchParams } from "next/navigation";
import { profileFromDigest } from "@/lib/scan/profile";
import { type RepoDigest, type ScanResult, isScanError } from "@/lib/scan/types";
import { listWorkspaces } from "@/lib/workspaces/store";
import { Dock, type DockItem } from "./Dock";
import { ProjectLoader } from "./ProjectLoader";
import { DocWindowNode, type DocNodeData } from "./DocWindowNode";
import { DocsSidebar } from "./DocsSidebar";
import {
  LEFT_COLLAPSED,
  LEFT_WIDTH,
  LeftSidebar,
  type LeftSection,
} from "./LeftSidebar";
import { StepNode, type StepNodeData } from "./StepNode";
import { ViewTabs, type ViewKey } from "./ViewTabs";
import { Workspace } from "./Workspace";

const nodeTypes = { step: StepNode, doc: DocWindowNode };

type FixtureKey = keyof typeof FIXTURES;
type AnyNode = Node<StepNodeData> | Node<DocNodeData>;

const FIXTURE_LABELS: Record<FixtureKey, string> = {
  FINAL_YEAR_SOLO: "Final year · solo",
  GROUP_COURSEWORK: "Group coursework · 4",
  PERSONAL_PROJECT: "Personal project",
};

const docNodeId = (docId: string) => `doc:${docId}`;

function CanvasInner() {
  const [fixtureKey, setFixtureKey] = useState<FixtureKey>("FINAL_YEAR_SOLO");
  // Task state and docs are local-only until PlanStore lands.
  const [tasks, setTasks] = useState<TaskState>(emptyTaskState);
  const [docs, setDocs] = useState<DocNode[]>(SEED_DOCS);
  const [layoutNonce, setLayoutNonce] = useState(0);
  const [view, setView] = useState<ViewKey>("canvas");
  const [section, setSection] = useState<LeftSection>("overview");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [docsPinned, setDocsPinned] = useState(true);
  const searchParams = useSearchParams();
  // A real scanned repo, when one is loaded. Overrides the sample fixtures.
  const [scanned, setScanned] = useState<{
    profile: ProjectProfile;
    digest: RepoDigest;
    evidence: { field: string; because: string }[];
  } | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [overrides, setOverrides] = useState<ProfileOverrides>({});

  const completed = tasks.completed;

  /**
   * Fixture plus whatever Settings has changed. Merged here rather than
   * mutating the fixture so switching fixtures cleanly discards edits — and so
   * the engine still receives one plain, complete profile.
   */
  const profile: ProjectProfile = useMemo(() => {
    const base = scanned?.profile ?? FIXTURES[fixtureKey];
    return {
      ...base,
      one_liner: overrides.one_liner ?? base.one_liner,
      academic: {
        ...base.academic,
        deadline_date:
          overrides.deadline_date !== undefined
            ? overrides.deadline_date
            : base.academic.deadline_date,
        deliverables: overrides.deliverables ?? base.academic.deliverables,
        must_run_locally:
          overrides.must_run_locally ?? base.academic.must_run_locally,
        tech_constraints:
          overrides.tech_constraints !== undefined
            ? overrides.tech_constraints
            : base.academic.tech_constraints,
        has_rubric: overrides.has_rubric ?? base.academic.has_rubric,
        group_size: overrides.group_size ?? base.academic.group_size,
      },
    };
    // `scanned` must be here — without it the memo never recomputes after a
    // scan lands, so the header updates but the plan keeps showing the fixture.
  }, [fixtureKey, overrides, scanned]);

  const plan = useMemo(() => buildPlan(profile), [profile]);

  /**
   * If this workspace was opened from a real folder, re-scan it on load.
   *
   * The digest isn't persisted — only the path is. Re-scanning means the plan
   * reflects the repo as it is now, not as it was when the workspace was made,
   * which matters for a project actively being worked on.
   */
  useEffect(() => {
    const id = searchParams.get("w");
    if (!id || scanned) return;
    const meta = listWorkspaces().find((w) => w.id === id);
    if (!meta?.repoPath) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/scan?path=${encodeURIComponent(meta.repoPath as string)}`,
        );
        const data: ScanResult = await res.json();
        if (cancelled || isScanError(data)) return;
        const { profile: p, evidence, alreadyDone } = profileFromDigest(data);
        setScanned({ profile: p, digest: data, evidence });
        // Pre-tick what the repo already satisfies, so the plan starts from
        // where the project actually is rather than from zero.
        setTasks((prev) => ({
          ...prev,
          completed: new Set(alreadyDone.map((d) => d.stepId)),
        }));
      } catch {
        // Path may have moved or been deleted. The fixtures still work, so
        // failing quietly here is better than blocking the whole canvas.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, scanned]);

  const ready = useMemo(
    () => new Set(unblockedSteps(plan.steps, completed).map((s) => s.id)),
    [plan.steps, completed],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const toggle = useCallback((id: string) => {
    setTasks((prev) => {
      const completed = new Set(prev.completed);
      const doing = new Set(prev.doing);
      if (completed.has(id)) {
        completed.delete(id);
      } else {
        completed.add(id);
        // Done supersedes in-progress; leaving both set makes the board lie.
        doing.delete(id);
      }
      return { ...prev, completed, doing };
    });
  }, []);

  const setStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks((prev) => {
      const completed = new Set(prev.completed);
      const doing = new Set(prev.doing);
      completed.delete(id);
      doing.delete(id);
      if (status === "done") completed.add(id);
      if (status === "doing") doing.add(id);
      return { ...prev, completed, doing };
    });
  }, []);

  const toggleCheck = useCallback((key: string) => {
    setTasks((prev) => {
      const checked = new Set(prev.checked);
      if (checked.has(key)) checked.delete(key);
      else checked.add(key);
      return { ...prev, checked };
    });
  }, []);

  const addCustom = useCallback((text: string) => {
    setTasks((prev) => ({
      ...prev,
      custom: [
        ...prev.custom,
        {
          id: `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          text,
          status: "todo" as TaskStatus,
          createdAt: Date.now(),
        },
      ],
    }));
  }, []);

  const updateCustom = useCallback((id: string, patch: Partial<CustomTask>) => {
    setTasks((prev) => ({
      ...prev,
      custom: prev.custom.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }, []);

  const removeCustom = useCallback((id: string) => {
    setTasks((prev) => ({
      ...prev,
      custom: prev.custom.filter((t) => t.id !== id),
    }));
  }, []);

  const closeDoc = useCallback(
    (nodeId: string) => setNodes((prev) => prev.filter((n) => n.id !== nodeId)),
    [setNodes],
  );

  const editDoc = useCallback(
    (docId: string, content: string) =>
      setDocs((prev) => updateContent(prev, docId, content)),
    [],
  );

  /** Open a file as a window on the canvas, or focus it if already open. */
  const openDoc = useCallback(
    (doc: DocNode) => {
      const id = docNodeId(doc.id);
      setNodes((prev) => {
        if (prev.some((n) => n.id === id)) {
          return prev.map((n) => ({ ...n, selected: n.id === id }));
        }
        // Open to the LEFT of the plan. Step layout centres on x=0, so positive
        // x lands under the docs sidebar and the window opens out of sight.
        // Stagger so successive windows don't stack exactly on top of each other.
        const offset = prev.filter((n) => n.type === "doc").length * 28;
        return [
          ...prev,
          {
            id,
            type: "doc",
            position: { x: -640 + offset, y: 40 + offset },
            width: 460,
            height: 380,
            selected: true,
            data: { doc, onClose: closeDoc, onChange: editDoc },
          } as Node<DocNodeData>,
        ];
      });
    },
    [setNodes, closeDoc, editDoc],
  );

  const openDocIds = useMemo(
    () =>
      new Set(
        nodes
          .filter((n) => n.type === "doc")
          .map((n) => (n.data as DocNodeData).doc.id),
      ),
    [nodes],
  );

  /**
   * Rebuild step nodes when the plan or completion changes, but PRESERVE any
   * position the user dragged to — and leave doc windows untouched.
   */
  useEffect(() => {
    const activeId = plan.steps.find(
      (s) => !completed.has(s.id) && ready.has(s.id),
    )?.id;

    setNodes((prev) => {
      const kept = new Map(prev.map((n) => [n.id, n]));
      const docWindows = prev.filter((n) => n.type === "doc");

      const stepNodes = layoutSteps(plan.steps).map(({ step, x, y }) => {
        const existing = kept.get(step.id);
        return {
          id: step.id,
          type: "step",
          position: existing?.position ?? { x, y },
          selected: existing?.selected ?? false,
          data: {
            step,
            state: completed.has(step.id)
              ? ("done" as const)
              : step.id === activeId
                ? ("active" as const)
                : ready.has(step.id)
                  ? ("ready" as const)
                  : ("blocked" as const),
          },
        } as Node<StepNodeData>;
      });

      return [...stepNodes, ...docWindows];
    });
  }, [plan.steps, completed, ready, setNodes]);

  /** Keep open doc windows in sync with edits made anywhere. */
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type !== "doc") return n;
        const current = n.data as DocNodeData;
        const findDoc = (list: DocNode[]): DocNode | null => {
          for (const d of list) {
            if (d.id === current.doc.id) return d;
            if (d.children) {
              const hit = findDoc(d.children);
              if (hit) return hit;
            }
          }
          return null;
        };
        const fresh = findDoc(docs);
        if (!fresh || fresh === current.doc) return n;
        return { ...n, data: { ...current, doc: fresh } };
      }),
    );
  }, [docs, setNodes]);

  // Reset layout: clear nodes so the effect above rebuilds from computed
  // positions rather than remembered ones.
  useEffect(() => {
    if (layoutNonce > 0) setNodes([]);
  }, [layoutNonce, setNodes]);

  useEffect(() => {
    setEdges(
      plan.steps.flatMap((step) =>
        step.requires.map((dep) => ({
          id: `${dep}->${step.id}`,
          source: dep,
          target: step.id,
          // Each side has its own handle now, so dependency edges must name the
          // pair explicitly — otherwise routing changes between renders.
          sourceHandle: "bottom-s",
          targetHandle: "top-t",
          type: "smoothstep",
          animated: ready.has(step.id),
          style: {
            stroke: ready.has(step.id) ? "#a16207" : "#333",
            strokeWidth: 1.5,
          },
        })),
      ),
    );
  }, [plan.steps, ready, setEdges]);

  /**
   * User-drawn connections are visual only — they do NOT write back into
   * `requires`. Dependencies live in the versioned catalog, and letting the
   * canvas mutate them would put the plan's structure outside code review.
   */
  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((prev) => [
        ...prev,
        {
          ...c,
          id: `user-${c.source}-${c.sourceHandle}-${c.target}-${c.targetHandle}`,
          type: "smoothstep",
          style: {
            stroke: "#38bdf8",
            strokeWidth: 1.5,
            strokeDasharray: "4 3",
          },
        } as Edge,
      ]);
    },
    [setEdges],
  );

  const selectedCount = nodes.filter((n) => n.selected).length;
  const hours = Math.round(planMinutes(plan) / 60);

  /** Jump straight to a workspace section from the canvas. */
  const goto = useCallback((s: LeftSection) => {
    setSection(s);
    setView("workspace");
  }, []);

  /** New scratch note — lands in Docs/ and opens on the canvas immediately. */
  const newNote = useCallback(() => {
    const id = `note-${Math.random().toString(36).slice(2, 8)}`;
    const node: DocNode = {
      id,
      name: "untitled.md",
      kind: "file",
      content: "",
    };
    setDocs((prev) => addChild(prev, "docs", node));
    openDoc(node);
  }, [openDoc]);

  const dockGroups: DockItem[][] = [
    // Views
    [
      {
        id: "canvas",
        label: "Canvas",
        glyph: "🕸",
        tint: "linear-gradient(160deg,#38bdf8,#0369a1)",
        running: view === "canvas",
        onClick: () => setView("canvas"),
      },
      {
        id: "workspace",
        label: "Workspace",
        glyph: "📋",
        tint: "linear-gradient(160deg,#a78bfa,#5b21b6)",
        running: view === "workspace",
        onClick: () => goto("overview"),
      },
    ],
    // Sections
    [
      {
        id: "tasks",
        label: `Tasks · ${completed.size}/${plan.steps.length}`,
        glyph: "✅",
        tint: "linear-gradient(160deg,#34d399,#065f46)",
        onClick: () => goto("steps"),
      },
      {
        id: "prompts",
        label: "Prompts",
        glyph: "⚡",
        tint: "linear-gradient(160deg,#fbbf24,#b45309)",
        onClick: () => goto("prompts"),
      },
      {
        id: "board",
        label: "Board",
        glyph: "🗂",
        tint: "linear-gradient(160deg,#f472b6,#9d174d)",
        onClick: () => goto("board"),
      },
      {
        id: "hidden",
        label: `Hidden · ${plan.hidden.length}`,
        glyph: "🙈",
        tint: "linear-gradient(160deg,#94a3b8,#334155)",
        onClick: () => goto("hidden"),
      },
    ],
    // Canvas actions
    [
      {
        id: "note",
        label: "New note",
        glyph: "📝",
        tint: "linear-gradient(160deg,#fde68a,#a16207)",
        onClick: newNote,
      },
      {
        id: "docs",
        label: docsPinned ? "Hide docs" : "Show docs",
        glyph: "📄",
        tint: "linear-gradient(160deg,#60a5fa,#1e40af)",
        running: docsPinned,
        onClick: () => setDocsPinned((v) => !v),
      },
      {
        id: "reset",
        label: "Reset layout",
        glyph: "🧭",
        tint: "linear-gradient(160deg,#fb7185,#9f1239)",
        onClick: () => setLayoutNonce((n) => n + 1),
      },
    ],
    // Config
    [
      {
        id: "integrations",
        label: "Integrations",
        glyph: "🔌",
        tint: "linear-gradient(160deg,#2dd4bf,#0f766e)",
        onClick: () => goto("integrations"),
      },
      {
        id: "settings",
        label: "Settings",
        glyph: "⚙️",
        tint: "linear-gradient(160deg,#4b5563,#1f2937)",
        onClick: () => goto("settings"),
      },
    ],
  ];

  return (
    <div className="flex h-screen flex-col bg-[#090c12] text-neutral-200">
      <header className="z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-neutral-950/80 px-5 py-3 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <span className="font-semibold">DevCon</span>
          <span className="text-sm text-neutral-500">{profile.one_liner}</span>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-neutral-500">
          <span>
            {completed.size}/{plan.steps.length} done
          </span>
          <span>~{hours}h</span>
          {/* Grade only means something on the academic track. */}
          {profile.context === "academic" ? (
            <span>{marksAvailable(plan)}% of grade mapped</span>
          ) : null}
          <span className="text-amber-500/80">
            {plan.antiSteps.length} anti-steps
          </span>
          <span className="text-neutral-600">{plan.hidden.length} hidden</span>
          {selectedCount > 0 && view === "canvas" ? (
            <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-sky-300">
              {selectedCount} selected
            </span>
          ) : null}

          <ProjectLoader
            loaded={scanned?.digest ?? null}
            onLoaded={(profile, digest, evidence) => {
              setScanned({ profile, digest, evidence });
              setOverrides({});
              setTasks(emptyTaskState());
              setNodes([]);
            }}
            onClear={() => {
              setScanned(null);
              setOverrides({});
              setTasks(emptyTaskState());
              setNodes([]);
            }}
          />

          {!scanned ? (
            <select
              value={fixtureKey}
              onChange={(e) => {
                setFixtureKey(e.target.value as FixtureKey);
                setTasks(emptyTaskState());
                setNodes([]);
              }}
              className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-300"
            >
              {(Object.keys(FIXTURES) as FixtureKey[]).map((k) => (
                <option key={k} value={k}>
                  {FIXTURE_LABELS[k]}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {/* Wallpaper. Layered gradients rather than a raster asset — nothing to
            ship, no licence to worry about, and it scales to any viewport. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(1200px 800px at 15% 0%, rgba(56,132,180,0.30), transparent 60%),
              radial-gradient(1000px 700px at 85% 15%, rgba(120,80,180,0.22), transparent 55%),
              radial-gradient(900px 900px at 60% 100%, rgba(20,120,120,0.22), transparent 60%),
              linear-gradient(160deg, #0b1622 0%, #0a1118 45%, #090c12 100%)
            `,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {view === "canvas" ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={(_, node) =>
              node.type === "step" && toggle(node.id)
            }
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: "#38bdf8", strokeWidth: 2 }}
            fitView
            // Without maxZoom, fitView shrinks the plan until text is unreadable.
            fitViewOptions={{ padding: 0.15, maxZoom: 0.9 }}
            minZoom={0.2}
            maxZoom={1.6}
            // Plain drag pans; Shift+drag draws the selection box. Panning is
            // the far more frequent action on a large graph, so it gets the
            // unmodified gesture.
            selectionKeyCode="Shift"
            panOnScroll
            selectNodesOnDrag={false}
            // Shift is taken by marquee, so multi-select uses Cmd/Ctrl.
            multiSelectionKeyCode={["Meta", "Control"]}
            // Steps are catalog entries — deleting one from the canvas would be
            // meaningless. Doc windows close via their own red light.
            deleteKeyCode={null}
            snapToGrid
            snapGrid={[13, 13]}
            style={{ background: "transparent" }}
            proOptions={{ hideAttribution: false }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={26}
              size={2.2}
              color="rgba(255,255,255,0.32)"
            />
            <Controls className="!overflow-hidden !rounded-lg !border !border-white/15 !bg-neutral-900/90 !shadow-xl [&>button]:!border-white/10 [&>button]:!bg-transparent [&>button]:!fill-neutral-300 [&>button:hover]:!bg-white/10" />
            <MiniMap
              pannable
              zoomable
              className="!rounded-lg !border !border-white/15 !bg-neutral-900/90 !shadow-xl"
              maskColor="rgba(0,0,0,0.6)"
              nodeStrokeWidth={3}
              nodeColor={(n) => {
                if (n.type === "doc") return "#38bdf8";
                const state = (n.data as StepNodeData).state;
                if (state === "done") return "#525252";
                if (state === "active") return "#fbbf24";
                if (state === "ready") return "#e5e5e5";
                return "#737373";
              }}
            />
          </ReactFlow>
        ) : (
          <Workspace
            profile={profile}
            plan={plan}
            tasks={tasks}
            ready={ready}
            section={section}
            insetLeft={(leftCollapsed ? LEFT_COLLAPSED : LEFT_WIDTH) + 24}
            // 288 panel + 12 inset each side.
            insetRight={312}
            prefs={prefs}
            detected={
              scanned ? { envKeys: scanned.digest.envKeys } : undefined
            }
            onPrefs={(patch) => setPrefs((p) => ({ ...p, ...patch }))}
            onProfile={(patch) => setOverrides((o) => ({ ...o, ...patch }))}
            onReset={() => {
              setTasks(emptyTaskState());
              setOverrides({});
              setPrefs(DEFAULT_PREFS);
            }}
            onToggleDone={toggle}
            onSetStatus={setStatus}
            onToggleCheck={toggleCheck}
            onAddCustom={addCustom}
            onUpdateCustom={updateCustom}
            onRemoveCustom={removeCustom}
          />
        )}

        {/* Left rail only in workspace — the canvas has its own spatial
            navigation and a second panel would crowd it. */}
        {view === "workspace" ? (
          <LeftSidebar
            profile={profile}
            plan={plan}
            completed={completed}
            active={section}
            onSelect={setSection}
            collapsed={leftCollapsed}
            onToggleCollapsed={() => setLeftCollapsed((v) => !v)}
          />
        ) : null}

        <ViewTabs value={view} onChange={setView} />

        <DocsSidebar
          docs={docs}
          setDocs={setDocs}
          onOpenDoc={openDoc}
          openIds={openDocIds}
          pinned={docsPinned}
          setPinned={setDocsPinned}
        />

        {/* Dock is a canvas affordance — the workspace view is a document you
            read top to bottom, and a floating bar would just cover it. */}
        {view === "canvas" ? <Dock groups={dockGroups} /> : null}
      </div>

      <footer className="border-t border-white/10 px-5 py-2 text-xs text-neutral-600">
        {view === "canvas"
          ? "Drag to pan · shift-drag to select · ⌘-click for multi-select · double-click a step to mark it done · select a doc window to resize it"
          : "One step at a time. Everything that doesn't apply is in the drawer at the bottom, with reasons."}
      </footer>
    </div>
  );
}

export default function CanvasPage() {
  return (
    // useSearchParams bails out of prerendering, so the tree below it needs a
    // Suspense boundary or the static export fails.
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#090c12] text-sm text-neutral-500">
          Loading workspace…
        </div>
      }
    >
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </Suspense>
  );
}

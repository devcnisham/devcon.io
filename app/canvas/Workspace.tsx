"use client";

import { useMemo, useState } from "react";
import {
  PHASE_ORDER,
  type Phase,
  type Plan,
  type ProjectProfile,
  type Step,
} from "@/lib/catalog/types";
import {
  marksAvailable,
  marksEarned,
  progressByWeight,
} from "@/lib/engine/plan";
import type { IntegrationState } from "@/lib/integrations/store";
import type { Prefs, ProfileOverrides } from "@/lib/settings/types";
import {
  type CustomTask,
  checkKey,
  statusOf,
  type TaskState,
  type TaskStatus,
} from "@/lib/tasks/types";
import { track } from "@/lib/telemetry/events";
import { Funnel } from "./Funnel";
import { Integrations } from "./Integrations";
import type { LeftSection } from "./LeftSidebar";
import { Prompts } from "./Prompts";
import { Settings } from "./Settings";

function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function weeksUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  return ms <= 0 ? 0 : ms / (1000 * 60 * 60 * 24 * 7);
}

const PHASE_LABEL: Record<Phase, string> = {
  foundation: "Foundation",
  core: "Core",
  harden: "Harden",
  deliver: "Deliver",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "In progress",
  done: "Done",
};

export interface WorkspaceProps {
  profile: ProjectProfile;
  plan: Plan;
  tasks: TaskState;
  ready: Set<string>;
  section: LeftSection;
  /** Space to reserve for the sidebars so content isn't hidden beneath them. */
  insetLeft: number;
  insetRight: number;
  prefs: Prefs;
  /** Env key names from the repo scan, when a real project is loaded. */
  detected?: { envKeys: string[] };
  /** Project token — events are keyed by it, since there are no accounts. */
  project: string;
  /** Connected services, shared with the canvas rather than owned here. */
  integrations: IntegrationState;
  /** What each connection resolves to, when the scan could establish it. */
  identity: Record<string, string>;
  onIntegrationsChange: (next: IntegrationState) => void;
  /**
   * The Feature Registry, rendered by the page.
   *
   * Passed in rather than built here: the registry needs the FileSource to
   * re-scan, and that lives with the loaded project. Workspace stays a switch
   * over sections rather than gaining a second data pipeline.
   */
  registrySection: React.ReactNode;
  onPrefs: (patch: Partial<Prefs>) => void;
  onProfile: (patch: ProfileOverrides) => void;
  onReset: () => void;
  onToggleDone: (id: string) => void;
  onSetStatus: (id: string, status: TaskStatus) => void;
  onToggleCheck: (key: string) => void;
  onAddCustom: (text: string) => void;
  onUpdateCustom: (id: string, patch: Partial<CustomTask>) => void;
  onRemoveCustom: (id: string) => void;
}

/* ------------------------------------------------------------------ pieces */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
      {children}
    </h3>
  );
}

function StatusPill({
  status,
  onChange,
}: {
  status: TaskStatus;
  onChange: (s: TaskStatus) => void;
}) {
  const next: Record<TaskStatus, TaskStatus> = {
    todo: "doing",
    doing: "done",
    done: "todo",
  };
  const tone: Record<TaskStatus, string> = {
    todo: "bg-white/8 text-neutral-400",
    doing: "bg-sky-400/20 text-sky-300",
    done: "bg-emerald-400/20 text-emerald-300",
  };
  return (
    <button
      type="button"
      onClick={() => onChange(next[status])}
      title="Click to advance"
      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors ${tone[status]}`}
    >
      {STATUS_LABEL[status]}
    </button>
  );
}

/* ------------------------------------------------------------- the section */

export function Workspace(props: WorkspaceProps) {
  const { profile, plan, tasks, ready, section } = props;
  const { integrations, identity, onIntegrationsChange, registrySection } =
    props;
  const { completed } = tasks;

  const [showAllNext, setShowAllNext] = useState(false);
  const [showAllAnti, setShowAllAnti] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const doneSteps = plan.steps.filter((s) => completed.has(s.id));
  const remaining = plan.steps.filter((s) => !completed.has(s.id));
  const active = remaining.find((s) => ready.has(s.id)) ?? null;
  const upNext = remaining.filter((s) => s.id !== active?.id);

  const remainingMinutes = remaining.reduce((n, s) => n + s.est_minutes, 0);
  const weeks = weeksUntil(profile.academic.deadline_date);
  // Capacity comes from Settings, not a constant — a student with 4h/week and
  // one with 20h/week need genuinely different advice from the same plan.
  const hoursPerWeek = props.prefs.hoursPerWeek;
  const capacityMinutes = weeks === null ? null : weeks * hoursPerWeek * 60;

  /**
   * Behind = the work left doesn't fit the time left. Judged on estimated
   * minutes, never step count — a 6h report and a 20m README are not one unit
   * each, and counting them equally makes the indicator lie.
   */
  const behind = capacityMinutes !== null && remainingMinutes > capacityMinutes;

  const cuts = useMemo(() => {
    if (!behind || capacityMinutes === null) return [];
    const overBy = remainingMinutes - capacityMinutes;
    const candidates = remaining
      .filter((s) => s.criticality !== "must")
      .sort((a, b) => (a.mark_weight ?? 0) - (b.mark_weight ?? 0));
    const picked: Step[] = [];
    let saved = 0;
    for (const s of candidates) {
      if (saved >= overBy) break;
      picked.push(s);
      saved += s.est_minutes;
    }
    return picked;
  }, [behind, capacityMinutes, remainingMinutes, remaining]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ------------------------------------------------------------- overview */
  const overview = (
    <>
      {behind && cuts.length > 0 ? (
        <section className="mb-8 rounded-2xl border border-amber-400/40 bg-amber-400/[0.06] p-6">
          <h2 className="text-lg font-semibold text-amber-200">
            You won&apos;t finish all {remaining.length} remaining steps
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            About {formatEstimate(remainingMinutes)} of work left, and roughly{" "}
            {formatEstimate(Math.round(capacityMinutes ?? 0))} of calendar at{" "}
            {hoursPerWeek}h a week. Cut these and you finish on time:
          </p>
          <ul className="mt-4 space-y-1.5">
            {cuts.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-b border-white/8 pb-1.5 text-sm text-neutral-300 last:border-0"
              >
                <span>✕ {s.title}</span>
                <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                  {formatEstimate(s.est_minutes)}
                  {s.mark_weight ? ` · ${s.mark_weight}%` : " · 0%"}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <SectionTitle>Protected — do not cut</SectionTitle>
            <ul className="space-y-1">
              {remaining
                .filter((s) => s.criticality === "must")
                .slice(0, 3)
                .map((s) => (
                  <li key={s.id} className="text-sm text-neutral-400">
                    {s.title}
                  </li>
                ))}
            </ul>
          </div>
        </section>
      ) : active ? (
        <section className="mb-8 rounded-2xl border border-amber-400/50 bg-white/[0.04] p-6 shadow-2xl shadow-amber-500/5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-amber-300/80">
            Now · {active.phase}
          </p>
          <h2 className="text-xl font-semibold text-white">{active.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            {active.why}
          </p>
          <div className="mt-4 flex items-center gap-3 font-mono text-xs text-neutral-500">
            <span>{formatEstimate(active.est_minutes)}</span>
            {active.mark_weight ? (
              <span className="text-emerald-400">
                {active.mark_weight}% of grade
              </span>
            ) : null}
          </div>
          {active.done_when.length > 0 ? (
            <ul className="mt-4 space-y-1.5 border-t border-white/8 pt-4">
              {active.done_when.map((d, i) => {
                const key = checkKey(active.id, i);
                const on = tasks.checked.has(key);
                return (
                  <li key={d.text}>
                    <button
                      type="button"
                      onClick={() => props.onToggleCheck(key)}
                      className="flex gap-2 text-left text-sm text-neutral-400 hover:text-neutral-200"
                    >
                      <span
                        className={on ? "text-emerald-400" : "text-neutral-600"}
                      >
                        {on ? "☑" : "☐"}
                      </span>
                      <span className={on ? "line-through" : ""}>{d.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => props.onToggleDone(active.id)}
            className="mt-5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-300"
          >
            Mark done
          </button>
        </section>
      ) : plan.steps.length > 0 ? (
        // Only a real completion when there were steps to begin with. An empty
        // catalog is not an achievement, and congratulating someone for it is
        // how a tool loses trust.
        <section className="mb-8 rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.06] p-6">
          <h2 className="text-lg font-semibold text-emerald-200">
            Everything&apos;s done
          </h2>
          <p className="mt-2 text-sm text-neutral-300">
            Nothing left in the plan. Submit and go outside.
          </p>
        </section>
      ) : null}

      {upNext.length > 0 ? (
        <section className="mb-8">
          <SectionTitle>Next up</SectionTitle>
          <ul>
            {(showAllNext ? upNext : upNext.slice(0, 3)).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 border-b border-white/8 py-2.5 last:border-0"
              >
                <span className="text-sm text-neutral-300">{s.title}</span>
                <span className="shrink-0 font-mono text-[11px] text-neutral-500">
                  {formatEstimate(s.est_minutes)}
                  {s.mark_weight ? (
                    <span className="ml-2 text-emerald-500/80">
                      {s.mark_weight}%
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {upNext.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllNext((v) => !v)}
              className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
            >
              {showAllNext ? "▴ show less" : `▾ show all ${upNext.length}`}
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  );

  /* ---------------------------------------------------------------- tasks */
  const byPhase = PHASE_ORDER.map((phase) => ({
    phase,
    steps: plan.steps.filter((s) => s.phase === phase),
  })).filter((g) => g.steps.length > 0);

  const taskList = (
    <>
      <section className="mb-8">
        <SectionTitle>Your own tasks</SectionTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text) return;
            props.onAddCustom(text);
            setDraft("");
          }}
          className="mb-3 flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task the plan doesn't cover…"
            className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-neutral-200 transition-colors hover:bg-white/12"
          >
            Add
          </button>
        </form>

        {tasks.custom.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Nothing yet. Catalog steps cover the project; this is for everything
            else.
          </p>
        ) : (
          <ul>
            {tasks.custom.map((t) => (
              <li
                key={t.id}
                className="group flex items-center gap-3 border-b border-white/8 py-2.5 last:border-0"
              >
                <button
                  type="button"
                  onClick={() =>
                    props.onUpdateCustom(t.id, {
                      status: t.status === "done" ? "todo" : "done",
                    })
                  }
                  className={
                    t.status === "done"
                      ? "text-emerald-400"
                      : "text-neutral-600 hover:text-neutral-300"
                  }
                >
                  {t.status === "done" ? "☑" : "☐"}
                </button>
                <span
                  className={`min-w-0 flex-1 text-sm ${
                    t.status === "done"
                      ? "text-neutral-600 line-through"
                      : "text-neutral-200"
                  }`}
                >
                  {t.text}
                </span>
                <StatusPill
                  status={t.status}
                  onChange={(s) => props.onUpdateCustom(t.id, { status: s })}
                />
                <button
                  type="button"
                  onClick={() => props.onRemoveCustom(t.id)}
                  className="shrink-0 text-xs text-neutral-600 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {byPhase.map(({ phase, steps }) => (
        <section key={phase} className="mb-7">
          <SectionTitle>
            {PHASE_LABEL[phase]} ·{" "}
            {steps.filter((s) => completed.has(s.id)).length}/{steps.length}
          </SectionTitle>
          <ul>
            {steps.map((s) => {
              const status = statusOf(s.id, tasks);
              const isOpen = expanded.has(s.id);
              const blocked = !ready.has(s.id) && !completed.has(s.id);
              return (
                <li
                  key={s.id}
                  className="border-b border-white/8 last:border-0"
                >
                  <div className="flex items-center gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => props.onToggleDone(s.id)}
                      className={
                        status === "done"
                          ? "text-emerald-400"
                          : "text-neutral-600 hover:text-neutral-300"
                      }
                    >
                      {status === "done" ? "☑" : "☐"}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleExpand(s.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span
                        className={`block truncate text-sm ${
                          status === "done"
                            ? "text-neutral-600 line-through"
                            : blocked
                              ? "text-neutral-500"
                              : "text-neutral-200"
                        }`}
                      >
                        {s.title}
                      </span>
                    </button>

                    {blocked ? (
                      <span
                        title={`Waiting on ${s.requires.length} step(s)`}
                        className="shrink-0 font-mono text-[10px] text-neutral-600"
                      >
                        blocked
                      </span>
                    ) : null}

                    <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                      {formatEstimate(s.est_minutes)}
                    </span>
                    <StatusPill
                      status={status}
                      onChange={(next) => props.onSetStatus(s.id, next)}
                    />
                  </div>

                  {isOpen ? (
                    <div className="pb-3 pl-7 pr-2">
                      <p className="mb-2 text-xs leading-relaxed text-neutral-500">
                        {s.why}
                      </p>
                      <ul className="space-y-1">
                        {s.done_when.map((d, i) => {
                          const key = checkKey(s.id, i);
                          const on = tasks.checked.has(key);
                          return (
                            <li key={d.text}>
                              <button
                                type="button"
                                onClick={() => props.onToggleCheck(key)}
                                className="flex gap-2 text-left text-xs text-neutral-400 hover:text-neutral-200"
                              >
                                <span
                                  className={
                                    on ? "text-emerald-400" : "text-neutral-600"
                                  }
                                >
                                  {on ? "☑" : "☐"}
                                </span>
                                <span className={on ? "line-through" : ""}>
                                  {d.text}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );

  /* ---------------------------------------------------------------- board */
  const columns: { status: TaskStatus; steps: Step[]; custom: CustomTask[] }[] =
    (["todo", "doing", "done"] as TaskStatus[]).map((status) => ({
      status,
      steps: plan.steps.filter((s) => statusOf(s.id, tasks) === status),
      custom: tasks.custom.filter((t) => t.status === status),
    }));

  const board = (
    <div className="grid grid-cols-3 gap-3">
      {columns.map((col) => (
        <div
          key={col.status}
          className="rounded-xl border border-white/10 bg-white/[0.02] p-2"
        >
          <p className="mb-2 flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {STATUS_LABEL[col.status]}
            <span>{col.steps.length + col.custom.length}</span>
          </p>
          <ul className="space-y-1.5">
            {col.steps.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() =>
                    props.onSetStatus(
                      s.id,
                      col.status === "todo"
                        ? "doing"
                        : col.status === "doing"
                          ? "done"
                          : "todo",
                    )
                  }
                  className="w-full rounded-lg border border-white/10 bg-neutral-900/70 p-2.5 text-left transition-colors hover:border-white/25"
                >
                  <span className="block text-[13px] leading-snug text-neutral-200">
                    {s.title}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-neutral-500">
                    {s.phase} · {formatEstimate(s.est_minutes)}
                    {s.mark_weight ? ` · ${s.mark_weight}%` : ""}
                  </span>
                </button>
              </li>
            ))}
            {col.custom.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() =>
                    props.onUpdateCustom(t.id, {
                      status:
                        col.status === "todo"
                          ? "doing"
                          : col.status === "doing"
                            ? "done"
                            : "todo",
                    })
                  }
                  className="w-full rounded-lg border border-sky-400/25 bg-sky-400/[0.07] p-2.5 text-left transition-colors hover:border-sky-400/50"
                >
                  <span className="block text-[13px] leading-snug text-neutral-200">
                    {t.text}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] text-sky-300/70">
                    yours
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  /* ------------------------------------------------------------ deliver */
  const isAcademic = profile.context === "academic";

  /**
   * Commercial projects have no brief, no rubric and no viva. Showing the
   * academic deliverables here was a track leak — the section was written
   * before a second track existed.
   */
  const commercialDeliverables = (
    <section>
      <SectionTitle>What shipping means here</SectionTitle>
      <ul className="mb-8">
        {[
          { label: "Live and reachable", phase: "deliver" as const },
          { label: "Survives real users", phase: "harden" as const },
          { label: "Core feature works end to end", phase: "core" as const },
        ].map(({ label, phase }) => {
          const related = plan.steps.filter((s) => s.phase === phase);
          const done = related.filter((s) => completed.has(s.id)).length;
          return (
            <li
              key={label}
              className="flex items-center justify-between gap-3 border-b border-white/8 py-3 last:border-0"
            >
              <span className="text-sm text-neutral-200">{label}</span>
              <span
                className={`font-mono text-[11px] ${
                  related.length && done === related.length
                    ? "text-emerald-400"
                    : "text-neutral-500"
                }`}
              >
                {related.length ? `${done}/${related.length} steps` : "—"}
              </span>
            </li>
          );
        })}
      </ul>

      <SectionTitle>Time left</SectionTitle>
      <p className="text-sm text-neutral-400">
        {formatEstimate(remainingMinutes)} of work remaining across{" "}
        {remaining.length} steps.
        {profile.commercial.is_client_work
          ? " Client work — handoff and account ownership are in the plan."
          : ""}
      </p>
    </section>
  );

  const academicDeliverables = (
    <section>
      <SectionTitle>What the brief asks for</SectionTitle>
      <ul className="mb-8">
        {profile.academic.deliverables.map((d) => {
          const related = plan.steps.filter((s) =>
            s.title.toLowerCase().includes(d === "code" ? "feature" : d),
          );
          const allDone =
            related.length > 0 && related.every((s) => completed.has(s.id));
          return (
            <li
              key={d}
              className="flex items-center justify-between gap-3 border-b border-white/8 py-3 last:border-0"
            >
              <span className="text-sm capitalize text-neutral-200">{d}</span>
              <span
                className={`font-mono text-[11px] ${
                  allDone ? "text-emerald-400" : "text-neutral-500"
                }`}
              >
                {related.length === 0
                  ? "no step mapped"
                  : `${related.filter((s) => completed.has(s.id)).length}/${related.length} steps`}
              </span>
            </li>
          );
        })}
      </ul>

      <SectionTitle>Marks mapped</SectionTitle>
      <p className="text-sm text-neutral-400">
        {marksEarned(plan, completed)}% earned of {marksAvailable(plan)}%
        mapped.
        {profile.academic.has_rubric
          ? ""
          : " No rubric supplied — add one to map steps to marks."}
      </p>
    </section>
  );

  /* --------------------------------------------------------------- anti */
  const antiSection = (
    <section>
      <SectionTitle>Don&apos;t do these</SectionTitle>
      <ul>
        {(showAllAnti ? plan.antiSteps : plan.antiSteps.slice(0, 4)).map(
          (s) => (
            <li
              key={s.id}
              className="border-b border-white/8 py-3 last:border-0"
            >
              <p className="text-sm text-neutral-300">✕ {s.title}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{s.why}</p>
            </li>
          ),
        )}
      </ul>
      {plan.antiSteps.length > 4 ? (
        <button
          type="button"
          onClick={() => setShowAllAnti((v) => !v)}
          className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
        >
          {showAllAnti ? "▴ show less" : `▾ show all ${plan.antiSteps.length}`}
        </button>
      ) : null}
    </section>
  );

  /* ------------------------------------------------------------- hidden */
  const hiddenSection = (
    <section>
      <SectionTitle>{plan.hidden.length} steps hidden</SectionTitle>
      <ul>
        {plan.hidden.map(({ step, reason }) => (
          <li
            key={step.id}
            className="border-b border-white/8 py-3 last:border-0"
          >
            <p className="text-sm text-neutral-300">{step.title}</p>
            {/* Generated from the failed predicate, never hand-written. */}
            <p className="mt-0.5 text-xs text-neutral-500">Hidden: {reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );

  // A lookup rather than a ternary chain — seven branches nested is unreadable
  // and adding an eighth silently breaks the indentation.
  const SECTIONS: Record<LeftSection, React.ReactNode> = {
    overview,
    steps: taskList,
    prompts: (
      <Prompts
        profile={profile}
        plan={plan}
        completed={completed}
        ready={ready}
        defaultAgent={props.prefs.defaultAgent}
        detected={props.detected}
        project={props.project}
      />
    ),
    board,
    anti: antiSection,
    hidden: hiddenSection,
    deliver: isAcademic ? academicDeliverables : commercialDeliverables,
    funnel: <Funnel plan={plan} />,
    registry: registrySection,
    integrations: (
      <Integrations
        state={integrations}
        onChange={onIntegrationsChange}
        identity={identity}
      />
    ),
    settings: (
      <Settings
        profile={profile}
        prefs={props.prefs}
        onPrefs={props.onPrefs}
        onProfile={props.onProfile}
        onReset={props.onReset}
      />
    ),
  };

  const body = SECTIONS[section];

  const progress = progressByWeight(plan, completed);

  return (
    // absolute inset-0 rather than h-full: the parent is a flex item, and a
    // percentage height on a flex child doesn't reliably resolve.
    <div
      className="absolute inset-0 overflow-y-auto transition-[padding] duration-200"
      style={{ paddingLeft: props.insetLeft, paddingRight: props.insetRight }}
    >
      <div
        className={`mx-auto px-6 pb-24 pt-20 ${
          // Board needs three columns; integrations and prompts need room for
          // two-column detail and wide monospace blocks.
          section === "board" ||
          section === "integrations" ||
          section === "settings" ||
          section === "prompts" ||
          // The funnel table has eight columns; it needs the room.
          section === "funnel"
            ? "max-w-5xl"
            : "max-w-3xl"
        }`}
      >
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h1 className="text-lg font-semibold text-neutral-100">
            {profile.one_liner}
          </h1>
          <span className="flex shrink-0 items-center gap-2 font-mono text-xs">
            {weeks !== null ? (
              <span className="text-neutral-500">
                {Math.ceil(weeks)} weeks left
              </span>
            ) : (
              <span className="text-neutral-600">no deadline set</span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 ${
                behind
                  ? "bg-amber-400/15 text-amber-300"
                  : "bg-emerald-400/15 text-emerald-300"
              }`}
            >
              {behind ? "behind" : "on track"}
            </span>
          </span>
        </div>

        <div className="mb-8">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-neutral-300 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-neutral-500">
            {doneSteps.length} of {plan.steps.length} done ·{" "}
            {isAcademic && profile.academic.has_rubric
              ? `${marksEarned(plan, completed)}% of ${marksAvailable(plan)}% of marks`
              : `${formatEstimate(remainingMinutes)} of work left`}
          </p>
        </div>

        {/* An empty plan almost always means the track has no catalog, not that
            there's nothing to do. Saying "0 steps" without saying why would
            read as the engine being broken. */}
        {plan.steps.length === 0 ? (
          <section className="mb-8 rounded-2xl border border-amber-400/40 bg-amber-400/[0.06] p-6">
            <h2 className="text-lg font-semibold text-amber-200">
              No catalog for this project yet
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">
              This scanned as a{" "}
              <strong className="text-amber-200">{profile.context}</strong>{" "}
              project, and only the <strong>academic</strong> catalog is written
              so far. The engine selected nothing because nothing applies — all{" "}
              {plan.hidden.length} steps were correctly excluded, not lost.
            </p>
            <p className="mt-3 text-sm text-neutral-400">
              Switch the project to academic in Settings to see the plan
              machinery working, or the commercial catalog is the next thing to
              write.
            </p>
          </section>
        ) : null}

        {body}

        {section === "overview" ? (
          <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => {
                // Trust signal: does anyone actually check the subtraction?
                if (!drawerOpen) track("drawer_expanded", props.project);
                setDrawerOpen((v) => !v);
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-sm text-neutral-400 hover:text-neutral-200"
            >
              <span>
                {drawerOpen ? "▾" : "▸"} {plan.hidden.length} steps hidden —
                here&apos;s why
              </span>
            </button>
            {drawerOpen ? (
              <ul className="space-y-3 border-t border-white/8 px-4 py-3">
                {plan.hidden.map(({ step, reason }) => (
                  <li key={step.id}>
                    <p className="text-sm text-neutral-300">{step.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Hidden: {reason}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { Plan } from "@/lib/catalog/types";
import { eventStore, exportEvents } from "@/lib/telemetry/events";
import {
  buildFunnel,
  rankCatalogIssues,
  unhiddenSteps,
} from "@/lib/telemetry/funnel";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function duration(ms: number | null): string {
  if (ms === null) return "—";
  const mins = ms / 60000;
  if (mins < 1) return `${Math.round(ms / 1000)}s`;
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

/**
 * The funnel, and the ranked catalog fix list derived from it.
 *
 * This exists because collected-but-unread data is the same as no data. The
 * whole point of the taxonomy is that drop-off ranks what to fix next — so
 * the ranking has to be somewhere a person will actually look.
 */
export function Funnel({ plan }: { plan: Plan }) {
  const [nonce, setNonce] = useState(0);

  const events = useMemo(() => eventStore.all(), [nonce]);
  const summary = useMemo(() => buildFunnel(events), [events]);
  const issues = useMemo(() => rankCatalogIssues(summary), [summary]);
  const unhidden = useMemo(() => unhiddenSteps(events), [events]);

  const titleOf = (id: string) =>
    plan.steps.find((s) => s.id === id)?.title ??
    plan.hidden.find((h) => h.step.id === id)?.step.title ??
    id;

  const download = () => {
    const blob = new Blob([exportEvents()], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "devcon-events.ndjson";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!events.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-base font-semibold text-neutral-100">
          Nothing measured yet
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Events start landing as soon as someone copies a prompt or completes a
          step. Until a real cohort runs this, the ship rate below is the number
          that turns the whole thesis from a claim into a finding.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------ north star */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-neutral-100">
          North star
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          Of the projects that got a plan, how many shipped. Not steps
          completed — that number is inflatable by adding steps.
        </p>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "projects", value: String(summary.projects) },
            { label: "got a plan", value: String(summary.plansGenerated) },
            { label: "shipped", value: String(summary.shipped) },
            {
              label: "ship rate",
              value: pct(summary.shipRate),
              accent: true,
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border p-3 ${
                s.accent
                  ? "border-emerald-400/40 bg-emerald-400/[0.06]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <p
                className={`font-mono text-xl ${
                  s.accent ? "text-emerald-300" : "text-neutral-100"
                }`}
              >
                {s.value}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 font-mono text-[11px] text-neutral-500">
          drawer opened by {pct(summary.drawerExpandRate)} — do people check the
          subtraction?
        </p>
      </section>

      {/* --------------------------------------------------- catalog issues */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-neutral-100">
          Catalog fix list
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          Ranked by evidence, not intuition. This is the flywheel — drop-off in,
          ordered work out.
        </p>

        {issues.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Nothing has enough signal yet. Needs at least 3 people through a
            step before it ranks — one bad afternoon shouldn&apos;t top the
            list.
          </p>
        ) : (
          <ul>
            {issues.map((i) => (
              <li
                key={i.stepId}
                className="border-b border-white/8 py-3 last:border-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-neutral-200">
                    {titleOf(i.stepId)}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                    n={i.sample}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-amber-300/80">{i.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------- unhide bugs */}
      {unhidden.length > 0 ? (
        <section>
          <h2 className="mb-1 text-base font-semibold text-neutral-100">
            Wrong predicates
          </h2>
          <p className="mb-3 text-sm text-neutral-500">
            Steps people un-hid. A step that gets un-hidden repeatedly has a
            wrong <code className="font-mono">applies_when</code> — a catalog
            bug report nobody had to file.
          </p>
          <ul>
            {unhidden.map((u) => (
              <li
                key={u.stepId}
                className="flex items-center justify-between gap-3 border-b border-white/8 py-2 last:border-0 text-sm"
              >
                <span className="text-neutral-300">{titleOf(u.stepId)}</span>
                <span className="shrink-0 font-mono text-[11px] text-amber-300/80">
                  un-hidden {u.count}×
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* --------------------------------------------------- per-step funnel */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-neutral-100">
          Per-step funnel
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          <strong className="text-neutral-300">copied → not done</strong> is the
          column that matters: they had the prompt and it still didn&apos;t
          land.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="text-neutral-500">
              <tr className="border-b border-white/10">
                <th className="py-1.5 pr-3 font-normal">step</th>
                <th className="py-1.5 px-2 font-normal">reached</th>
                <th className="py-1.5 px-2 font-normal">opened</th>
                <th className="py-1.5 px-2 font-normal">copied</th>
                <th className="py-1.5 px-2 font-normal">done</th>
                <th className="py-1.5 px-2 font-normal text-amber-400/80">
                  copied&nbsp;→&nbsp;not&nbsp;done
                </th>
                <th className="py-1.5 px-2 font-normal">stuck</th>
                <th className="py-1.5 pl-2 font-normal">median</th>
              </tr>
            </thead>
            <tbody>
              {summary.steps.map((s) => (
                <tr key={s.stepId} className="border-b border-white/5">
                  <td
                    className="max-w-[220px] truncate py-1.5 pr-3 text-neutral-300"
                    title={titleOf(s.stepId)}
                  >
                    {titleOf(s.stepId)}
                  </td>
                  <td className="px-2 text-neutral-400">{s.reached}</td>
                  <td className="px-2 text-neutral-400">{s.opened}</td>
                  <td className="px-2 text-neutral-400">{s.copied}</td>
                  <td className="px-2 text-emerald-400/80">{s.completed}</td>
                  <td
                    className={`px-2 ${
                      s.copiedNotCompleted > 0
                        ? "text-amber-300"
                        : "text-neutral-600"
                    }`}
                  >
                    {s.copiedNotCompleted}
                  </td>
                  <td className="px-2 text-neutral-400">{s.stuck}</td>
                  <td className="pl-2 text-neutral-500">
                    {duration(s.medianCopyToComplete)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------------- raw */}
      <section className="flex items-center gap-2">
        <button
          type="button"
          onClick={download}
          className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-white/12"
        >
          Export {events.length} events
        </button>
        <button
          type="button"
          onClick={() => {
            eventStore.clear();
            setNonce((n) => n + 1);
          }}
          className="rounded-lg border border-red-400/30 bg-red-400/[0.08] px-3 py-1.5 text-sm text-red-300 transition-colors hover:bg-red-400/15"
        >
          Clear
        </button>
        <p className="ml-1 font-mono text-[10px] text-neutral-600">
          NDJSON — the shape a server table would ingest
        </p>
      </section>
    </div>
  );
}

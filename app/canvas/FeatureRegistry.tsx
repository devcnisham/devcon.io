"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FEATURE_PRIORITIES,
  FEATURE_STATUS_META,
  FEATURE_STATUSES,
  type Feature,
  type FeatureStatus,
  featureModule,
} from "@/lib/registry/modules/feature";
import {
  byOrigin,
  EMPTY_QUERY,
  facets,
  type RegistryQuery,
  runQuery,
  type SortKey,
} from "@/lib/registry/query";

/**
 * The Feature Registry dashboard.
 *
 * Renders a `Feature`, but every piece of logic it uses — filtering, sorting,
 * grouping, status metadata — comes from the module and the query layer. The
 * list, the filters and the detail panel are written against those, so a second
 * module reuses this shape rather than copying it.
 */

const TONE: Record<string, string> = {
  neutral: "border-white/15 bg-white/[0.06] text-neutral-300",
  amber: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  sky: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  emerald: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
  rose: "border-rose-400/40 bg-rose-400/15 text-rose-200",
};

function StatusBadge({ status }: { status: FeatureStatus }) {
  const meta = FEATURE_STATUS_META[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${TONE[meta.tone]}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function OriginBadge({ entry }: { entry: Feature }) {
  if (entry.origin === "detected") {
    const label =
      entry.review === "accepted"
        ? "accepted"
        : entry.review === "dismissed"
          ? "dismissed"
          : "suggested";
    return (
      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
    );
  }
  return (
    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-neutral-500">
      {entry.origin}
    </span>
  );
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Shown while a scan is running. Height-matched to a row so nothing jumps. */
function Skeleton() {
  return (
    <ul className="space-y-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="h-[58px] animate-pulse rounded-xl border border-white/8 bg-white/[0.02]"
        />
      ))}
    </ul>
  );
}

export function FeatureRegistry({
  entries,
  loading,
  warnings,
  onChange,
  onRemove,
  onScan,
  canScan,
}: {
  entries: Feature[];
  loading: boolean;
  warnings: string[];
  onChange: (entry: Feature) => void;
  onRemove: (id: string) => void;
  onScan: () => void;
  /** False when no project is loaded — there is nothing to scan. */
  canScan: boolean;
}) {
  const [query, setQuery] = useState<RegistryQuery>(EMPTY_QUERY);
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => byOrigin(entries), [entries]);
  const available = useMemo(() => facets(entries), [entries]);
  const visible = useMemo(
    () => runQuery(entries, query, FEATURE_STATUSES),
    [entries, query],
  );
  const active = useMemo(
    () => entries.find((e) => e.id === selected) ?? null,
    [entries, selected],
  );

  /**
   * `/` focuses search, Escape clears or closes.
   *
   * Guarded on the event target: without it, typing a slash into any field in
   * the panel steals focus back to the search box.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else if (query.text) setQuery((q) => ({ ...q, text: "" }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, query.text]);

  const toggleFilter = (key: keyof RegistryQuery, value: string) => {
    setQuery((q) => {
      const current = q[key] as string[];
      return {
        ...q,
        [key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const filtersOn =
    query.statuses.length +
      query.origins.length +
      query.categories.length +
      query.tags.length +
      query.owners.length >
    0;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-100">
            {featureModule.label}
          </h2>
          <span className="font-mono text-[11px] text-neutral-500">
            {entries.length} total · {groups.suggested.length} awaiting review
          </span>
        </div>
        <p className="mb-4 text-sm text-neutral-500">
          What this project contains, found in its code and its dependencies.
          The first module of the registry — APIs, routes and models plug into
          the same shape.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={searchRef}
            value={query.text}
            onChange={(e) => setQuery((q) => ({ ...q, text: e.target.value }))}
            placeholder="Search features…   /"
            aria-label="Search features"
            className="min-w-[220px] flex-1 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
          />

          <select
            value={query.sort}
            onChange={(e) =>
              setQuery((q) => ({ ...q, sort: e.target.value as SortKey }))
            }
            aria-label="Sort by"
            className="rounded-lg border border-white/12 bg-black/30 px-2.5 py-2 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="updatedAt">Updated</option>
            <option value="createdAt">Created</option>
            <option value="name">Name</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
          </select>

          <button
            type="button"
            onClick={() =>
              setQuery((q) => ({
                ...q,
                direction: q.direction === "asc" ? "desc" : "asc",
              }))
            }
            aria-label={`Sort ${query.direction === "asc" ? "descending" : "ascending"}`}
            className="rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-2 text-xs text-neutral-300 hover:bg-white/[0.08]"
          >
            {query.direction === "asc" ? "↑" : "↓"}
          </button>

          <div className="flex rounded-lg border border-white/12">
            {(["list", "grid"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-2.5 py-2 text-xs first:rounded-l-lg last:rounded-r-lg transition-colors ${
                  view === v
                    ? "bg-white/[0.10] text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {v === "list" ? "List" : "Grid"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onScan}
            disabled={!canScan || loading}
            title={canScan ? undefined : "Open a project first"}
            className="rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-2 text-xs text-sky-100 transition-colors hover:bg-sky-400/25 disabled:opacity-40"
          >
            {loading ? "Scanning…" : "Scan project"}
          </button>
        </div>

        {/* Filters. Empty selection means no constraint, never "match nothing". */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {FEATURE_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleFilter("statuses", s)}
              aria-pressed={query.statuses.includes(s)}
              className={`rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                query.statuses.includes(s)
                  ? TONE[FEATURE_STATUS_META[s].tone]
                  : "border-white/10 bg-white/[0.02] text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {FEATURE_STATUS_META[s].icon} {FEATURE_STATUS_META[s].label}
            </button>
          ))}
          {available.categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleFilter("categories", c)}
              aria-pressed={query.categories.includes(c)}
              className={`rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                query.categories.includes(c)
                  ? "border-sky-400/40 bg-sky-400/15 text-sky-200"
                  : "border-white/10 bg-white/[0.02] text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {c}
            </button>
          ))}
          {filtersOn ? (
            <button
              type="button"
              onClick={() =>
                setQuery((q) => ({
                  ...q,
                  statuses: [],
                  origins: [],
                  categories: [],
                  tags: [],
                  owners: [],
                }))
              }
              className="rounded-lg px-2 py-1 text-[11px] text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {warnings.length ? (
        <section className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-300/80">
            {warnings.length} scan warning{warnings.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-0.5 text-[11px] leading-relaxed text-amber-200/70">
            {warnings.slice(0, 5).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Suggestions are a question, not an entry. Answered before the list. */}
      {groups.suggested.length ? (
        <section>
          <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-sky-400/80">
            Suggested · {groups.suggested.length}
          </h3>
          <p className="mb-2 text-xs text-neutral-500">
            Found by scanning. Nothing here counts until you accept it.
          </p>
          <ul className="space-y-2">
            {groups.suggested.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-400/25 bg-sky-400/[0.04] p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-100">
                    {f.name}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-neutral-500">
                    {f.evidence?.join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onChange({ ...f, review: "accepted" })}
                  className="rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-400/25"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...f, review: "dismissed" })}
                  className="rounded-lg border border-white/12 px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        {loading ? (
          <Skeleton />
        ) : !entries.length ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-neutral-300">
              No features registered yet.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-500">
              Scan the project to find them from its dependencies and code, or
              declare them with a <code className="font-mono">@feature</code>{" "}
              comment, a <code className="font-mono">project.features.ts</code>{" "}
              file, or the SDK.
            </p>
          </div>
        ) : !visible.length ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-neutral-400">
              Nothing matches those filters.
            </p>
          </div>
        ) : view === "list" ? (
          <ul className="space-y-2">
            {visible.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelected(f.id)}
                  className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-white/25"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-neutral-100">
                        {f.name}
                      </span>
                      <OriginBadge entry={f} />
                    </span>
                    {f.description ? (
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {f.description}
                      </span>
                    ) : null}
                  </span>
                  {f.category ? (
                    <span className="shrink-0 text-[11px] text-neutral-500">
                      {f.category}
                    </span>
                  ) : null}
                  <StatusBadge status={f.status} />
                  <span className="shrink-0 font-mono text-[10px] text-neutral-600">
                    {relative(f.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelected(f.id)}
                  className="flex h-full w-full flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-white/25"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-neutral-100">
                      {f.name}
                    </span>
                    <OriginBadge entry={f} />
                  </span>
                  <StatusBadge status={f.status} />
                  {f.description ? (
                    <span className="line-clamp-2 text-xs leading-relaxed text-neutral-500">
                      {f.description}
                    </span>
                  ) : null}
                  <span className="mt-auto flex items-center gap-2 font-mono text-[10px] text-neutral-600">
                    {f.category ?? "uncategorised"} · {relative(f.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {active ? (
        <FeatureDetail
          feature={active}
          all={entries}
          onClose={() => setSelected(null)}
          onChange={onChange}
          onRemove={(id) => {
            onRemove(id);
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** The detail panel. Everything the spec asks a feature page to show. */
function FeatureDetail({
  feature,
  all,
  onClose,
  onChange,
  onRemove,
}: {
  feature: Feature;
  all: Feature[];
  onClose: () => void;
  onChange: (entry: Feature) => void;
  onRemove: (id: string) => void;
}) {
  const dependencies = all.filter((e) => feature.dependsOn.includes(e.id));
  const dependents = all.filter((e) => e.dependsOn.includes(feature.id));

  return (
    <section
      aria-label={`${feature.name} details`}
      className="rounded-2xl border border-white/15 bg-neutral-950/70 p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-neutral-50">
            {feature.name}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-600">
            {feature.id}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/12 px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200"
        >
          Close
        </button>
      </div>

      {feature.description ? (
        <p className="mb-4 text-sm leading-relaxed text-neutral-400">
          {feature.description}
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Status
          </span>
          <select
            value={feature.status}
            onChange={(e) =>
              onChange({ ...feature, status: e.target.value as FeatureStatus })
            }
            className="w-full rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 text-sm text-neutral-200 focus:outline-none"
          >
            {FEATURE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {FEATURE_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Priority
          </span>
          <select
            value={feature.priority}
            onChange={(e) =>
              onChange({
                ...feature,
                priority: e.target.value as Feature["priority"],
              })
            }
            className="w-full rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 text-sm text-neutral-200 focus:outline-none"
          >
            {FEATURE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Owner
          </span>
          <input
            value={feature.owner ?? ""}
            onChange={(e) => onChange({ ...feature, owner: e.target.value })}
            placeholder="unassigned"
            className="w-full rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Version
          </span>
          <input
            value={feature.version ?? ""}
            onChange={(e) => onChange({ ...feature, version: e.target.value })}
            placeholder="—"
            className="w-full rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 font-mono text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 text-xs sm:grid-cols-2">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Timeline
          </p>
          <p className="text-neutral-400">
            Created {relative(feature.createdAt)} · updated{" "}
            {relative(feature.updatedAt)} · revision {feature.revision}
          </p>
        </div>

        {feature.evidence?.length ? (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              Why this was detected
            </p>
            <ul className="space-y-0.5 text-neutral-400">
              {feature.evidence.map((e) => (
                <li key={e} className="font-mono text-[11px]">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {feature.files.length ? (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              Related files
            </p>
            <ul className="space-y-0.5">
              {feature.files.slice(0, 8).map((f) => (
                <li
                  key={f}
                  className="truncate font-mono text-[11px] text-amber-300/80"
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Dependencies
          </p>
          {dependencies.length || dependents.length ? (
            <ul className="space-y-0.5 text-neutral-400">
              {dependencies.map((d) => (
                <li key={d.id}>depends on {d.name}</li>
              ))}
              {dependents.map((d) => (
                <li key={d.id}>{d.name} depends on this</li>
              ))}
            </ul>
          ) : (
            <p className="text-neutral-600">None recorded.</p>
          )}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-500">
          Notes
        </span>
        <textarea
          value={feature.notes ?? ""}
          onChange={(e) => onChange({ ...feature, notes: e.target.value })}
          rows={3}
          placeholder="Anything a scan can't know."
          className="w-full resize-y rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
        <p className="text-[11px] text-neutral-600">
          History is recorded on every change. Commits, pull requests and issues
          are not wired up yet.
        </p>
        <button
          type="button"
          onClick={() => onRemove(feature.id)}
          className="shrink-0 rounded-lg border border-rose-400/30 px-2.5 py-1 text-xs text-rose-300/90 hover:bg-rose-400/10"
        >
          Remove
        </button>
      </div>
    </section>
  );
}

"use client";

import type { Deliverable, ProjectProfile } from "@/lib/catalog/types";
import { AGENT_LABEL, type AgentTarget } from "@/lib/engine/prompt";
import type { Prefs, ProfileOverrides } from "@/lib/settings/types";

const DELIVERABLES: Deliverable[] = ["code", "report", "demo", "viva"];
const AGENTS: AgentTarget[] = [
  "claude-code",
  "cursor",
  "lovable",
  "v0",
  "generic",
];

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/8 py-3.5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-neutral-200">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`h-6 w-11 rounded-full border transition-colors ${
        on
          ? "border-emerald-400/50 bg-emerald-400/25"
          : "border-white/15 bg-white/[0.06]"
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-neutral-100 transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const input =
  "rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-sm text-neutral-200 focus:border-white/30 focus:outline-none";

export function Settings({
  profile,
  prefs,
  onPrefs,
  onProfile,
  onReset,
}: {
  profile: ProjectProfile;
  prefs: Prefs;
  onPrefs: (patch: Partial<Prefs>) => void;
  onProfile: (patch: ProfileOverrides) => void;
  onReset: () => void;
}) {
  const a = profile.academic;

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------ project */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-neutral-100">Project</h2>
        <p className="mb-3 text-sm text-neutral-500">
          These change the plan. Editing them re-runs selection, so steps can
          appear or disappear.
        </p>

        <Row label="Project name">
          <input
            value={profile.one_liner}
            onChange={(e) => onProfile({ one_liner: e.target.value })}
            className={`${input} w-72`}
          />
        </Row>

        <Row
          label="Deadline"
          hint="Drives the on-track indicator and the cut recommendations."
        >
          <input
            type="date"
            value={a.deadline_date ?? ""}
            onChange={(e) =>
              onProfile({ deadline_date: e.target.value || null })
            }
            className={`${input} w-44`}
          />
        </Row>

        <Row
          label="Deliverables"
          hint="What the brief asks for. Removing one hides the steps that exist only to produce it."
        >
          <div className="flex flex-wrap justify-end gap-1.5">
            {DELIVERABLES.map((d) => {
              const on = a.deliverables.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    onProfile({
                      deliverables: on
                        ? a.deliverables.filter((x) => x !== d)
                        : [...a.deliverables, d],
                    })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-xs capitalize transition-colors ${
                    on
                      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                      : "border-white/12 bg-white/[0.03] text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </Row>

        <Row
          label="Marked on someone else's machine"
          hint="Adds the clean-clone reliability step — the single biggest killer of student projects."
        >
          <Toggle
            on={a.must_run_locally}
            onChange={(v) => onProfile({ must_run_locally: v })}
          />
        </Row>

        <Row
          label="I have a marking rubric"
          hint="Unlocks mapping steps to marks. Without it, steps are ordered but not weighted."
        >
          <Toggle
            on={a.has_rubric}
            onChange={(v) => onProfile({ has_rubric: v })}
          />
        </Row>

        <Row
          label="Stack mandated by the brief"
          hint="Named here, it goes into every generated prompt as a hard constraint."
        >
          <input
            value={a.tech_constraints ?? ""}
            placeholder="e.g. Java — leave blank if free choice"
            onChange={(e) =>
              onProfile({ tech_constraints: e.target.value || null })
            }
            className={`${input} w-72 placeholder:text-neutral-600`}
          />
        </Row>

        <Row
          label="People on the project"
          hint="Above one, group-only steps appear and contribution attribution turns on."
        >
          <input
            type="number"
            min={1}
            max={12}
            value={a.group_size}
            onChange={(e) =>
              onProfile({ group_size: Math.max(1, Number(e.target.value) || 1) })
            }
            className={`${input} w-20`}
          />
        </Row>
      </section>

      {/* -------------------------------------------------------- preferences */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-neutral-100">
          Preferences
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          How DevCon works for you. These don&apos;t change the plan.
        </p>

        <Row
          label="Hours a week you actually have"
          hint="Used to judge whether the remaining work fits the remaining calendar. Be honest — an optimistic number produces a plan that says you're fine right up until you aren't."
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={40}
              step={1}
              value={prefs.hoursPerWeek}
              onChange={(e) => onPrefs({ hoursPerWeek: Number(e.target.value) })}
              className="w-40 accent-amber-400"
            />
            <span className="w-12 shrink-0 text-right font-mono text-xs text-neutral-300">
              {prefs.hoursPerWeek}h
            </span>
          </div>
        </Row>

        <Row
          label="Default agent"
          hint="Which agent prompts are written for when you open the Prompts section."
        >
          <select
            value={prefs.defaultAgent}
            onChange={(e) =>
              onPrefs({ defaultAgent: e.target.value as AgentTarget })
            }
            className={`${input} w-44`}
          >
            {AGENTS.map((x) => (
              <option key={x} value={x}>
                {AGENT_LABEL[x]}
              </option>
            ))}
          </select>
        </Row>

        <Row
          label="Show estimates and marks"
          hint="Turn off if the numbers are more stressful than useful."
        >
          <Toggle
            on={prefs.showEstimates}
            onChange={(v) => onPrefs({ showEstimates: v })}
          />
        </Row>
      </section>

      {/* --------------------------------------------------------------- data */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-neutral-100">Data</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Everything lives in this browser. Nothing is on a server yet.
        </p>

        <Row
          label="Reset this workspace"
          hint="Clears completed steps, your own tasks, checklists and settings. Docs are kept."
        >
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-red-400/30 bg-red-400/[0.08] px-3 py-1.5 text-sm text-red-300 transition-colors hover:bg-red-400/15"
          >
            Reset
          </button>
        </Row>
      </section>

      {/* -------------------------------------------------------------- about */}
      <section>
        <h2 className="mb-1 text-base font-semibold text-neutral-100">About</h2>
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <p className="mb-2 text-sm font-medium text-amber-200">
            Not built yet — stated so you don&apos;t go looking
          </p>
          <ul className="space-y-1 text-xs leading-relaxed text-amber-200/70">
            <li>
              · No backend. Progress lives in this browser and clears if you
              clear site data.
            </li>
            <li>
              · Prompts are assembled from templates, not written by an LLM, and
              none have been verified against a real repo.
            </li>
            <li>
              · Provider free tiers are seeded, not audited — check them before
              relying on one.
            </li>
            <li>· No accounts, no sync, no team. Those land together.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

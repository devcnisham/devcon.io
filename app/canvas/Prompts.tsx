"use client";

import { useMemo, useState } from "react";
import type { Plan, ProjectProfile, Step } from "@/lib/catalog/types";
import {
  AGENT_LABEL,
  type AgentTarget,
  buildPrompt,
} from "@/lib/engine/prompt";
import { track } from "@/lib/telemetry/events";

const AGENTS: AgentTarget[] = [
  "claude-code",
  "cursor",
  "lovable",
  "v0",
  "generic",
];

function formatEstimate(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function Prompts({
  profile,
  plan,
  completed,
  ready,
  defaultAgent,
  detected,
  project,
}: {
  profile: ProjectProfile;
  plan: Plan;
  completed: Set<string>;
  ready: Set<string>;
  /** From Settings. Local state so switching here doesn't overwrite the pref. */
  defaultAgent: AgentTarget;
  /** Env key names from the repo scan, so prompts can name the real services. */
  detected?: { envKeys: string[] };
  /** Project token — events are keyed by it, since there are no accounts. */
  project: string;
}) {
  const [agent, setAgent] = useState<AgentTarget>(defaultAgent);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const active = useMemo(
    () => plan.steps.find((s) => !completed.has(s.id) && ready.has(s.id)) ?? null,
    [plan.steps, completed, ready],
  );

  // Active first, then unblocked, then blocked. Completed steps are collapsed
  // away — their prompt is history, not work.
  const ordered = useMemo(() => {
    const rank = (s: Step) =>
      s.id === active?.id ? 0 : ready.has(s.id) ? 1 : 2;
    return plan.steps
      .filter((s) => showDone || !completed.has(s.id))
      .slice()
      .sort((a, b) => rank(a) - rank(b));
  }, [plan.steps, completed, ready, active, showDone]);

  /**
   * Copy, and only record it if the clipboard actually took it.
   *
   * `writeText` rejects when the document isn't focused, on a non-secure
   * origin, or when permission is denied. Two things were wrong before:
   * the rejection was unhandled (crashing the dev overlay), and the event
   * fired regardless — so a failed copy was counted as a successful one.
   * That corrupts `prompt_copied`, which is the signal this instrumentation
   * exists to produce.
   */
  const copy = async (step: Step) => {
    const text = buildPrompt(
      step,
      profile,
      plan,
      completed,
      agent,
      new Set(),
      detected,
    );

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older/blocked path: a hidden textarea still works when the async
      // clipboard API refuses.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand failed");
      } catch {
        setFailedId(step.id);
        setTimeout(() => setFailedId(null), 2400);
        return; // No event — nothing reached the clipboard.
      }
    }

    // Recorded separately from completion on purpose — the gap between the two
    // is what tells us the prompt failed rather than the person losing interest.
    track("prompt_copied", project, step.id, { agent });
    setCopiedId(step.id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const doneCount = plan.steps.filter((s) => completed.has(s.id)).length;

  return (
    <div>
      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-neutral-100">Prompts</h2>
        <p className="mb-4 text-sm text-neutral-500">
          One per step, carrying your stack, what&apos;s already built, and
          what&apos;s explicitly out of scope. Paste into whatever agent you use.
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            Target
          </span>
          {AGENTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAgent(a)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                agent === a
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                  : "border-white/12 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.08] hover:text-neutral-200"
              }`}
            >
              {AGENT_LABEL[a]}
            </button>
          ))}
        </div>
      </section>

      <ul className="space-y-2">
        {ordered.map((step) => {
          const isActive = step.id === active?.id;
          const isDone = completed.has(step.id);
          const blocked = !ready.has(step.id) && !isDone;
          const open = openId === step.id;
          const text = open
            ? buildPrompt(step, profile, plan, completed, agent, new Set(), detected)
            : "";

          return (
            <li
              key={step.id}
              className={`rounded-xl border transition-colors ${
                isActive
                  ? "border-amber-400/50 bg-amber-400/[0.05]"
                  : isDone
                    ? "border-white/8 bg-white/[0.01]"
                    : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!open) track("step_opened", project, step.id);
                    setOpenId(open ? null : step.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-2">
                    {isActive ? (
                      <span className="shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                        now
                      </span>
                    ) : null}
                    <span
                      className={`truncate text-sm ${
                        isDone ? "text-neutral-600 line-through" : "text-neutral-100"
                      }`}
                    >
                      {step.title}
                    </span>
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-neutral-500">
                    {step.phase} · {formatEstimate(step.est_minutes)}
                    {step.mark_weight ? ` · ${step.mark_weight}%` : ""}
                    {blocked ? " · blocked" : ""}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void copy(step)}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    failedId === step.id
                      ? "border-red-400/40 bg-red-400/10 text-red-300"
                      : "border-white/15 bg-white/[0.06] text-neutral-200 hover:bg-white/12"
                  }`}
                >
                  {failedId === step.id
                    ? "Copy blocked"
                    : copiedId === step.id
                      ? "Copied"
                      : "Copy"}
                </button>
              </div>

              {open ? (
                <div className="border-t border-white/8">
                  {blocked ? (
                    <p className="border-b border-white/8 px-4 py-2 text-xs text-amber-300/80">
                      Blocked — {step.requires.length} earlier step
                      {step.requires.length === 1 ? "" : "s"} must finish first.
                      The prompt assumes they&apos;re done, so it will be wrong
                      if you run it now.
                    </p>
                  ) : null}
                  <pre className="max-h-[420px] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-neutral-300">
                    {text}
                  </pre>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {doneCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="mt-3 text-xs text-neutral-500 hover:text-neutral-300"
        >
          {showDone
            ? "▴ hide completed"
            : `▾ show ${doneCount} completed`}
        </button>
      ) : null}

      <p className="mt-6 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs leading-relaxed text-amber-200/80">
        These are assembled from templates plus your real project context — not
        LLM-written yet, and not run against a real repo. Per the catalog rubric
        a prompt isn&apos;t verified until it&apos;s been pasted into two agents
        and produced working output.
      </p>
    </div>
  );
}

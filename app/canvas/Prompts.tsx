"use client";

import { useMemo, useState } from "react";
import {
  executionOf,
  type Plan,
  type ProjectProfile,
  type Step,
} from "@/lib/catalog/types";
import { copyText } from "@/lib/clipboard";
import {
  AGENT_LABEL,
  type AgentTarget,
  buildChecklist,
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
  /**
   * Answers to `needs-input` steps, keyed `${stepId}:${inputKey}`.
   *
   * Local and unsaved on purpose for now — a judging rubric pasted here is the
   * event's text, not the builder's, and persisting it is a decision to make
   * deliberately rather than by default.
   */
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [failedId, setFailedId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const active = useMemo(
    () =>
      plan.steps.find((s) => !completed.has(s.id) && ready.has(s.id)) ?? null,
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
   * What this step actually offers.
   *
   * A `human` step has no prompt — `buildPrompt` throws for one, deliberately,
   * so a caller cannot render a paste button for "rehearse the demo out loud".
   */
  const textFor = (step: Step): string => {
    if (executionOf(step) === "human") return buildChecklist(step, profile);
    const supplied = Object.fromEntries(
      (step.inputs ?? []).map((i) => [
        i.key,
        answers[`${step.id}:${i.key}`] ?? "",
      ]),
    );
    return buildPrompt(
      step,
      profile,
      plan,
      completed,
      agent,
      new Set(),
      detected,
      supplied,
    );
  };

  /** Copy, and only record it if the clipboard actually took it. */
  const copy = async (step: Step) => {
    const text = textFor(step);

    if (!(await copyText(text))) {
      setFailedId(step.id);
      setTimeout(() => setFailedId(null), 2400);
      return; // No event — nothing reached the clipboard.
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
        <h2 className="mb-1 text-base font-semibold text-neutral-100">
          Prompts
        </h2>
        <p className="mb-4 text-sm text-neutral-500">
          One per step, carrying your stack, what&apos;s already built, and
          what&apos;s explicitly out of scope. Paste into whatever agent you use
          — except the steps marked as yours, which no agent can do.
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
          const text = open ? textFor(step) : "";

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
                        isDone
                          ? "text-neutral-600 line-through"
                          : "text-neutral-100"
                      }`}
                    >
                      {step.title}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-neutral-500">
                    <span>
                      {step.phase} · {formatEstimate(step.est_minutes)}
                      {step.mark_weight ? ` · ${step.mark_weight}%` : ""}
                      {blocked ? " · blocked" : ""}
                    </span>
                    {/* The mode is visible before expanding, so nobody opens a
                        card expecting a prompt and finds a checklist. */}
                    {executionOf(step) === "human" ? (
                      <span className="rounded bg-white/[0.07] px-1.5 py-0.5 uppercase tracking-wide text-neutral-400">
                        you, not an agent
                      </span>
                    ) : executionOf(step) === "needs-input" ? (
                      <span className="rounded bg-amber-400/15 px-1.5 py-0.5 uppercase tracking-wide text-amber-300/90">
                        needs your input
                      </span>
                    ) : null}
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
                      : executionOf(step) === "human"
                        ? "Copy checklist"
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

                  {executionOf(step) === "human" ? (
                    <p className="border-b border-white/8 px-4 py-2 text-xs leading-relaxed text-neutral-400">
                      No prompt for this one. It needs a person — so this is a
                      checklist to work from or drop in the team chat.
                    </p>
                  ) : null}

                  {/* A needs-input step's prompt is only worth having once these
                      are filled. Empty ones are named in the prompt as missing
                      rather than quietly dropped, so the agent asks instead of
                      inventing an answer. */}
                  {step.inputs?.length ? (
                    <div className="space-y-3 border-b border-white/8 px-4 py-3">
                      {step.inputs.map((input) => {
                        const k = `${step.id}:${input.key}`;
                        const value = answers[k] ?? "";
                        return (
                          <label key={input.key} className="block">
                            <span className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                              {input.label}
                              {value.trim() ? null : (
                                <span className="text-amber-400/80">
                                  missing
                                </span>
                              )}
                            </span>
                            input.multiline ? (
                            <textarea
                              value={value}
                              rows={3}
                              placeholder={input.placeholder}
                              onChange={(e) =>
                                setAnswers((a) => ({
                                  ...a,
                                  [k]: e.target.value,
                                }))
                              }
                              className="w-full resize-y rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
                            />
                            ) : (
                            <input
                              value={value}
                              placeholder={input.placeholder}
                              onChange={(e) =>
                                setAnswers((a) => ({
                                  ...a,
                                  [k]: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-white/30 focus:outline-none"
                            />
                            )
                          </label>
                        );
                      })}
                      <p className="text-[11px] leading-relaxed text-neutral-500">
                        DevCon can&apos;t know these — they&apos;re facts about
                        your event, not your code. Left blank, the prompt tells
                        the agent to ask rather than guess.
                      </p>
                    </div>
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
          {showDone ? "▴ hide completed" : `▾ show ${doneCount} completed`}
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

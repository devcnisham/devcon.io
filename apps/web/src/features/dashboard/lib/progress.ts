/**
 * Progress derived from phases and tasks.
 *
 * Nothing here is stored. "Current phase" and "current task" are computed from
 * what is finished, so they cannot drift out of sync with reality the way a
 * stored pointer would.
 */

export type Task = {
  id: string;
  title: string;
  done: boolean;
};

export type Phase = {
  id: string;
  name: string;
  tasks: Task[];
};

/**
 * Percentage of a phase's tasks that are done.
 *
 * A phase with no tasks reports 0, not 100 — an unplanned phase is not a
 * finished one, and rounding it up would overstate progress.
 */
export function phaseProgress(phase: Phase): number {
  if (phase.tasks.length === 0) return 0;

  const done = phase.tasks.filter((task) => task.done).length;
  return Math.round((done / phase.tasks.length) * 100);
}

/**
 * Progress across the whole project, weighted by task count rather than by
 * phase — a phase with twenty tasks should not count the same as one with two.
 *
 * Rounds down while any task is open, so a project is never shown as 100%
 * complete with work outstanding.
 */
export function overallProgress(phases: Phase[]): number {
  const tasks = phases.flatMap((phase) => phase.tasks);
  if (tasks.length === 0) return 0;

  const done = tasks.filter((task) => task.done).length;
  if (done === tasks.length) return 100;

  return Math.min(99, Math.floor((done / tasks.length) * 100));
}

/** The first phase with work left. Empty phases are skipped, not stalled on. */
export function currentPhase(phases: Phase[]): Phase | null {
  return phases.find((phase) => phase.tasks.some((task) => !task.done)) ?? null;
}

/** The first unfinished task of the current phase — the thing to work on. */
export function currentTask(phases: Phase[]): Task | null {
  const phase = currentPhase(phases);
  if (!phase) return null;

  return phase.tasks.find((task) => !task.done) ?? null;
}

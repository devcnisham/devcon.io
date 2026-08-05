export type TaskStatus = "todo" | "doing" | "done";

/** A task the builder added themselves, alongside the catalog steps. */
export interface CustomTask {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: number;
}

/**
 * All mutable project state that isn't the plan itself.
 *
 * Kept in one object so it can move behind PlanStore in a single change when
 * the backend lands — rather than being scattered across component state.
 */
export interface TaskState {
  /** Catalog step ids marked complete. */
  completed: Set<string>;
  /** Catalog step ids actively being worked. */
  doing: Set<string>;
  /** Ticked `done_when` items, keyed `${stepId}::${index}`. */
  checked: Set<string>;
  custom: CustomTask[];
}

export const checkKey = (stepId: string, index: number) =>
  `${stepId}::${index}`;

export function emptyTaskState(): TaskState {
  return {
    completed: new Set(),
    doing: new Set(),
    checked: new Set(),
    custom: [],
  };
}

/** Status of a catalog step, derived from the two id sets. */
export function statusOf(id: string, state: TaskState): TaskStatus {
  if (state.completed.has(id)) return "done";
  if (state.doing.has(id)) return "doing";
  return "todo";
}

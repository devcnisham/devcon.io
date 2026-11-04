/**
 * Shared application types. Feature-specific types live next to their feature
 * in `src/features/<feature>/types.ts`.
 */

export type Nullable<T> = T | null;

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

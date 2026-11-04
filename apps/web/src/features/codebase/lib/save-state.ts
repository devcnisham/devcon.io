/**
 * Save-state machine for the import screen's "Save index" button, extracted
 * from the component so the scan-token binding that prevents a stale
 * "Index saved." is a pure, testable function.
 *
 * A save is bound to the scan it started on: handleSave captures the scan
 * token, and when the action resolves the token is compared again. If a
 * rescan completed while the save was in flight, the token moved on and the
 * result must not mark the new scan as saved — the new scan is unsaved.
 */

export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

export type SaveActionResult = { ok: boolean; message?: string };

export function resolveSaveResult(
  tokenAtSave: number,
  currentToken: number,
  result: SaveActionResult
): SaveState {
  // The scan changed while the save was in flight — the stale result is
  // discarded and the new scan is left unsaved.
  if (tokenAtSave !== currentToken) return { status: "idle" };
  if (!result.ok) {
    return {
      status: "error",
      message: result.message ?? "Something went wrong. Try again.",
    };
  }
  return { status: "saved" };
}

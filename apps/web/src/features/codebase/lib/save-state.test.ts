import { describe, expect, it } from "vitest";
import { resolveSaveResult } from "./save-state";

/**
 * The save result is bound to the scan it started on. If a rescan completes
 * while the save is in flight, the token moves on and the stale result must
 * not mark the NEW scan as saved.
 */

describe("resolveSaveResult", () => {
  it("marks the scan saved when the token is unchanged and the save succeeded", () => {
    expect(resolveSaveResult(3, 3, { ok: true })).toEqual({
      status: "saved",
    });
  });

  it("reports the failure when the token is unchanged and the save failed", () => {
    expect(
      resolveSaveResult(3, 3, { ok: false, message: "Project not found." })
    ).toEqual({ status: "error", message: "Project not found." });
  });

  it("falls back to a generic message when the failure carries none", () => {
    expect(resolveSaveResult(3, 3, { ok: false })).toEqual({
      status: "error",
      message: "Something went wrong. Try again.",
    });
  });

  it("stays idle when a rescan replaced the scan being saved", () => {
    expect(resolveSaveResult(2, 3, { ok: true })).toEqual({ status: "idle" });
  });
});

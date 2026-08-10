import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * A real Finder window, opened from the server.
 *
 * The browser cannot do this. `showDirectoryPicker()` is Chromium-only and
 * **deliberately never exposes an absolute path** — it hands back an opaque
 * handle — and `<input webkitdirectory>` only gives paths relative to the
 * folder you chose. Either way the server would never learn where the project
 * actually is, which is the one thing it needs.
 *
 * devcon runs on your machine, so the server can ask macOS directly. The dialog
 * opens on the same Mac that is serving the page, which is the same Mac you are
 * looking at.
 *
 * The AppleScript is a fixed string. No part of it is built from anything the
 * page supplies, so there is nothing here to inject into.
 */

const SCRIPT =
  'POSIX path of (choose folder with prompt "Choose a project folder")';

export type PickResult =
  | { ok: true; path: string }
  | { ok: false; reason: "cancelled" | "unsupported" | "failed" };

export function pickerAvailable(): boolean {
  return process.platform === "darwin";
}

/**
 * Blocks until the dialog is answered.
 *
 * The timeout is generous because a person is choosing a folder, not a machine
 * running a command — but it exists, so a dialog nobody notices cannot hold a
 * request open forever.
 */
export async function pickFolder(timeoutMs = 120_000): Promise<PickResult> {
  if (!pickerAvailable()) return { ok: false, reason: "unsupported" };

  try {
    const { stdout } = await run(
      "/usr/bin/osascript",
      // `-e` twice: bring the dialog to the front, then ask. Without the
      // activate it can open behind the browser window and look like nothing
      // happened.
      ["-e", 'tell application "Finder" to activate', "-e", SCRIPT],
      { timeout: timeoutMs },
    );

    // AppleScript returns a trailing slash on directories.
    const path = stdout.trim().replace(/\/+$/, "");
    return path ? { ok: true, path } : { ok: false, reason: "cancelled" };
  } catch (e) {
    const err = e as { stderr?: string; killed?: boolean };
    // Pressing Cancel is a normal outcome, not an error to report.
    if (/User canceled|-128/.test(err.stderr ?? "")) {
      return { ok: false, reason: "cancelled" };
    }
    return { ok: false, reason: "failed" };
  }
}

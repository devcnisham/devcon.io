import { execFile } from "node:child_process";
import { release } from "node:os";
import { promisify } from "node:util";
import { pickerAvailable } from "./pick-folder.ts";
import { sandboxUnavailable } from "./ship/sandbox.ts";

const run = promisify(execFile);

/**
 * What this machine can actually do.
 *
 * Every line is probed, not assumed. Several features here are quietly
 * platform-dependent — the sandbox is macOS-only, the folder dialog is
 * macOS-only, and git may not be installed at all — and a settings page that
 * listed them as working because the code exists would be the same unchecked
 * claim this tool is built to catch.
 */

export interface Probe {
  label: string;
  value: string;
  /** Null when fine; a reason when not. */
  problem?: string | null;
  hint: string;
}

async function gitVersion(): Promise<string | null> {
  try {
    const { stdout } = await run("git", ["--version"], { timeout: 5_000 });
    return stdout.trim().replace(/^git version /, "") || null;
  } catch {
    return null;
  }
}

export async function hostDiagnostics(): Promise<Probe[]> {
  const sandbox = sandboxUnavailable();
  const git = await gitVersion();
  const picker = pickerAvailable();

  return [
    {
      label: "Platform",
      value: `${process.platform} ${process.arch} · ${release()}`,
      hint: "Two features below depend on this being macOS.",
    },
    {
      label: "Node",
      value: process.version,
      hint: "The runtime serving these pages and running your checks.",
    },
    {
      label: "Check sandbox",
      value: sandbox ? "unavailable" : "active",
      problem: sandbox,
      hint: sandbox
        ? "Checks will refuse to run rather than run unconfined."
        : "macOS seatbelt. No network, no filesystem outside the project and toolchain.",
    },
    {
      label: "Folder dialog",
      value: picker ? "available" : "unavailable",
      problem: picker
        ? null
        : "Not macOS — type a path on the dashboard instead.",
      hint: "Opens a real Finder window from the server. The browser cannot do this.",
    },
    {
      label: "git",
      value: git ?? "not found",
      problem: git
        ? null
        : "Cloning will fail until git is on this server's PATH.",
      hint: "Used for cloning. Checks that call git run inside the sandbox instead.",
    },
  ];
}

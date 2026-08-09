import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Condition } from "./parse";

const run = promisify(exec);

/**
 * Runs the done-when checks.
 *
 * This is the whole difference between a spec and a wish. A ticked box is a
 * claim; an exit code is evidence. v0.1 recorded a prompt as passing because a
 * `curl` returned 200 from a *different* server that happened to hold the port
 * — so a check that cannot show its working is not a check.
 */

export type Verdict = "pass" | "fail" | "human" | "error";

export interface Checked extends Condition {
  verdict: Verdict;
  /** What actually happened. Shown, never summarised away. */
  evidence: string;
  ms: number;
}

/** Long enough for a build, short enough that a hung check does not hang the page. */
const TIMEOUT_MS = 20_000;

async function one(c: Condition, cwd: string): Promise<Checked> {
  if (!c.check) {
    return {
      ...c,
      verdict: "human",
      evidence: "No command — a person decides this one.",
      ms: 0,
    };
  }

  const started = Date.now();
  try {
    const { stdout, stderr } = await run(c.check, {
      cwd,
      timeout: TIMEOUT_MS,
      // A check that floods the page is a check nobody reads.
      maxBuffer: 1024 * 256,
    });
    const out = (stdout || stderr).trim();
    return {
      ...c,
      verdict: "pass",
      evidence: out ? out.slice(0, 400) : "exit 0",
      ms: Date.now() - started,
    };
  } catch (e) {
    const err = e as {
      code?: number;
      killed?: boolean;
      stderr?: string;
      stdout?: string;
      message?: string;
    };
    const out = (err.stderr || err.stdout || err.message || "").trim();
    return {
      ...c,
      // A command that could not run at all is not the same as one that ran and
      // said no. Collapsing them is how a broken check reads as a real failure.
      verdict: err.killed
        ? "error"
        : typeof err.code === "number"
          ? "fail"
          : "error",
      evidence: err.killed
        ? `Timed out after ${TIMEOUT_MS / 1000}s`
        : out.slice(0, 400) || `exit ${err.code}`,
      ms: Date.now() - started,
    };
  }
}

/** All of them, concurrently — they are independent by construction. */
export function checkAll(cs: Condition[], cwd: string): Promise<Checked[]> {
  return Promise.all(cs.map((c) => one(c, cwd)));
}

export function tally(checked: Checked[]) {
  const pass = checked.filter((c) => c.verdict === "pass").length;
  const fail = checked.filter((c) => c.verdict === "fail").length;
  const human = checked.filter((c) => c.verdict === "human").length;
  const error = checked.filter((c) => c.verdict === "error").length;
  return { pass, fail, human, error, total: checked.length };
}

/**
 * Conditions whose box is ticked but whose command disagrees.
 *
 * The most valuable thing this tool can say, and the reason `claimed` and
 * `verdict` are kept apart rather than merged into one boolean.
 */
export function lies(checked: Checked[]): Checked[] {
  return checked.filter((c) => c.claimed && c.verdict === "fail");
}

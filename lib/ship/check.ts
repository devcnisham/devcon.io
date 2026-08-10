import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Condition } from "./parse.ts";
import { sandboxArgv, sandboxEnv, sandboxUnavailable } from "./sandbox.ts";

// execFile, not exec: the command reaches `/bin/sh` as one argv element inside
// the sandbox rather than being pasted into a shell string out here.
const run = promisify(execFile);

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

/**
 * How long a check may take, and how many may run at once.
 *
 * The first version allowed 20s and ran every check at once, and the pair of
 * them made a verdict depend on the machine rather than on the code. This repo
 * reported five passing conditions and then four, minutes apart, and the only
 * variable was other software on the laptop: `pnpm exec tsc --noEmit` takes
 * about 1.3s idle and over 20s at a load average of 32. **A timeout is not an
 * exit code**, and a tool whose whole claim is that an exit code is evidence
 * cannot have its answer change because a text editor is busy.
 *
 * Both numbers moved for the same reason:
 *
 * - 120s, because the honest ceiling is "a check that is still running is
 *   probably hung", not "a check that is slower than a build is failing". A
 *   real `pnpm build` fits with room to spare.
 * - Four at a time, because unbounded concurrency manufactured the load that
 *   tripped the old ceiling. Thirteen sandboxed commands at once, two of them
 *   spawning entire toolchains — and one of those, `pnpm test`, spawning
 *   nineteen more sandboxes of its own.
 *
 * This makes a timeout rarer. It cannot make it impossible, so the verdict for
 * one stays `error` and never `fail`.
 */
export const DEFAULTS = { timeoutMs: 120_000, concurrency: 4 } as const;

export interface CheckOptions {
  timeoutMs?: number;
  concurrency?: number;
}

async function one(
  c: Condition,
  cwd: string,
  timeoutMs: number,
): Promise<Checked> {
  if (!c.check) {
    return {
      ...c,
      verdict: "human",
      evidence: "No command — a person decides this one.",
      ms: 0,
    };
  }

  const blocked = sandboxUnavailable();
  if (blocked) {
    return { ...c, verdict: "error", evidence: blocked, ms: 0 };
  }

  const started = Date.now();
  const { file, args } = sandboxArgv(c.check, cwd);
  try {
    const { stdout, stderr } = await run(file, args, {
      cwd,
      timeout: timeoutMs,
      // A check that floods the page is a check nobody reads.
      maxBuffer: 1024 * 256,
      // Never the parent's — see sandboxEnv.
      env: sandboxEnv(),
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
      signal?: string;
      killed?: boolean;
      stderr?: string;
      stdout?: string;
      message?: string;
    };
    const out = (err.stderr || err.stdout || err.message || "").trim();

    // The sandbox refusing to start, or killing the shell outright, is not the
    // check answering no. Reporting it as "fail" would blame the spec for a
    // hole in the profile.
    const sandboxDied =
      err.signal === "SIGABRT" || err.code === 65 || err.code === 71;

    const ms = Date.now() - started;
    if (err.killed) {
      // Never "fail". This says nothing about the condition — only that the
      // command was still running, and the most common reason is a busy
      // machine rather than a broken repo. Saying so on the page is the point:
      // a reader who sees "error" and this sentence knows to re-run, where
      // "fail" would have sent them to fix a condition that was fine.
      return {
        ...c,
        verdict: "error",
        evidence: `Still running after ${Math.round(timeoutMs / 1000)}s, so it was stopped. This is not a failed condition — it is no answer at all. A loaded machine is the usual cause; re-run before believing it.`,
        ms,
      };
    }
    if (sandboxDied) {
      const why =
        "Sandbox stopped this before it could answer — the check needs something the profile denies, or the profile is wrong.";
      return {
        ...c,
        verdict: "error",
        evidence: `${why} ${out}`.slice(0, 400),
        ms,
      };
    }
    return {
      ...c,
      // A command that could not run at all is not the same as one that ran and
      // said no. Collapsing them is how a broken check reads as a real failure.
      verdict: typeof err.code === "number" ? "fail" : "error",
      evidence: out.slice(0, 400) || `exit ${err.code}`,
      ms,
    };
  }
}

/**
 * All of them, a few at a time.
 *
 * They are independent by construction, so order does not matter — but running
 * every one at once does. `Promise.all` over the whole list put thirteen
 * sandboxed commands on the machine simultaneously, and the checks that then
 * timed out were the ones the storm had slowed down. Results are returned in
 * the order given, whatever order they finished in.
 */
export async function checkAll(
  cs: Condition[],
  cwd: string,
  opts: CheckOptions = {},
): Promise<Checked[]> {
  const timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
  const limit = Math.max(1, opts.concurrency ?? DEFAULTS.concurrency);

  const out = new Array<Checked>(cs.length);
  let next = 0;

  // One worker per slot, each taking the next unclaimed index. Simpler than a
  // queue and it cannot lose or double-run an item.
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= cs.length) return;
      out[i] = await one(cs[i], cwd, timeoutMs);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, cs.length) }, () => worker()),
  );
  return out;
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

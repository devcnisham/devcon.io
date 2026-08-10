import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Checked, type CheckOptions, checkAll } from "./check.ts";
import { parseSpec, type Spec } from "./parse.ts";

/**
 * One check run, shared between the views that need it.
 *
 * Both `/work/workspace` and `/work/canvas` show verdicts, and running every
 * command twice put the round trip between them at roughly thirteen seconds
 * each way. This holds the last run briefly so switching views is free.
 *
 * **A cached verdict that hides its age is exactly the claim this tool exists
 * to catch.** So `at` is returned, both views print it, and the cache is
 * deliberately easy to defeat: any edit to `SHIP.md` invalidates it
 * immediately, whatever the TTL says.
 */

export interface CheckedSpec {
  spec: Spec;
  checked: Checked[];
  /** When the commands actually ran. Always rendered, never hidden. */
  at: number;
}

/**
 * Short on purpose. Long enough to make a view switch free, short enough that
 * nobody reads a stale verdict for long — and the content check below matters
 * more than this number does.
 */
export const TTL_MS = 15_000;

interface Entry extends CheckedSpec {
  /** The exact bytes these verdicts were produced from. */
  source: string;
}

const cache = new Map<string, Entry>();

/** Test hygiene. Nothing in the app calls this. */
export function clearCache() {
  cache.clear();
}

export interface CheckedSpecOptions extends CheckOptions {
  ttlMs?: number;
  /** Injected by tests. Production always passes the real clock. */
  now?: () => number;
}

/**
 * The spec at `cwd`, checked — from cache when that is still honest.
 *
 * Returns null when there is no `SHIP.md`, which is a real state rather than an
 * error: the file is the whole interface, and a repo without one has not
 * started.
 */
/**
 * The spec, parsed and nothing more. Null when there is no `SHIP.md`.
 *
 * For surfaces that want the *shape* of a plan without paying for its
 * evidence. Parsing is microseconds; running the checks is seconds, and a
 * landing page that takes thirteen seconds to say hello is a broken landing
 * page. Anything that shows a verdict must use `checkedSpec` instead — the
 * shape is not the state.
 */
export async function readSpec(cwd: string): Promise<Spec | null> {
  try {
    return parseSpec(await readFile(join(cwd, "SHIP.md"), "utf8"));
  } catch {
    return null;
  }
}

export async function checkedSpec(
  cwd: string,
  opts: CheckedSpecOptions = {},
): Promise<CheckedSpec | null> {
  const ttl = opts.ttlMs ?? TTL_MS;
  const now = opts.now ?? Date.now;

  let source: string;
  try {
    source = await readFile(join(cwd, "SHIP.md"), "utf8");
  } catch {
    cache.delete(cwd);
    return null;
  }

  const hit = cache.get(cwd);
  // Content first, clock second. Editing the file and seeing yesterday's
  // verdicts would be worse than any slow render.
  if (hit && hit.source === source && now() - hit.at < ttl) {
    return { spec: hit.spec, checked: hit.checked, at: hit.at };
  }

  const spec = parseSpec(source);
  const checked = await checkAll(spec.conditions, cwd, opts);
  const entry: Entry = { spec, checked, at: now(), source };
  cache.set(cwd, entry);
  return { spec, checked, at: entry.at };
}

/** "just now", "8s ago", "2m ago" — plain enough to read without thinking. */
export function ageLabel(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 2) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

import { execFile } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Cloning a repository.
 *
 * **The URL is validated before git ever sees it.** `git clone` accepts
 * transports that execute commands — `ext::sh -c whoami` is a working remote,
 * and `file://` reaches the local disk. Only `https://` and `git@host:path` get
 * through here, so a pasted string cannot become a shell.
 *
 * Runs unsandboxed on purpose: cloning needs the network, and the checker's
 * sandbox denies it. That is a different job with different rules rather than a
 * quiet exception carved into the profile that protects check runs.
 */

export const CLONE_ROOT = join(homedir(), "devcon");

export type CloneError =
  | "empty"
  | "bad-url"
  | "exists"
  | "git-missing"
  | "failed";

export const CLONE_MESSAGE: Record<CloneError, string> = {
  empty: "Paste a repository URL.",
  "bad-url": "Only https:// and git@host:path URLs are accepted.",
  exists: "A folder of that name is already there.",
  "git-missing": "git is not installed, or not on this server's PATH.",
  failed: "Clone failed. Check the URL and that the repository is reachable.",
};

const HTTPS = /^https:\/\/[\w.-]+\/[\w./~-]+?(\.git)?\/?$/;
const SSH = /^git@[\w.-]+:[\w./~-]+?(\.git)?\/?$/;

/** The folder name a URL will land in. `…/user/repo.git` → `repo`. */
export function repoName(url: string): string {
  const tail = url.trim().replace(/\/+$/, "").split(/[/:]/).pop() ?? "";
  return tail.replace(/\.git$/, "");
}

export function validateUrl(
  raw: string,
): { ok: true; url: string; name: string } | { ok: false; error: CloneError } {
  const url = (raw ?? "").trim();
  if (!url) return { ok: false, error: "empty" };
  if (!HTTPS.test(url) && !SSH.test(url))
    return { ok: false, error: "bad-url" };

  const name = repoName(url);
  if (!name || name.startsWith(".")) return { ok: false, error: "bad-url" };

  return { ok: true, url, name };
}

export async function cloneRepo(
  raw: string,
  root = CLONE_ROOT,
): Promise<{ ok: true; path: string } | { ok: false; error: CloneError }> {
  const valid = validateUrl(raw);
  if (!valid.ok) return valid;

  const dest = join(root, valid.name);
  // Never clone over something that is already there.
  if (
    await stat(dest).then(
      () => true,
      () => false,
    )
  ) {
    return { ok: false, error: "exists" };
  }

  await mkdir(root, { recursive: true });

  try {
    // Resolved from PATH. Unlike a sandboxed check, a clone is unconfined, so
    // the stock macOS xcrun shim works here — it only failed inside the
    // sandbox, which had no access to the Xcode toolchain it loads.
    await run("git", ["clone", valid.url, dest], {
      timeout: 120_000,
      maxBuffer: 1024 * 512,
      // No inherited environment: the dev server's may hold tokens, and a
      // clone has no business seeing them.
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: process.env.HOME ?? homedir(),
        GIT_TERMINAL_PROMPT: "0",
        NODE_ENV: process.env.NODE_ENV,
      },
    });
    return { ok: true, path: dest };
  } catch (e) {
    const err = e as { code?: number | string; stderr?: string };
    if (err.code === "ENOENT") return { ok: false, error: "git-missing" };
    return { ok: false, error: "failed" };
  }
}

import type { ScanSource } from "./scan";

/**
 * Git information, read from the two plain-text files that answer the useful
 * questions: `.git/HEAD` for the current branch, `.git/config` for remotes.
 *
 * `.git/` is in the default ignore list so its thousands of object files never
 * enter the index — these two are read directly instead of walked.
 *
 * Absent or unreadable git data is never an error. Plenty of real projects are
 * not repositories, and that is worth knowing rather than failing over.
 */

export type GitRemote = {
  name: string;
  url: string;
  /** `owner/repo`, when the URL yields one. */
  repository: string | null;
};

export type GitInfo = {
  isRepository: boolean;
  branch: string | null;
  remotes: GitRemote[];
  /** HEAD points at a commit rather than a branch. */
  detached: boolean;
};

/** `ref: refs/heads/<branch>` → `<branch>`; a bare SHA means detached. */
export function parseGitHead(contents: string): string | null {
  const match = /^ref:\s*refs\/heads\/(.+)$/m.exec(contents.trim());

  return match ? match[1].trim() : null;
}

/** Turns a remote URL into `owner/repo`, for SSH and HTTPS alike. */
function toRepository(url: string): string | null {
  const cleaned = url.trim().replace(/\.git$/, "");

  const ssh = /^[^@]+@[^:]+:(.+)$/.exec(cleaned);
  if (ssh) return ssh[1];

  try {
    const path = new URL(cleaned).pathname.replace(/^\//, "");
    return path || null;
  } catch {
    return null;
  }
}

/** Minimal INI reader — only `[remote "name"]` blocks and their `url`. */
export function parseGitConfig(contents: string): GitRemote[] {
  const remotes: GitRemote[] = [];
  let current: string | null = null;

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    const section = /^\[remote\s+"([^"]+)"\]$/.exec(trimmed);
    if (section) {
      current = section[1];
      continue;
    }

    if (trimmed.startsWith("[")) {
      current = null;
      continue;
    }

    if (!current) continue;

    const url = /^url\s*=\s*(.+)$/.exec(trimmed);
    if (url) {
      remotes.push({
        name: current,
        url: url[1].trim(),
        repository: toRepository(url[1]),
      });
      current = null; // one url per remote is enough
    }
  }

  return remotes;
}

export async function readGitInfo(source: ScanSource): Promise<GitInfo> {
  let head: string;
  try {
    head = await source.readText(".git/HEAD");
  } catch {
    // Not a repository, or the host cannot reach inside .git — both fine.
    return { isRepository: false, branch: null, remotes: [], detached: false };
  }

  const branch = parseGitHead(head);

  let remotes: GitRemote[] = [];
  try {
    remotes = parseGitConfig(await source.readText(".git/config"));
  } catch {
    // A repository with no readable config still has a usable branch.
  }

  return {
    isRepository: true,
    branch,
    remotes,
    detached: branch === null,
  };
}

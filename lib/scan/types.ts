/**
 * Structural facts about a repo. Deliberately contains no source code.
 *
 * Mirrors the plan's RepoDigest: structure and dependency names only, so the
 * same shape works whether it came from a local scan, the CLI, or the MCP
 * server later.
 */
export interface RepoDigest {
  root: string;
  name: string | null;
  /** Dependency names only — never versions of private packages, never code. */
  dependencies: string[];
  devDependencies: string[];
  /** Workspace packages found — >0 means a monorepo. */
  workspaces: number;
  scripts: string[];
  /** Config files found at the root, by filename. */
  configFiles: string[];
  /** Top-level and second-level directory names. */
  directories: string[];
  /** Key NAMES from .env.example. Never values, never from .env. */
  envKeys: string[];
  /** Migration or schema filenames, if any. */
  migrations: string[];
  /**
   * Evidence of work already DONE, not just dependencies present.
   *
   * Without this, a mature repo gets a plan that tells it to build everything
   * it already has.
   */
  markers: {
    authWired: boolean;
    webhookRoutes: string[];
    webhookSignatureVerified: boolean;
    hasLegalPages: boolean;
    hasErrorMonitoring: boolean;
    hasRateLimit: boolean;
    hasSubscriptionModel: boolean;
    schemaModels: number;
    migrationCount: number;
    apiRoutes: number;
  };
  fileCount: number;
  hasGit: boolean;
  /**
   * The origin remote, normalised to `host/owner/repo`, or null.
   *
   * Read from `.git/config` on disk — no network call, no token, no API. It's
   * the only thing that lets a card name the actual repository instead of
   * saying "GitHub", and it costs nothing to know.
   */
  gitRemote: GitRemote | null;
  hasReadme: boolean;
  hasTests: boolean;
  /** Anything the scan refused to read, so the UI can be honest about gaps. */
  skipped: string[];
}

export interface GitRemote {
  /** "github.com", "gitlab.com", or whatever the remote actually points at. */
  host: string;
  owner: string;
  repo: string;
  /** Browsable URL, rebuilt from the parts — never the raw SSH string. */
  url: string;
}

/**
 * Parse a git remote URL into its parts.
 *
 * Handles the two forms a remote is actually written in: `git@host:owner/repo`
 * and `https://host/owner/repo`. Returns null rather than guessing, because a
 * card that names the wrong repository is worse than one that names none.
 *
 * Credentials in an https remote (`https://user:token@host/…`) are stripped and
 * never returned — people do commit those, and this scan must not surface one.
 */
export function parseGitRemote(raw: string): GitRemote | null {
  const trimmed = raw.trim().replace(/\.git$/, "");
  if (!trimmed) return null;

  const ssh = /^(?:ssh:\/\/)?(?:[^@/]+@)([^:/]+)[:/](.+?)\/([^/]+)$/.exec(
    trimmed,
  );
  const https = /^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)\/([^/]+)$/.exec(trimmed);
  const m = ssh ?? https;
  if (!m) return null;

  const [, host, owner, repo] = m;
  if (!host || !owner || !repo) return null;
  return { host, owner, repo, url: `https://${host}/${owner}/${repo}` };
}

export interface ScanError {
  error: string;
  hint?: string;
}

export type ScanResult = RepoDigest | ScanError;

export function isScanError(r: ScanResult): r is ScanError {
  return "error" in r;
}

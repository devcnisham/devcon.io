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
  hasReadme: boolean;
  hasTests: boolean;
  /** Anything the scan refused to read, so the UI can be honest about gaps. */
  skipped: string[];
}

export interface ScanError {
  error: string;
  hint?: string;
}

export type ScanResult = RepoDigest | ScanError;

export function isScanError(r: ScanResult): r is ScanError {
  return "error" in r;
}

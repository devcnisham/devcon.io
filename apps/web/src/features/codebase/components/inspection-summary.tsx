import { AlertTriangle, GitBranch } from "lucide-react";
import type {
  FileRole,
  InspectionSummary as Summary,
} from "@/features/codebase/lib/inspect";
import type { GitInfo } from "@/features/codebase/lib/git-info";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<FileRole, string> = {
  package: "Package files",
  config: "Configuration",
  env: "Environment",
  ci: "CI/CD",
  docker: "Docker",
  test: "Tests",
  database: "Database",
  docs: "Documentation",
  api: "APIs",
  route: "Routes",
  component: "Components",
  source: "Source code",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** What the project is made of, from the index alone. */
export function InspectionSummary({
  summary,
  git,
}: {
  summary: Summary;
  git?: GitInfo;
}) {
  const roles = (Object.entries(summary.counts) as Array<[FileRole, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">{summary.fileCount} files</span>
        <span className="text-muted-foreground">
          {formatBytes(summary.totalBytes)}
        </span>
        {git?.isRepository ? (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <GitBranch className="size-3.5" />
            {git.detached ? "detached HEAD" : git.branch}
            {git.remotes[0]?.repository
              ? ` · ${git.remotes[0].repository}`
              : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">not a git repository</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map(([role, count]) => (
          <div
            key={role}
            className="flex items-center justify-between rounded-lg border px-3 py-2"
          >
            <span className="text-sm">{ROLE_LABELS[role]}</span>
            <span className="text-sm font-semibold tabular-nums">{count}</span>
          </div>
        ))}
      </div>

      {summary.topLevelFolders.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Top-level folders
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summary.topLevelFolders.map((folder) => (
              <Badge key={folder} variant="outline">
                {folder}/
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {summary.topExtensions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Most common file types
          </p>
          <div className="flex flex-wrap gap-1.5">
            {summary.topExtensions.map(({ extension, count }) => (
              <Badge key={extension} variant="secondary">
                .{extension} · {count}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <ul className="flex flex-col gap-1.5 text-sm">
        {!summary.hasTests ? (
          <Observation>
            No tests found. Nothing currently verifies this project works.
          </Observation>
        ) : null}
        {!summary.hasCi ? (
          <Observation>
            No CI configuration. Nothing checks a change before it merges.
          </Observation>
        ) : null}
        {summary.missingEnvExample ? (
          <Observation>
            An environment file exists but there is no committed example, so a
            new contributor cannot tell which variables are required.
          </Observation>
        ) : null}
        {!summary.hasDocs ? (
          <Observation>No README or documentation found.</Observation>
        ) : null}
      </ul>

      {summary.hasEnvFile ? (
        <p className="text-muted-foreground text-xs">
          {summary.envFiles.length} environment file
          {summary.envFiles.length === 1 ? "" : "s"} detected by name. Their
          contents are never read.
        </p>
      ) : null}
    </div>
  );
}

function Observation({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-muted-foreground flex items-start gap-2">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

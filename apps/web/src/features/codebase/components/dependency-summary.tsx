import { AlertTriangle, HelpCircle } from "lucide-react";
import type { DependencyReport } from "@/features/codebase/lib/dependency-report";
import { Badge } from "@/components/ui/badge";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** What the project depends on — and what has not been checked. */
export function DependencySummary({ report }: { report: DependencyReport }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Direct" value={report.directCount} />
        <Stat label="Runtime" value={report.runtimeCount} />
        <Stat label="Development" value={report.devCount} />
        <Stat label="Transitive" value={report.transitiveCount ?? "unknown"} />
      </div>

      {report.hasLockfile ? (
        <p className="text-muted-foreground text-sm">
          {report.resolvedCount} packages resolved in total —{" "}
          {report.directCount} chosen by this project, {report.transitiveCount}{" "}
          pulled in by those.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          No lock file, so transitive dependencies cannot be counted. Committing
          one also makes installs reproducible.
        </p>
      )}

      {report.deprecated.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" />
            {report.deprecated.length} deprecated package
            {report.deprecated.length === 1 ? "" : "s"}
          </p>
          <ul className="flex flex-col gap-1.5">
            {report.deprecated.map((entry) => (
              <li key={entry.name} className="text-sm">
                <code className="font-mono">{entry.name}</code>
                <span className="text-muted-foreground"> — {entry.reason}</span>
                {entry.replacement ? (
                  <span className="text-muted-foreground">
                    . Use {entry.replacement}.
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        Two honesty statements. Neither may ever be rendered as "you are fine":
        the deprecation list is short by design, and vulnerabilities have not
        been looked at at all.
      */}
      <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
        <p className="flex items-start gap-1.5">
          <HelpCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Deprecation check covers a curated list of well-known retirements,
            not every package.
            {report.deprecated.length === 0
              ? " Nothing on that list is present — which is not the same as none being deprecated."
              : ""}
          </span>
        </p>
        <p className="flex items-start gap-1.5">
          <HelpCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <Badge variant="outline" className="mr-1 align-middle">
              not checked
            </Badge>
            Vulnerabilities have not been scanned. That needs a live advisory
            database, which would mean sending your dependency names to a third
            party — not done without asking.
          </span>
        </p>
      </div>
    </div>
  );
}

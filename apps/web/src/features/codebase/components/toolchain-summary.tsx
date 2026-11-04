import { AlertTriangle, Terminal } from "lucide-react";
import type {
  DetectedCommand,
  Toolchain,
} from "@/features/codebase/lib/toolchain";
import { Badge } from "@/components/ui/badge";

function CommandRow({
  label,
  command,
}: {
  label: string;
  command: DetectedCommand | null;
}) {
  if (!command) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="text-muted-foreground text-xs">not found</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-24 shrink-0 text-sm">
          {label}
        </span>
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">
          {command.command}
        </code>
        {/* A declared script is fact; a convention is an educated guess. */}
        <Badge variant={command.source === "script" ? "default" : "outline"}>
          {command.source === "script" ? "from the project" : "convention"}
        </Badge>
      </div>
      <span className="text-muted-foreground pl-24 text-xs">
        {command.from}
      </span>
    </div>
  );
}

/** How to install, build, and run this project. */
export function ToolchainSummary({ toolchain }: { toolchain: Toolchain }) {
  const { packageManager, runtimeConfig, commands } = toolchain;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Terminal className="text-muted-foreground size-4" />
        {packageManager ? (
          <>
            <span className="font-medium">{packageManager.name}</span>
            {packageManager.lockFile ? (
              <code className="text-muted-foreground font-mono text-xs">
                {packageManager.lockFile}
              </code>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">
            No package manager identified
          </span>
        )}
      </div>

      {packageManager?.conflict ? (
        <p className="text-destructive flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            More than one lock file is committed (
            {[packageManager.lockFile, ...packageManager.otherLockFiles]
              .filter(Boolean)
              .join(", ")}
            ). Contributors will install different dependency trees depending on
            which tool they run.
          </span>
        </p>
      ) : null}

      <div className="divide-border divide-y rounded-lg border px-3">
        <CommandRow label="Build" command={commands.build} />
        <CommandRow label="Develop" command={commands.dev} />
        <CommandRow label="Production" command={commands.production} />
      </div>

      {runtimeConfig.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">
            Runtime configuration:
          </span>
          {runtimeConfig.map((file) => (
            <Badge
              key={file}
              variant="secondary"
              className="font-mono text-[11px]"
            >
              {file}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

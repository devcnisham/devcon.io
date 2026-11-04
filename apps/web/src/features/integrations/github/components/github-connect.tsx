import { ShieldCheck } from "lucide-react";
import { GITHUB_SCOPES } from "@/features/integrations/github/lib/oauth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * The GitHub mark, inlined.
 *
 * lucide-react v1 removed brand icons, and a generic git glyph would not read
 * as "GitHub" on a connection card where the brand is the whole point.
 */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export type GitHubConnectionStatus =
  | { state: "unavailable"; reason: string }
  | { state: "disconnected" }
  | { state: "connected"; login: string; rateLimitRemaining?: number }
  | { state: "needs-reconnect"; reason: string };

/**
 * Connection state for the GitHub integration.
 *
 * "unavailable" is the honest state before an OAuth App exists — the button
 * would go nowhere, so it is not offered.
 */
export function GitHubConnect({
  status,
  onConnect,
}: {
  status: GitHubConnectionStatus;
  onConnect?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <GitHubMark className="size-5" />
        <div className="flex flex-col">
          <p className="text-sm font-medium">GitHub</p>
          <p className="text-muted-foreground text-xs">
            {status.state === "connected"
              ? `Connected as ${status.login}`
              : "Import a repository without copying it anywhere"}
          </p>
        </div>

        <div className="ml-auto">
          {status.state === "connected" ? (
            <Badge>Connected</Badge>
          ) : status.state === "needs-reconnect" ? (
            <Badge variant="destructive">Reconnect needed</Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>
      </div>

      {status.state === "unavailable" ? (
        <p className="text-muted-foreground text-sm">{status.reason}</p>
      ) : null}

      {status.state === "needs-reconnect" ? (
        <p className="text-destructive text-sm">{status.reason}</p>
      ) : null}

      {status.state === "connected" &&
      status.rateLimitRemaining !== undefined ? (
        <p className="text-muted-foreground text-xs">
          {status.rateLimitRemaining} API requests remaining this hour.
        </p>
      ) : null}

      <div className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        <span>
          devstep asks for {GITHUB_SCOPES.join(" and ")} only — read access. It
          never requests permission to write to your code, and repositories are
          read over the API rather than cloned to a server.
        </span>
      </div>

      {status.state === "disconnected" || status.state === "needs-reconnect" ? (
        <div>
          <Button onClick={onConnect}>
            <GitHubMark className="size-4" />
            Connect GitHub
          </Button>
        </div>
      ) : null}
    </div>
  );
}

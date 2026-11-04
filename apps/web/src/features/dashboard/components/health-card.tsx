import type { HealthBand, HealthResult } from "@/features/dashboard/lib/health";
import { DashboardPanel } from "./dashboard-panel";
import { cn } from "@/lib/utils";

const BAND_LABELS: Record<HealthBand, string> = {
  healthy: "Healthy",
  fair: "Fair",
  "at-risk": "At risk",
  critical: "Critical",
};

const BAND_TONE: Record<HealthBand, string> = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  "at-risk": "text-orange-600 dark:text-orange-400",
  critical: "text-destructive",
};

/**
 * A score alone prompts "so what?" — every deduction is listed with the worst
 * first, so the number turns into a to-do list.
 */
export function HealthCard({ health }: { health: HealthResult | null }) {
  if (!health) {
    return (
      <DashboardPanel
        title="Health"
        empty="Not enough data yet. Connect a repository so devstep can check tests, dependencies, and deploys."
      />
    );
  }

  return (
    <DashboardPanel title="Health">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">
          {health.score}
        </span>
        <span className="text-muted-foreground text-sm">/ 100</span>
        <span
          className={cn("ml-auto text-sm font-medium", BAND_TONE[health.band])}
        >
          {BAND_LABELS[health.band]}
        </span>
      </div>

      {health.reasons.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing needs attention.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {health.reasons.map((reason) => (
            <li key={reason.label} className="flex flex-col">
              <span className="text-sm font-medium">{reason.label}</span>
              <span className="text-muted-foreground text-xs">
                {reason.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

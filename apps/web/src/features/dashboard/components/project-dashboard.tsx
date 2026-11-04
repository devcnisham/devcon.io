import Link from "next/link";
import {
  projectHealth,
  type HealthSignals,
} from "@/features/dashboard/lib/health";
import { nextAction } from "@/features/dashboard/lib/next-action";
import {
  currentPhase,
  overallProgress,
  phaseProgress,
  type Phase,
} from "@/features/dashboard/lib/progress";
import { DashboardPanel } from "./dashboard-panel";
import { HealthCard } from "./health-card";
import { NextActionCard } from "./next-action-card";
import { Badge } from "@/components/ui/badge";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from "@/components/ui/progress";

export type ProjectSummary = {
  name: string;
  type: string;
  status: string;
  technologies: string[];
};

export type DashboardData = {
  project: ProjectSummary;
  phases: Phase[];
  /** Null until a repository is connected — no signals means no score. */
  healthSignals: HealthSignals | null;
  hasRepository: boolean;
  hasDeployed: boolean;
  featureCounts: {
    shipped: number;
    inProgress: number;
    planned: number;
  } | null;
  integrations: Array<{ name: string; connected: boolean }>;
  latestDeployment: {
    environment: string;
    status: string;
    when: string;
  } | null;
  openIssues: number | null;
  recentChanges: Array<{ id: string; message: string; when: string }>;
};

/**
 * The project dashboard.
 *
 * Panels render what is actually known. With no repository connected that is
 * mostly nothing — and saying so is the correct answer, not a failure. The
 * next-action card still works, because "connect a repository" is exactly what
 * such a project needs.
 */
export function ProjectDashboard({ data }: { data: DashboardData }) {
  const progress = overallProgress(data.phases);
  const phase = currentPhase(data.phases);
  const health = data.healthSignals ? projectHealth(data.healthSignals) : null;

  const action = nextAction({
    phases: data.phases,
    health: data.healthSignals ?? {
      hasTests: false,
      testsPassing: false,
      ciConfigured: false,
      lastDeploySucceeded: false,
      outdatedDependencies: 0,
      criticalVulnerabilities: 0,
      openIssues: 0,
      daysSinceLastCommit: 0,
    },
    hasRepository: data.hasRepository,
    hasDeployed: data.hasDeployed,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.project.name}
        </h1>
        <Badge variant="outline">{data.project.type}</Badge>
        <Badge variant="secondary">{data.project.status}</Badge>
        <div className="text-muted-foreground ml-auto flex flex-wrap gap-1 text-xs">
          {data.project.technologies.length > 0
            ? data.project.technologies.join(" · ")
            : "No stack recorded"}
        </div>
      </header>

      <NextActionCard action={action} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardPanel title="Progress">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {progress}%
            </span>
            <span className="text-muted-foreground text-sm">complete</span>
          </div>
          <Progress value={progress}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <p className="text-muted-foreground text-sm">
            {phase
              ? `Current phase: ${phase.name} (${phaseProgress(phase)}%)`
              : data.phases.length === 0
                ? "No roadmap yet."
                : "Everything planned is done."}
          </p>
        </DashboardPanel>

        <HealthCard health={health} />

        <DashboardPanel
          title="Roadmap"
          action="Open"
          actionHref="/projects"
          empty={
            data.phases.length === 0
              ? "No phases yet. A roadmap is generated once devstep can read the project."
              : undefined
          }
        >
          <ul className="flex flex-col gap-2">
            {data.phases.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="flex-1 truncate text-sm">{item.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {phaseProgress(item)}%
                </span>
              </li>
            ))}
          </ul>
        </DashboardPanel>

        <DashboardPanel
          title="Features"
          empty={data.featureCounts ? undefined : "No features tracked yet."}
        >
          {data.featureCounts ? (
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {(
                [
                  ["Shipped", data.featureCounts.shipped],
                  ["In progress", data.featureCounts.inProgress],
                  ["Planned", data.featureCounts.planned],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          title="Integrations"
          action="Manage"
          actionHref="/settings/project"
          empty={
            data.integrations.length === 0
              ? "Nothing connected yet."
              : undefined
          }
        >
          <ul className="flex flex-col gap-2">
            {data.integrations.map((integration) => (
              <li
                key={integration.name}
                className="flex items-center justify-between text-sm"
              >
                <span>{integration.name}</span>
                <Badge variant={integration.connected ? "default" : "outline"}>
                  {integration.connected ? "Connected" : "Not connected"}
                </Badge>
              </li>
            ))}
          </ul>
        </DashboardPanel>

        <DashboardPanel
          title="Deployments"
          empty={
            data.latestDeployment ? undefined : "Nothing has been deployed yet."
          }
        >
          {data.latestDeployment ? (
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                {data.latestDeployment.environment}
              </span>
              <span className="text-muted-foreground text-xs">
                {data.latestDeployment.status} · {data.latestDeployment.when}
              </span>
            </div>
          ) : null}
        </DashboardPanel>

        <DashboardPanel
          title="Issues"
          empty={
            data.openIssues === null ? "No issue source connected." : undefined
          }
        >
          <p className="text-3xl font-semibold tabular-nums">
            {data.openIssues}
          </p>
          <p className="text-muted-foreground text-sm">open</p>
        </DashboardPanel>

        <DashboardPanel
          title="Recent changes"
          empty={
            data.recentChanges.length === 0
              ? "No commits yet. Connect a repository to see changes here."
              : undefined
          }
        >
          <ul className="flex flex-col gap-2">
            {data.recentChanges.map((change) => (
              <li key={change.id} className="flex flex-col">
                <span className="truncate text-sm">{change.message}</span>
                <span className="text-muted-foreground text-xs">
                  {change.when}
                </span>
              </li>
            ))}
          </ul>
        </DashboardPanel>

        <DashboardPanel
          title="Activity"
          action="Open"
          actionHref="/activity"
          empty="No activity recorded yet."
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Panels stay empty until a project is stored and a repository connected —{" "}
        <Link href="/projects/new" className="underline underline-offset-4">
          create a project
        </Link>{" "}
        to get started.
      </p>
    </div>
  );
}

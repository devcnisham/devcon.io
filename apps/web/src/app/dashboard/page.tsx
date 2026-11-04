import type { Metadata } from "next";
import { ProjectDashboard, type DashboardData } from "@/features/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Nothing is stored yet, so every panel receives its genuinely-empty value
 * rather than invented numbers. The next-action card still works: a project
 * with no repository needs a repository, and that is what it says.
 */
const EMPTY: DashboardData = {
  project: {
    name: "Your project",
    type: "Not set",
    status: "Not started",
    technologies: [],
  },
  phases: [],
  healthSignals: null,
  hasRepository: false,
  hasDeployed: false,
  featureCounts: null,
  integrations: [],
  latestDeployment: null,
  openIssues: null,
  recentChanges: [],
};

export default function DashboardPage() {
  return <ProjectDashboard data={EMPTY} />;
}

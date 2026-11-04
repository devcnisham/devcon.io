import type { Metadata } from "next";
import Link from "next/link";
import { ProjectSettingsForm } from "@/features/project/components/project-settings-form";
import { getSession } from "@/features/auth/server";
import {
  findCurrentProject,
  projectService,
} from "@/lib/server/stores/project-store";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "Project settings",
};

function PageHeader() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        Project settings
      </h1>
      <p className="text-muted-foreground text-sm">
        Name, type, visibility, status, and stack.
      </p>
    </div>
  );
}

export default async function ProjectSettingsPage() {
  const session = await getSession();

  // No session only happens in dev (the settings layout's requireSession is
  // a no-op until AUTH_ENABLED) — treat it like no project.
  if (!session) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <PageHeader />
        <Empty>
          <EmptyTitle>No project selected</EmptyTitle>
          <EmptyDescription>
            Create a project to manage its settings here.
          </EmptyDescription>
          <Button nativeButton={false} render={<Link href="/projects/new" />}>
            Create a project
          </Button>
        </Empty>
      </div>
    );
  }

  // Project resolution is partial: there is no route-level selection yet, so
  // the page loads the most recently created project in a workspace the user
  // belongs to. Task 11 replaces this with real selection.
  const current = await findCurrentProject(session.user.id);

  if (!current) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <PageHeader />
        <Empty>
          <EmptyTitle>No project selected</EmptyTitle>
          <EmptyDescription>
            Create a project to manage its settings here.
          </EmptyDescription>
          <Button nativeButton={false} render={<Link href="/projects/new" />}>
            Create a project
          </Button>
        </Empty>
      </div>
    );
  }

  const result = await projectService.getProjectSettings(
    current.id,
    session.user.id
  );

  if (!result.ok || !result.data) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <PageHeader />
        <Empty>
          <EmptyTitle>Project unavailable</EmptyTitle>
          <EmptyDescription>
            {result.ok ? "" : result.message}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader />
      {/* The stack is collected in the wizard but not persisted yet — the
          projects table has no technologies column until a later wave. */}
      <ProjectSettingsForm
        projectId={current.id}
        defaults={result.data}
        technologies={[]}
      />
    </div>
  );
}

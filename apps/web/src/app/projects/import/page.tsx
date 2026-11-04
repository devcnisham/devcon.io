import type { Metadata } from "next";
import Link from "next/link";
import { ImportProject } from "@/features/codebase";
import { getSession } from "@/features/auth/server";
import { findCurrentProject } from "@/lib/server/stores/project-store";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "Import a project",
};

function PageHeader() {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        Import a local project
      </h1>
      <p className="text-muted-foreground text-sm">
        Point devstep at a folder on this machine. It reads the files to work
        out what the project is built with.
      </p>
    </div>
  );
}

export default async function ImportProjectPage() {
  const session = await getSession();

  // Session guards are live: middleware and the projects layout's
  // requireSession redirect unsigned visitors, so no session here is only an
  // edge case (e.g. expiry mid-request) — treat it like no project.
  // Project resolution is partial: there is no route-level selection yet, so
  // the import attaches to the most recently created project. Route-level
  // selection is remaining work (see docs/blocker.md).
  const current = session ? await findCurrentProject(session.user.id) : null;

  if (!current) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <PageHeader />
        <Empty>
          <EmptyTitle>No project selected</EmptyTitle>
          <EmptyDescription>
            Create a project first — an import needs a project to attach to.
          </EmptyDescription>
          <Button nativeButton={false} render={<Link href="/projects/new" />}>
            Create a project
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader />
      <ImportProject projectId={current.id} />
    </div>
  );
}

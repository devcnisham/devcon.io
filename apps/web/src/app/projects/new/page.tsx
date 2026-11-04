import type { Metadata } from "next";
import Link from "next/link";
import { ProjectWizard } from "@/features/project";
import { getSession } from "@/features/auth/server";
import { findWorkspacesForUser } from "@/lib/server/stores/workspace-store";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "New project",
};

export default async function NewProjectPage() {
  // A project lives inside a workspace; the wizard saves into the user's
  // first one. Workspace selection UI arrives with the projects-list read
  // path (Task 11), so this is the honest default for now.
  const session = await getSession();
  const workspace = session
    ? (await findWorkspacesForUser(session.user.id))[0]
    : undefined;

  if (!workspace) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Empty>
          <EmptyTitle>Create a workspace first</EmptyTitle>
          <EmptyDescription>
            Projects live inside a workspace. Create one to start your first
            project.
          </EmptyDescription>
          <Button nativeButton={false} render={<Link href="/workspaces/new" />}>
            Create a workspace
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <ProjectWizard workspaceId={workspace.id} />
    </div>
  );
}

import type { Metadata } from "next";
import { ActivityFeed } from "@/features/workspace";
import { getSession } from "@/features/auth/server";
import { findWorkspacesForUser } from "@/lib/server/stores/workspace-store";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "Activity",
};

export default async function ActivityPage() {
  // Same resolution the project wizard uses: activity belongs to a workspace,
  // and workspace selection UI arrives with the projects-list read path, so
  // the user's first workspace is the honest default for now. A user with no
  // workspace (or no session) keeps the empty state.
  const session = await getSession();
  const workspace = session
    ? (await findWorkspacesForUser(session.user.id))[0]
    : undefined;

  if (!workspace) {
    return (
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-muted-foreground text-sm">
            What has happened across this workspace.
          </p>
        </div>
        <Empty>
          <EmptyTitle>Create a workspace first</EmptyTitle>
          <EmptyDescription>
            Activity is recorded per workspace. Create one to start seeing
            events here.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">
          What has happened across this workspace.
        </p>
      </div>
      <ActivityFeed workspaceId={workspace.id} />
    </div>
  );
}

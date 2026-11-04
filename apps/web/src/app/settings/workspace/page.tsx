import type { Metadata } from "next";
import { DeleteWorkspace, RenameWorkspaceForm } from "@/features/workspace";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Workspace settings",
};

// Placeholder until workspaces are stored and resolved from the session.
const PLACEHOLDER_WORKSPACE_NAME = "My workspace";
const PLACEHOLDER_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export default function WorkspaceSettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Workspace settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Name and lifecycle for this workspace.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">General</h2>
        <RenameWorkspaceForm
          currentName={PLACEHOLDER_WORKSPACE_NAME}
          workspaceId={PLACEHOLDER_WORKSPACE_ID}
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h2 className="text-destructive text-sm font-medium">Danger zone</h2>
        <DeleteWorkspace
          workspaceName={PLACEHOLDER_WORKSPACE_NAME}
          workspaceId={PLACEHOLDER_WORKSPACE_ID}
        />
      </section>
    </div>
  );
}

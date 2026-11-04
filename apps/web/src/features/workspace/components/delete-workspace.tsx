"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { AuthAlert } from "@/features/auth";
import { deleteWorkspaceAction } from "@/features/workspace/lib/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/**
 * Destructive action, gated behind retyping the exact workspace name.
 * Deletion is a soft delete — the workspace row is marked deleted and its
 * activity records are kept for the feed.
 */
export function DeleteWorkspace({
  workspaceName,
  workspaceId,
}: {
  workspaceName: string;
  workspaceId: string;
}) {
  const [confirmation, setConfirmation] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleted, setDeleted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const matches = confirmation === workspaceName;

  async function onDelete() {
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await deleteWorkspaceAction({ workspaceId, confirmation });
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setDeleted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-destructive/40 flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Delete this workspace</p>
          <p className="text-muted-foreground text-sm">
            Every project, roadmap, and activity record in it is removed. This
            cannot be undone.
          </p>
        </div>
      </div>

      {formError ? <AuthAlert variant="error" message={formError} /> : null}
      {deleted ? (
        <AuthAlert variant="success" message="Workspace deleted" />
      ) : null}

      <Field>
        <FieldLabel htmlFor="confirm-delete">
          Type <span className="font-mono">{workspaceName}</span> to confirm
        </FieldLabel>
        <Input
          id="confirm-delete"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          disabled={submitting}
        />
        <FieldDescription>
          Deletion is permanent — the workspace name is required to confirm.
        </FieldDescription>
      </Field>

      <div>
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={!matches || submitting}
          aria-busy={submitting}
        >
          {submitting ? <Spinner /> : null}
          {submitting ? "Deleting…" : "Delete workspace"}
        </Button>
      </div>
    </div>
  );
}

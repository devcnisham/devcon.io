"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthAlert } from "@/features/auth";
import { renameWorkspaceAction } from "@/features/workspace/lib/actions";
import {
  renameWorkspaceSchema,
  type RenameWorkspaceValues,
} from "@/features/workspace/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function RenameWorkspaceForm({
  currentName,
  workspaceId,
}: {
  currentName: string;
  workspaceId: string;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RenameWorkspaceValues>({
    resolver: zodResolver(renameWorkspaceSchema),
    defaultValues: { name: currentName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = await renameWorkspaceAction({
      workspaceId,
      name: values.name,
    });
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    reset({ name: values.name });
    setSaved(true);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <AuthAlert variant="error" message={formError} /> : null}
      {saved ? (
        <AuthAlert variant="success" message="Workspace name saved" />
      ) : null}

      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
          <Input
            id="workspace-name"
            aria-invalid={!!errors.name}
            disabled={isSubmitting}
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>
      </FieldGroup>

      <div>
        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? <Spinner /> : null}
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

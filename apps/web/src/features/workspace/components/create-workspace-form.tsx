"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthAlert } from "@/features/auth";
import { createWorkspaceAction } from "@/features/workspace/lib/actions";
import {
  createWorkspaceSchema,
  type CreateWorkspaceValues,
} from "@/features/workspace/lib/schemas";
import { toSlug } from "@/features/workspace/lib/slug";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function CreateWorkspaceForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState(false);
  const [slugEdited, setSlugEdited] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "", slug: "" },
  });

  const name = useWatch({ control, name: "name" });

  // The slug follows the name until the user edits it, then it stops moving —
  // otherwise a deliberate slug would be silently overwritten.
  React.useEffect(() => {
    if (slugEdited) return;
    setValue("slug", toSlug(name ?? ""), { shouldValidate: false });
  }, [name, slugEdited, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setCreated(false);
    const result = await createWorkspaceAction(values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    reset();
    setSlugEdited(false);
    setCreated(true);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? <AuthAlert variant="error" message={formError} /> : null}
      {created ? (
        <AuthAlert variant="success" message="Workspace created" />
      ) : null}

      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Workspace name</FieldLabel>
          <Input
            id="name"
            placeholder="Acme"
            autoComplete="organization"
            aria-invalid={!!errors.name}
            disabled={isSubmitting}
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.slug}>
          <FieldLabel htmlFor="slug">URL slug</FieldLabel>
          <Input
            id="slug"
            placeholder="acme"
            aria-invalid={!!errors.slug}
            disabled={isSubmitting}
            {...register("slug", {
              onChange: () => setSlugEdited(true),
            })}
          />
          <FieldDescription>
            Lowercase letters, numbers, and hyphens. Follows the name until you
            edit it.
          </FieldDescription>
          <FieldError errors={[errors.slug]} />
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? <Spinner /> : null}
        {isSubmitting ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}

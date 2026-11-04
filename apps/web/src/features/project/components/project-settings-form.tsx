"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthAlert } from "@/features/auth";
import { updateProjectSettingsAction } from "@/features/project/lib/actions";
import { TechnologyPicker } from "@/features/project/components/technology-picker";
import {
  projectSettingsSchema,
  type ProjectSettingsValues,
} from "@/features/project/lib/schemas";
import {
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
} from "@/features/project/lib/wizard";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_VISIBILITY_LABELS,
} from "@/features/project/types";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export function ProjectSettingsForm({
  projectId,
  defaults,
  technologies: initialTechnologies,
}: {
  projectId: string;
  defaults: ProjectSettingsValues;
  technologies: string[];
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [technologies, setTechnologies] = React.useState(initialTechnologies);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjectSettingsValues>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = await updateProjectSettingsAction({ projectId, ...values });
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setSaved(true);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? <AuthAlert variant="error" message={formError} /> : null}
      {saved ? (
        <AuthAlert variant="success" message="Project settings saved" />
      ) : null}

      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Project name</FieldLabel>
          <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea id="description" rows={3} {...register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="type">Project type</FieldLabel>
          <NativeSelect id="type" {...register("type")}>
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROJECT_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="visibility">Visibility</FieldLabel>
          <NativeSelect id="visibility" {...register("visibility")}>
            {(["private", "workspace"] as const).map((value) => (
              <option key={value} value={value}>
                {PROJECT_VISIBILITY_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <NativeSelect id="status" {...register("status")}>
            {(["active", "paused", "archived"] as const).map((value) => (
              <option key={value} value={value}>
                {PROJECT_STATUS_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
          <FieldDescription>
            Archived projects stay readable but stop appearing in the sidebar.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Technologies</p>
        <TechnologyPicker selected={technologies} onChange={setTechnologies} />
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

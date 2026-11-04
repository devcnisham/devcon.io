import { z } from "zod";
import { DESCRIPTION_MAX, NAME_MAX, NAME_MIN, PROJECT_TYPES } from "./wizard";

/** Validation for project forms, shared with the wizard's step rules. */

export const projectNameSchema = z
  .string()
  .trim()
  .min(NAME_MIN, `Project name must be at least ${NAME_MIN} characters`)
  .max(NAME_MAX, `Project name must be ${NAME_MAX} characters or fewer`);

export const projectDescriptionSchema = z
  .string()
  .trim()
  .max(
    DESCRIPTION_MAX,
    `Description must be ${DESCRIPTION_MAX} characters or fewer`
  );

export const projectSettingsSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  type: z.enum(PROJECT_TYPES),
  visibility: z.enum(["private", "workspace"]),
  status: z.enum(["active", "paused", "archived"]),
});

export type ProjectSettingsValues = z.infer<typeof projectSettingsSchema>;

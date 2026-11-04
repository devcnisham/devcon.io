import { z } from "zod";
import { isReservedSlug } from "./slug";

/** Validation for workspace forms. Shared by the client and, later, the server. */

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Workspace name must be at least 2 characters")
  .max(60, "Workspace name must be 60 characters or fewer");

export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(48, "Slug must be 48 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens"
  )
  .refine((slug) => !isReservedSlug(slug), {
    message: "That slug is reserved — pick another",
  });

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  slug: workspaceSlugSchema,
});

export const renameWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

/**
 * Deleting a workspace requires retyping its name. This validates shape only —
 * the server compares the confirmation against the workspace's real name, and
 * that check's message lives in the service (single source of truth).
 */
export const deleteWorkspaceSchema = z.object({
  confirmation: z.string().trim().min(1),
});

export type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>;
export type RenameWorkspaceValues = z.infer<typeof renameWorkspaceSchema>;

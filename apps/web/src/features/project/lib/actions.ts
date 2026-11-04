"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/server";
import { projectSettingsSchema } from "@/features/project/lib/schemas";
import type { ProjectActionResult } from "@/features/project/server/project-service";
import { projectService } from "@/lib/server/stores/project-store";

async function userIdOrFail(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };
  return { userId: session.user.id };
}

export async function createProjectAction(values: {
  workspaceId: string;
  name: string;
  description: string;
  type: string;
  visibility: string;
  status: string;
}): Promise<ProjectActionResult<{ id: string; slug: string }>> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  // Server-side shape check — the wizard already enforced the same rules.
  const parsed = projectSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const result = await projectService.createProject(
      { workspaceId: values.workspaceId, ...parsed.data },
      who.userId
    );
    if (result.ok) revalidatePath("/projects");
    return result;
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

export async function updateProjectSettingsAction(values: {
  projectId: string;
  name: string;
  description: string;
  type: string;
  visibility: string;
  status: string;
}): Promise<ProjectActionResult> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  const parsed = projectSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  try {
    const result = await projectService.updateProjectSettings(
      { projectId: values.projectId, ...parsed.data },
      who.userId
    );
    if (result.ok) revalidatePath("/settings/project");
    return result;
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

"use server";

import {
  createWorkspaceSchema,
  deleteWorkspaceSchema,
  renameWorkspaceSchema,
} from "@/features/workspace/lib/schemas";
import {
  findWorkspaceEvents,
  workspaceService,
} from "@/lib/server/stores/workspace-store";
import type { ActivityEvent } from "@/features/workspace/types";
import { getSession } from "@/features/auth/server";
import { revalidatePath } from "next/cache";

export type WorkspaceActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

async function userIdOrFail(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };
  return { userId: session.user.id };
}

export async function createWorkspaceAction(
  values: { name: string; slug: string }
): Promise<WorkspaceActionResult<{ id: string; slug: string }>> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  const parsed = createWorkspaceSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await workspaceService.createWorkspace(
      parsed.data,
      who.userId
    );
    if (result.ok) revalidatePath("/workspaces");
    return result;
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

export async function renameWorkspaceAction(
  values: { workspaceId: string; name: string }
): Promise<WorkspaceActionResult> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  const parsed = renameWorkspaceSchema.safeParse({ name: values.name });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await workspaceService.renameWorkspace(
      { workspaceId: values.workspaceId, name: parsed.data.name },
      who.userId
    );
    if (result.ok) revalidatePath("/workspaces");
    return result;
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

export async function deleteWorkspaceAction(
  values: { workspaceId: string; confirmation: string }
): Promise<WorkspaceActionResult> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  // Shape check only — the service compares the confirmation against the
  // workspace's real name (the retype gate and its message live there).
  const parsed = deleteWorkspaceSchema.safeParse({
    confirmation: values.confirmation,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const result = await workspaceService.deleteWorkspace(values, who.userId);
    if (result.ok) revalidatePath("/workspaces");
    return result;
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

/**
 * The activity feed's data source. Session-checked like every other action;
 * the feed only resolves for the member's own workspace view (the page that
 * passes a workspaceId resolves it from the session).
 */
export async function loadWorkspaceActivityAction(
  workspaceId: string
): Promise<WorkspaceActionResult<ActivityEvent[]>> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  try {
    return { ok: true, data: await findWorkspaceEvents(workspaceId) };
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/server";
import { codebaseService } from "@/lib/server/stores/codebase-store";
import type {
  CodebaseActionResult,
  SaveAnalysisInput,
} from "@/features/codebase/server/codebase-service";

async function userIdOrFail(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };
  return { userId: session.user.id };
}

export async function saveImportAction(
  input: SaveAnalysisInput
): Promise<CodebaseActionResult<{ codebaseId: string }>> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  try {
    const result = await codebaseService.saveAnalysis(input, who.userId);
    if (result.ok) revalidatePath("/projects/import");
    return result;
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

export async function loadLatestImportAction(
  projectId: string
): Promise<CodebaseActionResult<unknown | null>> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  try {
    return await codebaseService.loadLatest(projectId, who.userId);
  } catch {
    return { ok: false, message: "Something went wrong. Try again." };
  }
}

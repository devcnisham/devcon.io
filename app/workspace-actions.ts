"use server";

import { redirect } from "next/navigation";
import {
  createWorkspace,
  renameWorkspace,
  setActiveWorkspace,
} from "@/lib/workspace.ts";
import { currentUser } from "./current-user";
import { currentWorkspace } from "./current-workspace";

/**
 * Creating, renaming and switching workspaces.
 *
 * Every one of these takes the owner from the session rather than from the
 * form. A workspace id in a hidden field is a request, not a permission — and
 * `renameWorkspace` looks up by id **and** owner together, so a stranger's id
 * is indistinguishable from one that does not exist.
 */

const back = (params: Record<string, string>) =>
  redirect(`/settings?${new URLSearchParams(params)}`);

export async function createMyWorkspace(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const made = await createWorkspace(
    user.id,
    String(formData.get("name") ?? ""),
  );
  if (!made.ok) return back({ error: made.error });

  // Switched to on creation. Making a workspace you then have to go and find is
  // a step with nothing behind it.
  await setActiveWorkspace(user.id, made.workspace.id);
  return back({ saved: "created" });
}

export async function renameMyWorkspace(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const workspace = await currentWorkspace();
  if (!workspace) redirect("/login");

  const renamed = await renameWorkspace(
    user.id,
    workspace.id,
    String(formData.get("name") ?? ""),
  );
  if (!renamed.ok) return back({ error: renamed.error });
  return back({ saved: "renamed" });
}

export async function switchMyWorkspace(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  // Not validated against the owner here on purpose: `activeWorkspace` only
  // ever returns a workspace this account owns, so pointing the preference at
  // someone else's id resolves to your own default rather than to theirs.
  if (id) await setActiveWorkspace(user.id, id);
  return back({ saved: "switched" });
}

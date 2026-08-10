"use server";

import { redirect } from "next/navigation";
import type { Layout } from "@/lib/canvas.ts";
import { saveLayout } from "@/lib/canvas.ts";
import { cloneRepo } from "@/lib/clone.ts";
import { pickFolder } from "@/lib/pick-folder.ts";
import {
  addWorkspace,
  clearActiveIf,
  removeWorkspace,
  setActive,
  validatePath,
} from "@/lib/workspaces.ts";

/**
 * The writes the dashboard makes.
 *
 * Server actions rather than `GET` forms, because every one of these changes
 * state and a GET that mutates is wrong the first time something prefetches it.
 * None of them touches a project's own files — devcon writes one list of paths
 * under `~/.devcon`, and clone writes the folder you asked it to.
 *
 * Failures come back through the URL instead of being thrown, so the page can
 * say what went wrong without a client component to hold the state.
 */

const back = (params: Record<string, string>) =>
  redirect(`/?${new URLSearchParams(params)}`);

/** Opens a real Finder window on the machine running the server — your Mac. */
export async function openFolderDialog() {
  const picked = await pickFolder();

  if (!picked.ok) {
    // Cancelling is a normal outcome and must not look like a failure.
    if (picked.reason === "cancelled") redirect("/");
    return back({ pick: picked.reason });
  }

  const valid = await validatePath(picked.path);
  if (!valid.ok) return back({ error: valid.error, path: picked.path });

  await addWorkspace(valid.path);
  return back({ added: valid.path });
}

/** The typed-path fallback. Also the only route on anything that is not a Mac. */
export async function importWorkspace(formData: FormData) {
  const raw = String(formData.get("path") ?? "");
  const valid = await validatePath(raw);

  if (!valid.ok) return back({ error: valid.error, path: raw.trim() });

  await addWorkspace(valid.path);
  return back({ added: valid.path });
}

export async function cloneWorkspace(formData: FormData) {
  const url = String(formData.get("url") ?? "");
  const result = await cloneRepo(url);

  if (!result.ok) return back({ clone: result.error, url: url.trim() });

  await addWorkspace(result.path);
  return back({ added: result.path });
}

/** Clicking a project card: make it the open one, then go to the work page. */
export async function openWorkspace(formData: FormData) {
  const raw = String(formData.get("path") ?? "");
  const valid = await validatePath(raw);

  // A folder that has gone missing sends you back with the reason rather than
  // opening a work page for something that is not there.
  if (!valid.ok) return back({ error: valid.error, path: raw });

  await addWorkspace(valid.path);
  await setActive(valid.path);
  redirect("/work");
}

export async function forgetWorkspace(formData: FormData) {
  const path = String(formData.get("path") ?? "");
  if (path) {
    await removeWorkspace(path);
    // Otherwise the work page would keep naming a project the list forgot.
    await clearActiveIf(path);
  }
  redirect("/");
}

/**
 * Where the canvas cards sit.
 *
 * The project path comes from the server, never from the client — a layout
 * write that trusted a path from the page could be pointed anywhere.
 */
export async function saveCanvasLayout(projectPath: string, layout: Layout) {
  await saveLayout(projectPath, layout);
}

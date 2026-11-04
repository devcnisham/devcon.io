import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import { env } from "@/lib/env";
import { fileDb as sql } from "./db";
export class FileError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}
export type FileActor = { userId: string; projectId: string; canEdit: boolean };
export function uuid(value: unknown): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new FileError(400, "Invalid identifier.");
  return parsed.data;
}
export async function authorizeProject(
  projectId: string,
  write = false
): Promise<FileActor> {
  if (env.FILE_WORKSPACE_ENABLED !== "true")
    throw new FileError(404, "File workspace is not enabled.");
  uuid(projectId);
  const client = await createSupabaseServerClient();
  // Always revalidate with Auth; never authorize with unverified cookie claims.
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !data.user.email_confirmed_at)
    throw new FileError(401, "Sign in to use project files.");
  const [membership] =
    await sql`select wm.role from projects p join workspaces w on w.id=p.workspace_id join workspace_members wm on wm.workspace_id=p.workspace_id where p.id=${projectId} and wm.user_id=${data.user.id} and p.deleted_at is null and w.deleted_at is null`;
  if (
    !membership ||
    !["owner", "admin", "member", "viewer"].includes(membership.role)
  )
    throw new FileError(404, "Project not found.");
  const canEdit = ["owner", "admin", "member"].includes(membership.role);
  if (write && !canEdit)
    throw new FileError(
      403,
      "Your workspace role can view files but cannot change them."
    );
  return { userId: data.user.id, projectId, canEdit };
}
export function assertOrigin(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new FileError(403, "Open this action from DevCon.");
}
export async function boundedBody(
  request: Request,
  limit: number
): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new FileError(413, "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new FileError(413, "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function jsonBody(request: Request): Promise<unknown> {
  const text = new TextDecoder().decode(await boundedBody(request, 9_000_000));
  try {
    return JSON.parse(text);
  } catch {
    throw new FileError(400, "Send a valid JSON request.");
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof FileError)
    return Response.json(
      { error: error.message, ...error.details },
      { status: error.status }
    );
  if (error instanceof z.ZodError)
    return Response.json(
      { error: "Some file data is invalid. Check the content and try again." },
      { status: 400 }
    );
  console.error("files.operation.failed", {
    type: error instanceof Error ? error.name : "unknown",
  });
  return Response.json(
    { error: "The operation could not finish. Try again." },
    { status: 500 }
  );
}

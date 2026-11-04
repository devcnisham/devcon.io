import "server-only";
import { randomUUID } from "node:crypto";
import { fileDb as sql, dbJson } from "./db";
import { FileError, uuid, type FileActor } from "./access";
import { fileStorage, signedFile } from "./storage";
import {
  emptyContent,
  validateContent,
  mergeRevision,
  nameSchema,
} from "@/features/files/lib/content";
import type {
  FileContent,
  FileKind,
  FileRevision,
  WorkspaceFile,
  FileJob,
  FileMessage,
} from "@/features/files/types";
// Postgres rows are projected into client-safe types by these serializers.
function file(row: Record<string, unknown>): WorkspaceFile {
  return {
    ...row,
    updatedAt: new Date(row.updatedAt as string).toISOString(),
  } as WorkspaceFile;
}
function revision(row: Record<string, unknown>): FileRevision {
  return {
    ...row,
    createdAt: new Date(row.createdAt as string).toISOString(),
  } as FileRevision;
}
export async function requireFile(actor: FileActor, id: string) {
  uuid(id);
  const [row] =
    await sql`select * from workspace_files where id=${id} and project_id=${actor.projectId} and deleted_at is null`;
  if (!row) throw new FileError(404, "File not found.");
  return file(row);
}
export async function getRevision(
  actor: FileActor,
  fileId: string,
  revisionId: string
) {
  uuid(revisionId);
  await requireFile(actor, fileId);
  const [row] =
    await sql`select * from file_revisions where id=${revisionId} and file_id=${fileId}`;
  if (!row) throw new FileError(404, "Revision not found.");
  return revision(row);
}
export async function listFiles(actor: FileActor) {
  const rows =
    await sql`select * from workspace_files where project_id=${actor.projectId} and deleted_at is null order by updated_at desc limit 200`;
  return rows.map(file);
}
export async function readFile(actor: FileActor, id: string) {
  const f = await requireFile(actor, id);
  const rows =
    await sql`select * from file_revisions where file_id=${id} order by created_at desc limit 100`;
  const current = await getRevision(actor, id, f.currentRevisionId);
  return {
    file: f,
    revision: current,
    revisions: rows.map(revision),
    originalUrl: f.originalPath ? await signedFile(f.originalPath) : undefined,
  };
}
async function normalizeAssets(
  actor: FileActor,
  targetId: string,
  content: FileContent
): Promise<FileContent> {
  const result = structuredClone(content);
  const seen = new Map<string, string>();
  async function image(src: string): Promise<string> {
    if (seen.has(src)) return seen.get(src)!;
    const match = src.match(
      /^\/api\/projects\/([a-f0-9-]+)\/files\/([a-f0-9-]+)\/assets\/([a-f0-9]{64}\.(?:png|jpg|jpeg|gif|webp))$/i
    );
    if (!match) return src;
    const [, projectId, sourceId, name] = match;
    if (projectId !== actor.projectId)
      throw new FileError(403, "Images must belong to this project.");
    if (sourceId === targetId) return src;
    await requireFile(actor, sourceId);
    const { error } = await fileStorage().copy(
      `${projectId}/${sourceId}/assets/${name}`,
      `${projectId}/${targetId}/assets/${name}`
    );
    if (
      error &&
      !String(error.message).toLowerCase().includes("already exists") &&
      !("statusCode" in error && String(error.statusCode) === "409")
    )
      throw new FileError(
        503,
        "The project image could not be copied. Try again."
      );
    const replacement = `/api/projects/${projectId}/files/${targetId}/assets/${name}`;
    seen.set(src, replacement);
    return replacement;
  }
  async function visit(
    node: import("@/features/files/types").RichNode
  ): Promise<void> {
    if (node.type === "image" && typeof node.attrs?.src === "string")
      node.attrs.src = await image(node.attrs.src);
    for (const child of node.content ?? []) await visit(child);
  }
  if (result.kind === "document") await visit(result.doc);
  if (result.kind === "presentation")
    for (const slide of result.slides) {
      if (slide.image) slide.image = await image(slide.image);
    }
  return result;
}
export async function createFile(
  actor: FileActor,
  name: string,
  kind: FileKind,
  content: FileContent = emptyContent(kind),
  source: "manual" | "ai" = "manual"
) {
  const id = randomUUID(),
    revId = randomUUID();
  name = nameSchema.parse(name);
  content = await normalizeAssets(actor, id, validateContent(content));
  if (content.kind !== kind)
    throw new FileError(400, "Content does not match the file type.");
  await sql.begin(async (tx) => {
    const [allowed] =
      await tx`select wm.role from projects p join workspaces w on w.id=p.workspace_id join workspace_members wm on wm.workspace_id=p.workspace_id where p.id=${actor.projectId} and wm.user_id=${actor.userId} and p.deleted_at is null and w.deleted_at is null and wm.role in ('owner','admin','member')`;
    if (!allowed)
      throw new FileError(
        403,
        "Your workspace access changed. Reopen the project."
      );
    await tx`insert into workspace_files (id,project_id,name,kind,created_by) values (${id},${actor.projectId},${name},${kind},${actor.userId})`;
    await tx`insert into file_revisions (id,file_id,content,source,created_by) values (${revId},${id},${dbJson(content)}::jsonb,${source},${actor.userId})`;
    await tx`update workspace_files set current_revision_id=${revId} where id=${id}`;
  });
  return {
    file: await requireFile(actor, id),
    revision: await getRevision(actor, id, revId),
  };
}
export async function saveRevision(
  actor: FileActor,
  id: string,
  baseId: string,
  content: FileContent,
  source: "manual" | "ai" | "restore" = "manual"
) {
  await requireFile(actor, id);
  uuid(baseId);
  content = await normalizeAssets(actor, id, validateContent(content));
  const revId = randomUUID();
  let conflict = false;
  await sql.begin(async (tx) => {
    const [current] =
      await tx`select f.* from workspace_files f join projects p on p.id=f.project_id join workspaces w on w.id=p.workspace_id join workspace_members wm on wm.workspace_id=p.workspace_id where f.id=${id} and f.project_id=${actor.projectId} and f.deleted_at is null and p.deleted_at is null and w.deleted_at is null and wm.user_id=${actor.userId} and wm.role in ('owner','admin','member') for update of f`;
    if (!current) throw new FileError(404, "File not found.");
    const [parent] =
      await tx`select id from file_revisions where id=${baseId} and file_id=${id}`;
    if (!parent)
      throw new FileError(
        400,
        "The source revision does not belong to this file."
      );
    if (content.kind !== current.kind)
      throw new FileError(400, "Content does not match the file type.");
    conflict = mergeRevision(current.currentRevisionId, baseId).conflict;
    await tx`insert into file_revisions (id,file_id,parent_id,content,source,conflict,created_by) values (${revId},${id},${baseId},${dbJson(content)}::jsonb,${source},${conflict},${actor.userId})`;
    if (!conflict)
      await tx`update workspace_files set current_revision_id=${revId},updated_at=now() where id=${id}`;
  });
  return {
    file: await requireFile(actor, id),
    revision: await getRevision(actor, id, revId),
    conflict,
  };
}
export async function renameFile(actor: FileActor, id: string, name: string) {
  await requireFile(actor, id);
  name = nameSchema.parse(name);
  await sql`update workspace_files set name=${name},updated_at=now() where id=${id} and deleted_at is null`;
  return { file: await requireFile(actor, id) };
}
export async function deleteFile(actor: FileActor, id: string) {
  await requireFile(actor, id);
  await sql.begin(async (tx) => {
    await tx`select id from workspace_files where id=${id} for update`;
    await tx`update workspace_files set deleted_at=now(),updated_at=now() where id=${id}`;
    await tx`update file_jobs set status='failed',error='File was deleted.',finished_at=now() where file_id=${id} and status in ('queued','running')`;
  });
}
export async function duplicateFile(actor: FileActor, id: string) {
  const { file: f, revision: r } = await readFile(actor, id);
  return createFile(actor, `${f.name.slice(0, 150)} copy`, f.kind, r.content);
}
export async function messages(actor: FileActor): Promise<FileMessage[]> {
  const rows =
    await sql`select id,role,content,file_id,created_at from (select * from file_messages where project_id=${actor.projectId} order by created_at desc limit 100) m order by created_at asc`;
  return rows.map(
    (r) =>
      ({ ...r, createdAt: new Date(r.createdAt).toISOString() }) as FileMessage
  );
}
export async function addMessage(
  actor: FileActor,
  role: "user" | "assistant",
  content: string,
  fileId?: string
) {
  await sql`insert into file_messages (project_id,file_id,role,content,created_by) values (${actor.projectId},${fileId ?? null},${role},${content},${actor.userId})`;
}
export async function createJob(
  actor: FileActor,
  kind: "generate" | "import" | "export",
  payload: Record<string, unknown>,
  fileId?: string,
  revisionId?: string
) {
  const id = randomUUID();
  await sql.begin(async (tx) => {
    // Serialize per-user admission to keep the queue bounded across app replicas.
    await tx`select pg_advisory_xact_lock(hashtext(${actor.userId}))`;
    const [count] =
      await tx`select count(*)::int as count from file_jobs where created_by=${actor.userId} and status in ('queued','running')`;
    if (count.count >= 5)
      throw new FileError(429, "Wait for a current file operation to finish.");
    await tx`insert into file_jobs (id,project_id,file_id,revision_id,kind,payload,created_by) values (${id},${actor.projectId},${fileId ?? null},${revisionId ?? null},${kind},${dbJson(payload)}::jsonb,${actor.userId})`;
  });
  return id;
}
export async function getJob(actor: FileActor, id: string): Promise<FileJob> {
  uuid(id);
  const [row] =
    await sql`select * from file_jobs where id=${id} and project_id=${actor.projectId}`;
  if (!row) throw new FileError(404, "Job not found.");
  // A terminated app process must not leave generation jobs spinning forever.
  if (
    row.kind === "generate" &&
    ["queued", "running"].includes(row.status) &&
    Date.now() - new Date(row.startedAt ?? row.createdAt).getTime() > 300_000
  ) {
    await sql`update file_jobs set status='failed',error='Generation was interrupted. Retry to continue.',finished_at=now() where id=${id} and status in ('queued','running')`;
    row.status = "failed";
    row.error = "Generation was interrupted. Retry to continue.";
  }
  const result = { ...row.result };
  if (row.fileId) {
    const [active] =
      await sql`select id from workspace_files where id=${row.fileId} and project_id=${actor.projectId} and deleted_at is null`;
    if (!active) throw new FileError(404, "File not found.");
  }
  if (
    typeof result.storagePath === "string" &&
    result.storagePath.startsWith(`${actor.projectId}/`)
  )
    result.downloadUrl = await signedFile(result.storagePath);
  return {
    id: row.id,
    projectId: row.projectId,
    fileId: row.fileId,
    revisionId: row.revisionId,
    kind: row.kind,
    status: row.status,
    progress: row.progress,
    error: row.error,
    result,
    createdAt: new Date(row.createdAt).toISOString(),
  } as FileJob;
}
export async function listJobs(actor: FileActor) {
  const rows =
    await sql`select j.id from file_jobs j left join workspace_files f on f.id=j.file_id where j.project_id=${actor.projectId} and (j.file_id is null or f.deleted_at is null) order by j.created_at desc limit 30`;
  return Promise.all(rows.map((r) => getJob(actor, r.id)));
}

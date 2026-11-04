import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { fileDb as sql } from "./db";
import {
  authorizeProject,
  assertOrigin,
  errorResponse,
  jsonBody,
  boundedBody,
  FileError,
  uuid,
  type FileActor,
} from "./access";
import * as store from "./store";
import { fileStorage, signedFile } from "./storage";
import { runGeneration } from "./generation";
import {
  fileKindSchema,
  nameSchema,
  validateContent,
  validateUpload,
  MAX_UPLOAD,
} from "@/features/files/lib/content";
const idSchema = z.uuid();
const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    baseRevisionId: idSchema,
    content: z.unknown(),
  }),
  z.object({ action: z.literal("rename"), name: nameSchema }),
  z.object({ action: z.literal("duplicate") }),
  z.object({
    action: z.enum(["restore", "apply"]),
    revisionId: idSchema,
    baseRevisionId: idSchema,
  }),
]);
function workerRequired() {
  if (env.FILE_WORKER_ENABLED !== "true")
    throw new FileError(
      503,
      "File conversion is not enabled yet. Ask the project owner to start the conversion worker."
    );
}
function schedule(actor: FileActor, id: string) {
  after(() => runGeneration(actor, id));
}
export async function handleFilesRequest(
  request: Request,
  { projectId, path = [] }: { projectId: string; path?: string[] }
): Promise<Response> {
  try {
    assertOrigin(request);
    const actor = await authorizeProject(projectId, request.method !== "GET");
    const [first, second, third, fourth] = path;
    if (!first) {
      if (request.method === "GET")
        return Response.json({
          files: await store.listFiles(actor),
          messages: await store.messages(actor),
          jobs: await store.listJobs(actor),
          canEdit: actor.canEdit,
          aiAvailable: !!env.DEEPSEEK_API_KEY,
          workerAvailable: env.FILE_WORKER_ENABLED === "true",
        });
      if (request.method === "POST") {
        const data = z
          .object({ name: nameSchema, kind: fileKindSchema })
          .parse(await jsonBody(request));
        return Response.json(
          await store.createFile(actor, data.name, data.kind),
          { status: 201 }
        );
      }
    }
    if (first === "chat" && path.length === 1 && request.method === "POST") {
      if (!env.DEEPSEEK_API_KEY)
        throw new FileError(
          503,
          "DeepSeek is not connected yet. Ask the project owner to configure it."
        );
      const data = z
        .object({
          message: z.string().trim().min(1).max(10_000),
          fileId: idSchema.optional(),
          baseRevisionId: idSchema.optional(),
          kind: fileKindSchema.default("document"),
        })
        .parse(await jsonBody(request));
      if (data.fileId) {
        const f = await store.requireFile(actor, data.fileId);
        if (!data.baseRevisionId) data.baseRevisionId = f.currentRevisionId;
        await store.getRevision(actor, f.id, data.baseRevisionId);
        data.kind = f.kind;
      }
      const id = await store.createJob(
        actor,
        "generate",
        data,
        data.fileId,
        data.baseRevisionId
      );
      await store.addMessage(actor, "user", data.message, data.fileId);
      schedule(actor, id);
      return Response.json({ jobId: id }, { status: 202 });
    }
    if (first === "import" && path.length === 1 && request.method === "POST") {
      workerRequired();
      const length = Number(request.headers.get("content-length"));
      if (length > MAX_UPLOAD + 65_536)
        throw new FileError(413, "Upload a file up to 20 MB.");
      const limited = await boundedBody(request, MAX_UPLOAD + 65_536);
      const form = await new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
        body: limited as BodyInit,
      }).formData();
      const upload = form.get("file");
      if (!(upload instanceof File))
        throw new FileError(400, "Choose a file to upload.");
      if (upload.size > MAX_UPLOAD)
        throw new FileError(413, "Upload a file up to 20 MB.");
      const bytes = new Uint8Array(await upload.arrayBuffer());
      let kind;
      try {
        kind = validateUpload(upload.name, bytes);
      } catch (e) {
        throw new FileError(
          400,
          e instanceof Error ? e.message : "Invalid file."
        );
      }
      const extension = upload.name.split(".").pop()!.toLowerCase();
      const stem =
        upload.name
          .slice(0, -extension.length - 1)
          .replace(/[\x00-\x1f/\\]/g, "_")
          .slice(0, 150) || "Imported file";
      const name = `${stem}.${extension}`;
      const { file, revision } = await store.createFile(actor, name, kind);
      const storagePath = `${projectId}/${file.id}/original/${name}`;
      const { error } = await fileStorage().upload(storagePath, bytes, {
        contentType: upload.type || "application/octet-stream",
        upsert: false,
      });
      if (error) {
        await store.deleteFile(actor, file.id);
        throw new FileError(503, "The upload could not be saved. Try again.");
      }
      try {
        await sql`update workspace_files set original_path=${storagePath},original_name=${name},warnings='["Import is processing. Review conversion warnings before editing."]'::jsonb where id=${file.id}`;
        const id = await store.createJob(
          actor,
          "import",
          {
            storagePath,
            originalName: name,
            kind,
            baseRevisionId: revision.id,
          },
          file.id,
          revision.id
        );
        return Response.json({ jobId: id }, { status: 202 });
      } catch (error) {
        await fileStorage().remove([storagePath]);
        await store.deleteFile(actor, file.id);
        throw error;
      }
    }
    if (first === "jobs" && second) {
      uuid(second);
      if (path.length === 2 && request.method === "GET")
        return Response.json({ job: await store.getJob(actor, second) });
      if (third === "stream" && path.length === 3 && request.method === "GET") {
        await store.getJob(actor, second);
        const encoder = new TextEncoder();
        let stopped = false;
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for (let n = 0; n < 150 && !stopped; n++) {
                if (request.signal.aborted) break;
                if (n % 10 === 0) await authorizeProject(projectId);
                const job = await store.getJob(actor, second);
                if (job.status === "succeeded" || job.status === "failed") {
                  controller.enqueue(
                    encoder.encode(
                      `event: done\ndata: ${JSON.stringify({ job })}\n\n`
                    )
                  );
                  break;
                }
                const [row] =
                  await sql`select result from file_jobs where id=${second} and project_id=${projectId}`;
                controller.enqueue(
                  encoder.encode(
                    `event: progress\ndata: ${JSON.stringify({ text: row?.result?.streamText ?? (job.status === "queued" ? "Waiting to start…" : "Creating your file…"), progress: job.progress })}\n\n`
                  )
                );
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            } catch {
              if (!stopped)
                controller.enqueue(
                  encoder.encode(
                    'event: error\ndata: {"error":"Connection interrupted. Reopen the job to continue."}\n\n'
                  )
                );
            } finally {
              if (!stopped) controller.close();
            }
          },
          cancel() {
            stopped = true;
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      }
      if (third === "retry" && path.length === 3 && request.method === "POST") {
        const job = await store.getJob(actor, second);
        if (job.status !== "failed")
          throw new FileError(409, "Only failed operations can be retried.");
        const [row] =
          await sql`select * from file_jobs where id=${second} and project_id=${projectId}`;
        if (row.fileId) await store.requireFile(actor, row.fileId);
        if (job.kind === "generate" && !env.DEEPSEEK_API_KEY)
          throw new FileError(503, "DeepSeek is not connected yet.");
        if (job.kind !== "generate") workerRequired();
        const id = await store.createJob(
          actor,
          job.kind,
          row.payload,
          row.fileId,
          row.revisionId
        );
        if (job.kind === "generate") schedule(actor, id);
        return Response.json({ jobId: id }, { status: 202 });
      }
    }
    if (first && first !== "jobs" && first !== "chat" && first !== "import") {
      uuid(first);
      if (path.length === 1) {
        if (request.method === "GET")
          return Response.json(await store.readFile(actor, first));
        if (request.method === "DELETE") {
          await store.deleteFile(actor, first);
          return Response.json({ ok: true });
        }
        if (request.method === "PATCH") {
          const data = patchSchema.parse(await jsonBody(request));
          if (data.action === "rename")
            return Response.json(
              await store.renameFile(actor, first, data.name)
            );
          if (data.action === "duplicate")
            return Response.json(await store.duplicateFile(actor, first));
          const content =
            data.action === "save"
              ? validateContent(data.content)
              : (await store.getRevision(actor, first, data.revisionId))
                  .content;
          const result = await store.saveRevision(
            actor,
            first,
            data.baseRevisionId,
            content,
            data.action === "save" ? "manual" : "restore"
          );
          if (result.conflict) {
            const current = await store.getRevision(
              actor,
              first,
              result.file.currentRevisionId
            );
            return Response.json(
              {
                error:
                  "This file changed while you were editing. Both versions are preserved.",
                file: result.file,
                revision: current,
                preservedRevision: result.revision,
                conflict: true,
              },
              { status: 409 }
            );
          }
          return Response.json(result);
        }
      }
      if (
        second === "export" &&
        path.length === 2 &&
        request.method === "POST"
      ) {
        workerRequired();
        const data = z
          .object({
            revisionId: idSchema,
            format: z.enum(["docx", "pdf", "md", "pptx", "xlsx", "csv"]),
          })
          .parse(await jsonBody(request));
        const f = await store.requireFile(actor, first);
        await store.getRevision(actor, first, data.revisionId);
        const formats = {
          document: ["docx", "pdf", "md"],
          presentation: ["pptx", "pdf"],
          spreadsheet: ["xlsx", "csv", "pdf"],
        };
        if (!formats[f.kind].includes(data.format))
          throw new FileError(400, "That format does not match this file.");
        const id = await store.createJob(
          actor,
          "export",
          { format: data.format, name: f.name },
          first,
          data.revisionId
        );
        return Response.json({ jobId: id }, { status: 202 });
      }
      if (
        second === "assets" &&
        third &&
        path.length === 3 &&
        request.method === "GET"
      ) {
        await store.requireFile(actor, first);
        if (!/^[\da-f]{64}\.(png|jpg|jpeg|gif|webp)$/i.test(third))
          throw new FileError(404, "Image not found.");
        const { data, error } = await fileStorage().download(
          `${projectId}/${first}/assets/${third}`
        );
        if (error || !data) throw new FileError(404, "Image not found.");
        return new Response(data, {
          headers: {
            "Content-Type": data.type,
            "Cache-Control": "private, max-age=60",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
          },
        });
      }
      if (
        second === "original" &&
        path.length === 2 &&
        request.method === "GET"
      ) {
        const f = await store.requireFile(actor, first);
        if (!f.originalPath)
          throw new FileError(404, "Original file not found.");
        return Response.redirect(await signedFile(f.originalPath));
      }
    }
    void fourth;
    throw new FileError(404, "File operation not found.");
  } catch (error) {
    return errorResponse(error);
  }
}

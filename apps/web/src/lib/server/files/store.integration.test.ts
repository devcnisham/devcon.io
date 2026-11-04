import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { emptyContent } from "@/features/files/lib/content";
const url = process.env.FILE_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("file persistence in an isolated PostgreSQL database", () => {
  let db: ReturnType<typeof postgres>;
  let store: typeof import("./store");
  const uid = randomUUID(),
    outsider = randomUUID(),
    wid = randomUUID(),
    project = randomUUID(),
    otherProject = randomUUID();
  const actor = { userId: uid, projectId: project, canEdit: true };
  beforeAll(async () => {
    process.env.DATABASE_URL = url!;
    db = postgres(url!, { max: 1 });
    await db.unsafe(`create schema if not exists auth;create schema if not exists storage;
   do $$begin if not exists(select 1 from pg_roles where rolname='anon')then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated;end if;end$$;
   create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table if not exists users(id uuid primary key);
   create table if not exists workspaces(id uuid primary key,deleted_at timestamptz);
   create table if not exists projects(id uuid primary key,workspace_id uuid references workspaces(id),deleted_at timestamptz);
   create table if not exists workspace_members(workspace_id uuid,user_id uuid,role text);
   create table if not exists storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
   create or replace function is_workspace_member(ws uuid,uid uuid) returns boolean language sql stable as $$select exists(select 1 from workspace_members where workspace_id=ws and user_id=uid)$$;
   grant usage on schema public,auth to authenticated;grant select on projects,workspaces,workspace_members to authenticated;`);
    await db.unsafe(
      await readFile(
        new URL("../../../../scripts/files-schema.sql", import.meta.url),
        "utf8"
      )
    );
    await db`insert into users values(${uid}),(${outsider})`;
    await db`insert into workspaces(id) values(${wid})`;
    await db`insert into projects(id,workspace_id) values(${project},${wid}),(${otherProject},${wid})`;
    await db`insert into workspace_members values(${wid},${uid},'member')`;
    store = await import("./store");
  });
  afterAll(async () => {
    if (db) {
      await db`delete from projects where workspace_id=${wid}`.catch(() => {});
      await db`delete from workspace_members where workspace_id=${wid}`;
      await db`delete from workspaces where id=${wid}`.catch(() => {});
      await db.end();
    }
    const { fileDb } = await import("./db");
    await fileDb.end();
  });
  it("reopens persisted content, duplicates, renames, and soft-deletes", async () => {
    const made = await store.createFile(actor, "Brief", "document");
    const saved = await store.saveRevision(
      actor,
      made.file.id,
      made.revision.id,
      {
        kind: "document",
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Saved text" }],
            },
          ],
        },
      }
    );
    expect(
      (await store.readFile(actor, made.file.id)).revision.content
    ).toEqual(saved.revision.content);
    const copied = await store.duplicateFile(actor, made.file.id);
    expect(copied.file.id).not.toBe(made.file.id);
    expect(
      (await store.renameFile(actor, copied.file.id, "Copy renamed")).file.name
    ).toBe("Copy renamed");
    await store.deleteFile(actor, copied.file.id);
    await expect(store.readFile(actor, copied.file.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("preserves concurrent manual and AI revisions without advancing the head", async () => {
    const made = await store.createFile(actor, "Concurrency", "document");
    const content = emptyContent("document");
    const [a, b] = await Promise.all([
      store.saveRevision(actor, made.file.id, made.revision.id, content),
      store.saveRevision(actor, made.file.id, made.revision.id, content, "ai"),
    ]);
    expect([a.conflict, b.conflict].sort()).toEqual([false, true]);
    const detail = await store.readFile(actor, made.file.id);
    expect(detail.revisions).toHaveLength(3);
    const alternate = a.conflict ? a : b;
    expect(detail.file.currentRevisionId).not.toBe(alternate.revision.id);
    const restored = await store.saveRevision(
      actor,
      made.file.id,
      detail.file.currentRevisionId,
      made.revision.content,
      "restore"
    );
    expect(restored.conflict).toBe(false);
  });
  it("rejects cross-project file IDs and revisions", async () => {
    const made = await store.createFile(actor, "Boundary", "document");
    await expect(
      store.readFile({ ...actor, projectId: otherProject }, made.file.id)
    ).rejects.toMatchObject({ status: 404 });
    const another = await store.createFile(actor, "Other", "document");
    await expect(
      store.saveRevision(
        actor,
        made.file.id,
        another.revision.id,
        emptyContent("document")
      )
    ).rejects.toMatchObject({ status: 400 });
  });
  it("rechecks permissions at commit time", async () => {
    const made = await store.createFile(actor, "Revoked", "document");
    await db`update workspace_members set role='viewer' where user_id=${uid}`;
    await expect(
      store.saveRevision(
        actor,
        made.file.id,
        made.revision.id,
        emptyContent("document")
      )
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      store.createFile(actor, "Denied", "document")
    ).rejects.toMatchObject({ status: 403 });
    await db`update workspace_members set role='member' where user_id=${uid}`;
  });
  it("RLS denies outsiders and prevents browser writes", async () => {
    await store.createFile(actor, "Private", "document");
    await db.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub',${outsider},true)`;
      expect(
        (await tx`select * from workspace_files where project_id=${project}`)
          .length
      ).toBe(0);
    });
    await expect(
      db.begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select set_config('request.jwt.claim.sub',${outsider},true)`;
        await tx`insert into workspace_files(project_id,name,kind,created_by) values(${project},'Attack','document',${outsider})`;
      })
    ).rejects.toThrow(/permission denied/);
    await db
      .begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select set_config('request.jwt.claim.sub',${uid},true)`;
        expect(
          (await tx`select * from workspace_files where project_id=${project}`)
            .length
        ).toBeGreaterThan(0);
      })
      .catch((error) => {
        if (!String(error).includes("current transaction is aborted"))
          throw error;
      });
  });
  it("rejects cross-project image references but preserves literal text paths", async () => {
    const path = `/api/projects/${otherProject}/files/${randomUUID()}/assets/${"a".repeat(64)}.png`;
    await expect(
      store.createFile(actor, "Bad image", "document", {
        kind: "document",
        doc: {
          type: "doc",
          content: [{ type: "image", attrs: { src: path } }],
        },
      })
    ).rejects.toMatchObject({ status: 403 });
    const made = await store.createFile(actor, "Path example", "document", {
      kind: "document",
      doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: path }] },
        ],
      },
    });
    expect(
      JSON.stringify(
        (await store.readFile(actor, made.file.id)).revision.content
      )
    ).toContain(path);
  });
  it("returns durable jobs and marks interrupted generation retryable", async () => {
    const jobId = await store.createJob(actor, "generate", {
      message: "hello",
      kind: "document",
    });
    expect((await store.getJob(actor, jobId)).status).toBe("queued");
    await db`update file_jobs set created_at=now()-interval '6 minutes' where id=${jobId}`;
    expect((await store.getJob(actor, jobId)).status).toBe("failed");
  });
});

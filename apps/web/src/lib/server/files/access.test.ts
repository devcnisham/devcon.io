import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { FILE_WORKSPACE_ENABLED: "true" },
  getUser: vi.fn(),
  sql: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/server/supabase", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));
vi.mock("./db", () => ({ fileDb: mocks.sql }));

import {
  assertOrigin,
  authorizeProject,
  boundedBody,
  FileError,
  jsonBody,
  uuid,
} from "./access";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.FILE_WORKSPACE_ENABLED = "true";
  mocks.getUser.mockResolvedValue({
    data: { user: { id: USER, email_confirmed_at: "2026-11-04T00:00:00Z" } },
    error: null,
  });
  mocks.sql.mockResolvedValue([{ role: "member" }]);
});

describe("file workspace authorization", () => {
  it("hides the workspace when its feature flag is disabled", async () => {
    mocks.env.FILE_WORKSPACE_ENABLED = "false";
    await expect(authorizeProject(PROJECT)).rejects.toMatchObject({
      status: 404,
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("rejects signed-out users", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(authorizeProject(PROJECT)).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("rejects unverified users", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: USER, email_confirmed_at: null } },
      error: null,
    });
    await expect(authorizeProject(PROJECT)).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("rejects an Auth validation failure even if a user object is returned", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: USER, email_confirmed_at: "yes" } },
      error: { message: "Session invalid" },
    });
    await expect(authorizeProject(PROJECT)).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("does not reveal project existence to outsiders", async () => {
    mocks.sql.mockResolvedValue([]);
    await expect(authorizeProject(PROJECT)).rejects.toMatchObject({
      status: 404,
    });
    const [, projectId, userId] = mocks.sql.mock.calls[0];
    expect(projectId).toBe(PROJECT);
    expect(userId).toBe(USER);
  });

  it("allows viewers to read, with editing disabled", async () => {
    mocks.sql.mockResolvedValue([{ role: "viewer" }]);
    await expect(authorizeProject(PROJECT)).resolves.toEqual({
      userId: USER,
      projectId: PROJECT,
      canEdit: false,
    });
  });

  it("rejects viewer writes", async () => {
    mocks.sql.mockResolvedValue([{ role: "viewer" }]);
    await expect(authorizeProject(PROJECT, true)).rejects.toMatchObject({
      status: 403,
    });
  });

  it.each(["member", "admin", "owner"])(
    "allows %s reads and writes",
    async (role) => {
      mocks.sql.mockResolvedValue([{ role }]);
      await expect(authorizeProject(PROJECT)).resolves.toMatchObject({
        canEdit: true,
        userId: USER,
      });
      await expect(authorizeProject(PROJECT, true)).resolves.toMatchObject({
        canEdit: true,
        userId: USER,
      });
    }
  );

  it("denies unknown membership roles", async () => {
    mocks.sql.mockResolvedValue([{ role: "superuser" }]);
    await expect(authorizeProject(PROJECT)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects malformed project identifiers before reading auth or database", async () => {
    await expect(authorizeProject("../another-project")).rejects.toMatchObject({
      status: 400,
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});

describe("file HTTP input boundaries", () => {
  it.each(["", "not-a-uuid", "../../secret", null, undefined, 42])(
    "rejects invalid identifier %s",
    (value) => {
      expect(() => uuid(value)).toThrow(FileError);
      try {
        uuid(value);
      } catch (error) {
        expect(error).toMatchObject({ status: 400 });
      }
    }
  );

  it("accepts a valid UUID", () => {
    expect(uuid(PROJECT)).toBe(PROJECT);
  });

  it.each([undefined, "https://attacker.example", "null"])(
    "rejects write Origin %s",
    (origin) => {
      const request = new Request("https://devcon.example/api/files", {
        method: "POST",
        headers: origin ? { origin } : {},
      });
      expect(() => assertOrigin(request)).toThrow(FileError);
      try {
        assertOrigin(request);
      } catch (error) {
        expect(error).toMatchObject({ status: 403 });
      }
    }
  );

  it("accepts same-origin writes and permits reads without Origin", () => {
    expect(() =>
      assertOrigin(
        new Request("https://devcon.example/api/files", {
          method: "PATCH",
          headers: { origin: "https://devcon.example" },
        })
      )
    ).not.toThrow();
    expect(() =>
      assertOrigin(new Request("https://devcon.example/api/files"))
    ).not.toThrow();
  });

  it("rejects an oversized Content-Length before buffering the body", async () => {
    const request = new Request("https://devcon.example/api/files", {
      method: "POST",
      body: "{}",
      headers: { "content-length": "9000001" },
    });
    await expect(jsonBody(request)).rejects.toMatchObject({ status: 413 });
    expect(request.bodyUsed).toBe(false);
  });

  it("bounds a chunked JSON body without Content-Length and cancels the stream", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(3_100_000));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://devcon.example/api/files", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(jsonBody(request)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
    expect(request.body?.locked).toBe(false);
  });

  it("accepts a valid body at the byte boundary", async () => {
    const request = new Request("https://devcon.example/api/files", {
      method: "POST",
      body: "é",
    });
    expect(await boundedBody(request, 2)).toEqual(
      new TextEncoder().encode("é")
    );
  });

  it("parses valid JSON and rejects malformed JSON", async () => {
    await expect(
      jsonBody(
        new Request("https://devcon.example/api/files", {
          method: "POST",
          body: '{"name":"Plan"}',
        })
      )
    ).resolves.toEqual({ name: "Plan" });
    await expect(
      jsonBody(
        new Request("https://devcon.example/api/files", {
          method: "POST",
          body: "{",
        })
      )
    ).rejects.toMatchObject({ status: 400 });
  });
});

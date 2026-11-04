import { expect, test, type Page } from "@playwright/test";
import type {
  FileContent,
  FileJob,
  FileMessage,
  FileRevision,
  WorkspaceFile,
} from "../../src/features/files/types";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const NOW = new Date().toISOString();
const paragraph = (text: string): FileContent => ({
  kind: "document",
  doc: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  },
});
async function fixtures(page: Page) {
  const files: WorkspaceFile[] = [
    {
      id: "doc",
      projectId: PROJECT,
      name: "Project brief",
      kind: "document",
      currentRevisionId: "doc-v1",
      updatedAt: NOW,
      warnings: [],
    },
    {
      id: "slides",
      projectId: PROJECT,
      name: "Launch deck",
      kind: "presentation",
      currentRevisionId: "slides-v1",
      updatedAt: NOW,
      warnings: [],
    },
    {
      id: "sheets",
      projectId: PROJECT,
      name: "Budget",
      kind: "spreadsheet",
      currentRevisionId: "sheets-v1",
      updatedAt: NOW,
      warnings: [],
    },
  ];
  const revisions: FileRevision[] = [
    {
      id: "doc-v1",
      fileId: "doc",
      parentId: "doc-v0",
      content: paragraph("A clear project brief."),
      source: "manual",
      createdAt: NOW,
      conflict: false,
    },
    {
      id: "doc-v0",
      fileId: "doc",
      parentId: null,
      content: paragraph("Original project brief."),
      source: "manual",
      createdAt: NOW,
      conflict: false,
    },
    {
      id: "slides-v1",
      fileId: "slides",
      parentId: null,
      content: {
        kind: "presentation",
        theme: "paper",
        slides: [
          {
            id: "slide-a",
            title: "Launch plan",
            body: "Our next milestone",
            layout: "content",
          },
        ],
      },
      source: "manual",
      createdAt: NOW,
      conflict: false,
    },
    {
      id: "sheets-v1",
      fileId: "sheets",
      parentId: null,
      content: {
        kind: "spreadsheet",
        sheets: [
          {
            id: "s1",
            name: "Budget",
            rows: [[{ value: "2" }, { value: "3" }, { value: "=SUM(A1:B1)" }]],
          },
        ],
      },
      source: "manual",
      createdAt: NOW,
      conflict: false,
    },
  ];
  const jobs: FileJob[] = [];
  const messages: FileMessage[] = [];
  let serial = 0;
  const controls = {
    failNextSave: false,
    conflictNextSave: false,
    saved: [] as FileContent[],
    generated: 0,
    exported: [] as string[],
  };
  const getRevision = (file: WorkspaceFile) =>
    revisions.find((r) => r.id === file.currentRevisionId)!;
  const revision = (
    file: WorkspaceFile,
    content: FileContent,
    source: FileRevision["source"] = "manual",
    conflict = false
  ) => {
    const rev: FileRevision = {
      id: `${file.id}-v${++serial + 10}`,
      fileId: file.id,
      parentId: file.currentRevisionId,
      content,
      source,
      createdAt: NOW,
      conflict,
    };
    revisions.unshift(rev);
    if (!conflict) file.currentRevisionId = rev.id;
    return rev;
  };
  await page.route("**/api/projects/**/files**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const suffix = url.pathname.split("/files")[1].replace(/^\//, "");
    const parts = suffix.split("/").filter(Boolean);
    const method = request.method();
    const reply = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (!parts.length && method === "GET")
      return reply({
        files,
        messages,
        jobs,
        canEdit: true,
        aiAvailable: true,
        workerAvailable: true,
      });
    const body =
      method === "POST" || method === "PATCH" ? request.postDataJSON() : {};
    if (!parts.length && method === "POST") {
      const file: WorkspaceFile = {
        id: `created-${++serial}`,
        projectId: PROJECT,
        name: body.name,
        kind: body.kind,
        currentRevisionId: "",
        updatedAt: NOW,
        warnings: [],
      };
      files.unshift(file);
      const rev = revision(file, paragraph("Start writing."));
      return reply({ file, revision: rev });
    }
    if (parts[0] === "chat") {
      controls.generated++;
      messages.push({
        id: `message-${serial++}`,
        role: "user",
        content: body.message,
        fileId: body.fileId,
        createdAt: NOW,
      });
      const file = files.find((f) => f.id === (body.fileId || "doc"))!;
      const alt = revision(
        file,
        paragraph("An AI alternative to review."),
        "ai",
        true
      );
      const job: FileJob = {
        id: `job-${++serial}`,
        projectId: PROJECT,
        fileId: file.id,
        revisionId: body.baseRevisionId,
        kind: "generate",
        status: "succeeded",
        progress: 100,
        createdAt: NOW,
        result: { fileId: file.id, revisionId: alt.id, conflict: true },
      };
      jobs.unshift(job);
      return reply({ jobId: job.id });
    }
    if (parts[0] === "jobs") {
      const job = jobs.find((item) => item.id === parts[1]);
      if (parts[2] === "stream")
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: done\ndata: ${JSON.stringify({ job })}\n\n`,
        });
      return reply({ job });
    }
    const file = files.find((item) => item.id === parts[0]);
    if (!file) return reply({ error: "File not found." }, 404);
    if (parts[1] === "export") {
      controls.exported.push(body.revisionId);
      const job: FileJob = {
        id: `export-${++serial}`,
        projectId: PROJECT,
        fileId: file.id,
        revisionId: body.revisionId,
        kind: "export",
        status: "succeeded",
        progress: 100,
        createdAt: NOW,
        result: { downloadUrl: "/download/project-brief.docx" },
      };
      jobs.unshift(job);
      return reply({ jobId: job.id });
    }
    if (method === "GET")
      return reply({
        file,
        revision: getRevision(file),
        revisions: revisions.filter((item) => item.fileId === file.id),
      });
    if (method === "DELETE") {
      files.splice(files.indexOf(file), 1);
      return reply({ ok: true });
    }
    if (body.action === "save") {
      if (controls.failNextSave) {
        controls.failNextSave = false;
        return reply({ error: "Connection interrupted. Retry saving." }, 503);
      }
      if (controls.conflictNextSave) {
        controls.conflictNextSave = false;
        const head = revision(file, paragraph("Changed in another window."));
        return reply(
          { error: "File changed elsewhere.", revision: head, conflict: true },
          409
        );
      }
      controls.saved.push(body.content);
      return reply({ file, revision: revision(file, body.content) });
    }
    if (body.action === "rename") {
      file.name = body.name;
      return reply({ file });
    }
    if (body.action === "duplicate") {
      const copy = {
        ...file,
        id: `copy-${++serial}`,
        name: `${file.name} copy`,
      };
      files.unshift(copy);
      return reply({
        file: copy,
        revision: revision(copy, getRevision(file).content),
      });
    }
    if (body.action === "restore" || body.action === "apply")
      return reply({
        file,
        revision: revision(
          file,
          revisions.find((item) => item.id === body.revisionId)!.content,
          "restore"
        ),
      });
    return reply({ error: "Unsupported test request." }, 400);
  });
  await page.context().route("**/download/project-brief.docx", (route) =>
    route.fulfill({
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      headers: {
        "Content-Disposition": 'attachment; filename="project-brief.docx"',
      },
      body: "fixture-download",
    })
  );
  await page.goto("");
  await expect(
    page.getByRole("heading", { name: "Project files" })
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Document content" })
  ).toBeVisible();
  return controls;
}

test("document autosave survives reopening, and failed saves preserve the draft", async ({
  page,
}) => {
  const state = await fixtures(page);
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  const editor = page.getByRole("textbox", { name: "Document content" });
  await editor.fill("A revised project brief.");
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(editor).toContainText("A revised project brief.");
  state.failNextSave = true;
  await editor.fill("A draft worth keeping.");
  await expect(
    page.getByRole("button", { name: "Retry saving" })
  ).toBeVisible();
  await expect(editor).toContainText("A draft worth keeping.");
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
});

test("manual conflicts preserve drafts and version history restores content", async ({
  page,
}) => {
  const state = await fixtures(page);
  state.conflictNextSave = true;
  const editor = page.getByRole("textbox", { name: "Document content" });
  await editor.fill("My carefully edited draft.");
  await expect(
    page.getByText("This file changed elsewhere. Your draft is preserved.")
  ).toBeVisible();
  await expect(editor).toContainText("My carefully edited draft.");
  await page
    .getByRole("button", { name: "Save my draft as a new revision" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.getByRole("button", { name: "Version history" }).click();
  await page
    .getByRole("button", { name: "Restore", exact: true })
    .last()
    .click();
  await expect(editor).toContainText("Original project brief.");
});

test("slides and spreadsheet cells edit, calculate, and autosave", async ({
  page,
}) => {
  const state = await fixtures(page);
  await page.getByRole("button", { name: "Files (3)", exact: true }).click();
  await page.getByRole("button", { name: /Launch deck Slides/ }).click();
  await page
    .getByRole("textbox", { name: "Slide title" })
    .fill("A stronger launch story");
  await expect.poll(() => state.saved.length).toBe(1);
  await page.getByRole("button", { name: "Files (3)", exact: true }).click();
  await page.getByRole("button", { name: /Budget Spreadsheet/ }).click();
  await expect(
    page.getByRole("textbox", { name: "C1", exact: true })
  ).toHaveValue("5");
  await page.getByRole("textbox", { name: "A1", exact: true }).fill("7");
  await page.getByRole("textbox", { name: "B1", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "C1", exact: true })
  ).toHaveValue("10");
  await expect.poll(() => state.saved.length).toBe(2);
});

test("chat alternatives require explicit apply and exports expose revision downloads", async ({
  page,
}) => {
  await fixtures(page);
  await page
    .getByRole("textbox", { name: /Revise “Project brief”/ })
    .fill("Make the goals clearer.");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByRole("button", { name: "Review AI alternative" }).click();
  await expect(
    page.getByRole("textbox", { name: "Document content" })
  ).toContainText("An AI alternative to review.");
  await page.getByRole("button", { name: "Apply this version" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /^DOCX/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("project-brief.docx");
});

test("mobile tabs and keyboard chat work without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await fixtures(page);
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Document content" })
  ).toBeHidden();
  const prompt = page.getByRole("textbox", { name: /Revise “Project brief”/ });
  await prompt.fill("Write a shorter summary.");
  await prompt.press("Control+Enter");
  await expect.poll(() => state.generated).toBe(1);
  await page.getByRole("tab", { name: "Artifact", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Document content" })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    )
  ).toBe(true);
});

test("file creation, renaming, duplication, and deletion update the library", async ({
  page,
}) => {
  await fixtures(page);
  await page.getByRole("button", { name: "Files (3)", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept("New project brief"));
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator(".file-editor-name strong")).toHaveText(
    "New project brief"
  );
  page.once("dialog", (dialog) => dialog.accept("Renamed brief"));
  await page.getByRole("button", { name: "Rename file" }).click();
  await expect(page.locator(".file-editor-name strong")).toHaveText(
    "Renamed brief"
  );
  await page.getByRole("button", { name: "Duplicate file" }).click();
  await expect(page.locator(".file-editor-name strong")).toHaveText(
    "Renamed brief copy"
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete file" }).click();
  await expect(
    page.getByRole("button", { name: /Renamed brief copy Document/ })
  ).toHaveCount(0);
  await expect(page.locator(".file-editor-name strong")).toHaveText(
    "Renamed brief"
  );
});

test("oversize uploads show guidance without disturbing the open file", async ({
  page,
}) => {
  await fixtures(page);
  await page
    .locator('input[type="file"][accept=".docx,.pptx,.xlsx,.csv,.pdf"]')
    .setInputFiles({
      name: "too-large.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(21 * 1024 * 1024),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Choose a file smaller than 20 MB."
  );
  await expect(
    page.getByRole("textbox", { name: "Document content" })
  ).toContainText("A clear project brief.");
});

test("artifact Preview and Edit preserve the draft and versions are navigable", async ({
  page,
}) => {
  await fixtures(page);
  const editor = page.getByRole("textbox", { name: "Document content" });
  await editor.fill("A draft that survives preview.");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(editor).toContainText("A draft that survives preview.");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(editor).toContainText("A draft that survives preview.");
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.getByRole("button", { name: "Previous version" }).click();
  await expect(
    page.getByText("You’re viewing an earlier version.")
  ).toBeVisible();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await page.getByRole("button", { name: "Back to latest" }).click();
  await expect(editor).toContainText("A draft that survives preview.");
});

test("artifact theme supports dark mode without changing the project shell", async ({
  page,
}) => {
  await fixtures(page);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect(
    page.getByRole("heading", { name: "Project files" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview", exact: true })
  ).toBeVisible();
  expect(
    await page
      .locator(".file-workspace")
      .evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe("rgb(38, 38, 36)");
  await page.screenshot({
    path: "test-results/workspace-dark.png",
    fullPage: true,
  });
});

test("an earlier artifact preview exports the exact displayed revision", async ({
  page,
}) => {
  const state = await fixtures(page);
  await page.getByRole("button", { name: "Previous version" }).click();
  await expect(
    page.getByRole("textbox", { name: "Document content" })
  ).toContainText("Original project brief.");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /^DOCX/ }).click();
  await expect.poll(() => state.exported[0]).toBe("doc-v0");
});

import { z } from "zod";
import type { FileContent, FileKind, RichNode } from "../types";
export const MAX_UPLOAD = 20 * 1024 * 1024;
export const fileKindSchema = z.enum([
  "document",
  "presentation",
  "spreadsheet",
]);
export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine(
    (v) => !/[\x00-\x1f/\\]/.test(v),
    "Use a name without slashes or control characters."
  );
const image = z
  .string()
  .max(3_000_000)
  .refine(
    (s) =>
      /^\/api\/projects\/[\da-f-]+\/files\/[\da-f-]+\/assets\/[a-f0-9]{64}\.(png|jpg|jpeg|gif|webp)$/i.test(
        s
      ) || /^data:image\/(png|jpeg|gif|webp);base64,[\da-z+/=]+$/i.test(s),
    "Use an uploaded image."
  );
const nodes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "image",
]);
const marks = new Set([
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
]);
function checkNode(node: RichNode, depth = 0, counter = { n: 0 }): void {
  if (depth > 24 || ++counter.n > 20_000 || !nodes.has(node.type))
    throw new Error("Unsupported or overly complex document.");
  if (
    node.text !== undefined &&
    (typeof node.text !== "string" || node.text.length > 200_000)
  )
    throw new Error("Document text is too long.");
  if (node.type === "image") image.parse(node.attrs?.src);
  if (node.attrs)
    for (const [key, value] of Object.entries(node.attrs)) {
      if (
        ![
          "src",
          "alt",
          "title",
          "level",
          "start",
          "colspan",
          "rowspan",
          "colwidth",
          "textAlign",
          "width",
          "height",
        ].includes(key)
      )
        throw new Error("Unsupported document attribute.");
      if (typeof value === "string" && value.length > 3_000_000)
        throw new Error("Document attribute is too long.");
    }
  for (const mark of node.marks ?? []) {
    if (!marks.has(mark.type)) throw new Error("Unsupported text style.");
    if (mark.type === "link") {
      const href = mark.attrs?.href;
      if (typeof href !== "string" || !/^(https?:\/\/|mailto:)/i.test(href))
        throw new Error("Unsafe link.");
    }
  }
  for (const child of node.content ?? []) checkNode(child, depth + 1, counter);
}
const richNode: z.ZodType<RichNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .max(10)
      .optional(),
    content: z.array(richNode).max(10_000).optional(),
  })
);
export const contentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("document"), doc: richNode }),
  z.object({
    kind: z.literal("presentation"),
    theme: z.enum(["midnight", "paper", "ocean"]),
    slides: z
      .array(
        z.object({
          id: z.string().max(80),
          title: z.string().max(1000),
          body: z.string().max(20_000),
          layout: z.enum(["title", "content", "split"]),
          image: image.optional(),
          x: z.number().min(0).max(100).optional(),
          y: z.number().min(0).max(100).optional(),
        })
      )
      .min(1)
      .max(100),
  }),
  z.object({
    kind: z.literal("spreadsheet"),
    sheets: z
      .array(
        z.object({
          id: z.string().max(80),
          name: z.string().min(1).max(31),
          rows: z
            .array(
              z
                .array(
                  z.object({
                    value: z.string().max(10_000),
                    bold: z.boolean().optional(),
                    format: z
                      .enum(["text", "number", "currency", "percent"])
                      .optional(),
                  })
                )
                .max(100)
            )
            .max(2000),
        })
      )
      .min(1)
      .max(20),
  }),
]);
export function validateContent(input: unknown): FileContent {
  if (JSON.stringify(input).length > 8_000_000)
    throw new Error("File content exceeds the editing limit.");
  const content = contentSchema.parse(input);
  if (content.kind === "document") {
    if (content.doc.type !== "doc")
      throw new Error("Document root must be doc.");
    checkNode(content.doc);
  }
  return content;
}
export function emptyContent(kind: FileKind): FileContent {
  if (kind === "document")
    return { kind, doc: { type: "doc", content: [{ type: "paragraph" }] } };
  if (kind === "presentation")
    return {
      kind,
      theme: "midnight",
      slides: [
        {
          id: "slide-1",
          title: "Untitled presentation",
          body: "Add your story here.",
          layout: "title",
        },
      ],
    };
  return {
    kind,
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet 1",
        rows: Array.from({ length: 12 }, () =>
          Array.from({ length: 6 }, () => ({ value: "" }))
        ),
      },
    ],
  };
}
export function validateUpload(name: string, bytes: Uint8Array): FileKind {
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD)
    throw new Error("Upload a nonempty file up to 20 MB.");
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      throw new Error("This is not a PDF file.");
    return "document";
  }
  if (["docx", "pptx", "xlsx"].includes(ext ?? "")) {
    if (
      bytes[0] !== 0x50 ||
      bytes[1] !== 0x4b ||
      bytes[2] !== 3 ||
      bytes[3] !== 4
    )
      throw new Error("This is not a supported Office file.");
    return ext === "pptx"
      ? "presentation"
      : ext === "xlsx"
        ? "spreadsheet"
        : "document";
  }
  if (ext === "csv") {
    if (bytes.includes(0)) throw new Error("CSV must contain text.");
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "spreadsheet";
  }
  throw new Error("Choose a DOCX, PPTX, XLSX, CSV, or PDF file.");
}
export function mergeRevision(current: string, base: string) {
  return { conflict: current !== base, advance: current === base };
}
export function safeMessage(error: unknown): string {
  return error instanceof Error && error.name === "AbortError"
    ? "The request timed out. Try again."
    : "The operation could not finish. Your saved file is unchanged. Try again.";
}

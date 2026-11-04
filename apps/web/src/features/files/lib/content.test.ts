import { describe, it, expect } from "vitest";
import {
  emptyContent,
  validateContent,
  validateUpload,
  safeMessage,
  mergeRevision,
} from "./content";
describe("file content boundary", () => {
  it.each(["document", "presentation", "spreadsheet"] as const)(
    "accepts an empty %s",
    (kind) => expect(validateContent(emptyContent(kind)).kind).toBe(kind)
  );
  it("rejects arbitrary rich nodes and unsafe image URLs", () => {
    expect(() =>
      validateContent({
        kind: "document",
        doc: { type: "script", text: "bad" },
      })
    ).toThrow();
    expect(() =>
      validateContent({
        kind: "document",
        doc: {
          type: "doc",
          content: [{ type: "image", attrs: { src: "https://evil.test/a" } }],
        },
      })
    ).toThrow();
  });
  it("rejects oversized and forged uploads", () => {
    expect(() => validateUpload("a.pdf", new Uint8Array([1, 2]))).toThrow();
    expect(() =>
      validateUpload("a.csv", new Uint8Array(20 * 1024 * 1024 + 1))
    ).toThrow();
    expect(validateUpload("a.csv", new TextEncoder().encode("a,b\n1,2"))).toBe(
      "spreadsheet"
    );
  });
  it("keeps concurrent changes as a conflict revision", () => {
    expect(mergeRevision("current", "base")).toEqual({
      conflict: true,
      advance: false,
    });
    expect(mergeRevision("base", "base")).toEqual({
      conflict: false,
      advance: true,
    });
  });
  it("does not leak provider errors", () =>
    expect(safeMessage(new Error("secret key sk-123"))).not.toContain(
      "sk-123"
    ));
});

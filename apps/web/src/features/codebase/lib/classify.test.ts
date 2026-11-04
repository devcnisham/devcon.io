import { describe, expect, it } from "vitest";
import {
  LARGE_FILE_BYTES,
  isBinaryExtension,
  looksBinary,
  classifyFile,
} from "./classify";

describe("isBinaryExtension", () => {
  it("recognises common binary formats", () => {
    for (const name of [
      "logo.png",
      "a.pdf",
      "font.woff2",
      "app.zip",
      "x.mp4",
    ]) {
      expect(isBinaryExtension(name), name).toBe(true);
    }
  });

  it("treats source and text files as text", () => {
    for (const name of ["index.ts", "README.md", "style.css", "data.json"]) {
      expect(isBinaryExtension(name), name).toBe(false);
    }
  });

  it("is case-insensitive", () => {
    expect(isBinaryExtension("IMAGE.PNG")).toBe(true);
  });

  it("does not treat a dotfile as an extension", () => {
    expect(isBinaryExtension(".gitignore")).toBe(false);
  });
});

describe("looksBinary", () => {
  it("detects a NUL byte", () => {
    expect(looksBinary(new Uint8Array([0x68, 0x00, 0x69]))).toBe(true);
  });

  it("accepts plain ASCII text", () => {
    expect(looksBinary(new TextEncoder().encode("const a = 1;\n"))).toBe(false);
  });

  it("accepts UTF-8 text with accents and emoji", () => {
    expect(looksBinary(new TextEncoder().encode("café 🎉 déjà vu"))).toBe(
      false
    );
  });

  it("accepts an empty file", () => {
    expect(looksBinary(new Uint8Array([]))).toBe(false);
  });

  it("detects a high proportion of control bytes", () => {
    const noisy = new Uint8Array(64).fill(0x01);

    expect(looksBinary(noisy)).toBe(true);
  });

  it("tolerates tabs, newlines, and carriage returns", () => {
    expect(looksBinary(new TextEncoder().encode("a\tb\r\nc"))).toBe(false);
  });
});

describe("classifyFile", () => {
  it("indexes an ordinary source file", () => {
    const result = classifyFile({ path: "src/index.ts", size: 1024 });

    expect(result.action).toBe("index");
  });

  it("skips a file over the size threshold, with a reason", () => {
    const result = classifyFile({
      path: "data/dump.json",
      size: LARGE_FILE_BYTES + 1,
    });

    expect(result.action).toBe("skip");
    if (result.action === "skip") expect(result.reason).toBe("large");
  });

  it("skips a binary by extension without reading it", () => {
    const result = classifyFile({ path: "assets/logo.png", size: 10 });

    expect(result.action).toBe("skip");
    if (result.action === "skip") expect(result.reason).toBe("binary");
  });

  it("skips a binary detected from its content", () => {
    const result = classifyFile({
      path: "bin/mystery",
      size: 10,
      sample: new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x00]),
    });

    expect(result.action).toBe("skip");
    if (result.action === "skip") expect(result.reason).toBe("binary");
  });

  it("checks size before content, so a huge binary reports 'large'", () => {
    const result = classifyFile({
      path: "video.mp4",
      size: LARGE_FILE_BYTES + 1,
    });

    if (result.action === "skip") expect(result.reason).toBe("large");
  });

  it("indexes an empty file rather than calling it binary", () => {
    expect(classifyFile({ path: "empty.ts", size: 0 }).action).toBe("index");
  });
});

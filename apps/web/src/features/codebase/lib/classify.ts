/**
 * Decides what to do with a single file during a scan.
 *
 * Two independent binary checks: the extension, which is free, and a content
 * sample, which costs a read. Extension is tried first so most binaries never
 * get opened.
 */

/** Files above this are skipped — they are almost always data, not source. */
export const LARGE_FILE_BYTES = 1_000_000; // 1 MB

/** How many leading bytes are enough to judge a file's nature. */
export const SAMPLE_BYTES = 512;

const BINARY_EXTENSIONS = new Set([
  // images
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "ico",
  "webp",
  "avif",
  "tiff",
  "psd",
  // video and audio
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "mp3",
  "wav",
  "flac",
  "ogg",
  // archives and packages
  "zip",
  "tar",
  "gz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "jar",
  "war",
  // documents
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  // fonts
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  // compiled output and databases
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "class",
  "pyc",
  "wasm",
  "db",
  "sqlite",
  "sqlite3",
]);

export function isBinaryExtension(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");

  // No dot, or a leading dot with nothing after it (`.gitignore`), is not an
  // extension.
  if (dot <= 0) return false;

  return BINARY_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/**
 * Content heuristic, same shape git uses: a NUL byte means binary, and a high
 * proportion of control characters means binary even without one.
 *
 * UTF-8 multi-byte sequences are high-bit bytes, not control bytes, so accented
 * text and emoji pass cleanly.
 */
export function looksBinary(sample: Uint8Array): boolean {
  if (sample.length === 0) return false;

  let suspicious = 0;

  for (const byte of sample) {
    if (byte === 0x00) return true;

    // Control characters, excluding tab (0x09), newline (0x0a), form feed
    // (0x0c), and carriage return (0x0d).
    const isControl =
      (byte < 0x20 && ![0x09, 0x0a, 0x0c, 0x0d].includes(byte)) ||
      byte === 0x7f;

    if (isControl) suspicious++;
  }

  return suspicious / sample.length > 0.3;
}

export type SkipReason = "large" | "binary";

export type Classification =
  { action: "index" } | { action: "skip"; reason: SkipReason };

export function classifyFile(file: {
  path: string;
  size: number;
  /** First bytes, when already read. Omitted, only the extension is used. */
  sample?: Uint8Array;
}): Classification {
  // Size first: a 2 GB video is skipped as "large", which is the more useful
  // thing to tell someone than "binary".
  if (file.size > LARGE_FILE_BYTES) {
    return { action: "skip", reason: "large" };
  }

  if (isBinaryExtension(file.path)) {
    return { action: "skip", reason: "binary" };
  }

  if (file.sample && looksBinary(file.sample)) {
    return { action: "skip", reason: "binary" };
  }

  return { action: "index" };
}

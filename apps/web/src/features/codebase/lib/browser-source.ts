import type { ScanEntry, ScanSource } from "./scan";

/**
 * `ScanSource` implementations backed by the browser.
 *
 * Two paths, because browsers disagree:
 *
 * - **File System Access API** (`showDirectoryPicker`) — Chromium only. Grants
 *   a live handle to the folder, so a rescan re-reads the real directory.
 * - **Directory input** (`<input webkitdirectory>`) — everywhere else. The
 *   browser copies a snapshot of the files into the page; there is no handle,
 *   so **rescan is impossible** without asking the user to pick again.
 *
 * Neither uploads anything. Files are read in the page to build an index.
 */

/**
 * `FileSystemDirectoryHandle.entries()` is shipped in Chromium but missing from
 * TypeScript's DOM library, so it is declared here rather than reached for with
 * `any`.
 */
type DirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<
    [string, FileSystemDirectoryHandle | FileSystemFileHandle]
  >;
};

export function supportsDirectoryPicker(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** Live handle — supports rescan. */
export function createHandleSource(
  root: FileSystemDirectoryHandle
): ScanSource {
  async function* walkDirectory(
    directory: FileSystemDirectoryHandle,
    prefix: string
  ): AsyncGenerator<ScanEntry> {
    const iterable = directory as DirectoryHandleWithEntries;

    for await (const [name, handle] of iterable.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;

      if (handle.kind === "directory") {
        yield { path, size: 0, isDirectory: true };
        yield* walkDirectory(handle, path);
      } else {
        const file = await handle.getFile();
        yield { path, size: file.size, isDirectory: false };
      }
    }
  }

  async function fileAt(path: string): Promise<File> {
    const segments = path.split("/");
    const fileName = segments.pop();
    if (!fileName) throw new Error(`Invalid path: ${path}`);

    let directory = root;
    for (const segment of segments) {
      directory = await directory.getDirectoryHandle(segment);
    }

    return (await directory.getFileHandle(fileName)).getFile();
  }

  return {
    walk: () => walkDirectory(root, ""),
    async readSample(path) {
      const file = await fileAt(path);
      return new Uint8Array(await file.slice(0, 512).arrayBuffer());
    },
    async readText(path) {
      return (await fileAt(path)).text();
    },
  };
}

/** Snapshot from a directory input — no rescan. */
export function createFileListSource(files: FileList | File[]): ScanSource {
  const list = Array.from(files);

  // webkitRelativePath includes the picked folder as its first segment; drop it
  // so paths are relative to the project root, matching the handle source.
  const byPath = new Map(
    list.map((file) => [
      (file.webkitRelativePath || file.name).split("/").slice(1).join("/") ||
        file.name,
      file,
    ])
  );

  return {
    async *walk() {
      for (const [path, file] of byPath) {
        yield { path, size: file.size, isDirectory: false };
      }
    },
    async readSample(path) {
      const file = byPath.get(path);
      if (!file) throw new Error(`Not found: ${path}`);
      return new Uint8Array(await file.slice(0, 512).arrayBuffer());
    },
    async readText(path) {
      const file = byPath.get(path);
      if (!file) throw new Error(`Not found: ${path}`);
      return file.text();
    },
  };
}

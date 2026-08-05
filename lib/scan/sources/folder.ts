import { type FileSource, IGNORE_DIRS, isReadable } from "../source";

/**
 * A folder the user picked in their own browser.
 *
 * This is the one ingest path that works on a deployed URL AND keeps the
 * product's central promise literally true: the directory handle is a browser
 * capability, the walk happens in the page, and nothing but the derived digest
 * ever exists in JavaScript. No upload, no server, no token.
 *
 * Chromium only — `showDirectoryPicker` is not in Safari or Firefox. Callers
 * check `folderPickerAvailable()` and offer the file-drop source instead.
 */

interface FileSystemDirectoryHandleLike {
  name: string;
  entries(): AsyncIterableIterator<[string, FileSystemHandleLike]>;
}
interface FileSystemFileHandleLike {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}
type FileSystemHandleLike =
  | FileSystemFileHandleLike
  | ({ kind: "directory" } & FileSystemDirectoryHandleLike);

export function folderPickerAvailable(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** Bounded so a wrong folder — a home directory, say — can't hang the tab. */
const MAX_FILES = 20000;
const MAX_DEPTH = 8;

export async function pickFolder(): Promise<FileSource | null> {
  if (!folderPickerAvailable()) return null;
  const picker = (
    window as unknown as {
      showDirectoryPicker: (o?: {
        mode?: string;
      }) => Promise<FileSystemDirectoryHandleLike>;
    }
  ).showDirectoryPicker;

  let root: FileSystemDirectoryHandleLike;
  try {
    // Read-only: DevCon never writes to the project it is planning.
    root = await picker({ mode: "read" });
  } catch {
    return null; // The user dismissed the picker. Not an error.
  }
  return folderSource(root);
}

export function folderSource(root: FileSystemDirectoryHandleLike): FileSource {
  const files = new Map<string, FileSystemFileHandleLike>();
  let walked = false;

  async function walk(
    dir: FileSystemDirectoryHandleLike,
    prefix: string,
    depth: number,
  ): Promise<void> {
    if (depth > MAX_DEPTH || files.size > MAX_FILES) return;
    for await (const [name, handle] of dir.entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        // `.git` is walked for nothing else, but `.git/config` is how the real
        // repository gets named — so it is listed and then read selectively.
        if (IGNORE_DIRS.has(name) && name !== ".git") continue;
        if (name === ".git" && depth > 0) continue;
        await walk(handle, path, depth + 1);
      } else {
        files.set(path, handle);
      }
    }
  }

  const ensure = async () => {
    if (!walked) {
      await walk(root, "", 0);
      walked = true;
    }
  };

  return {
    label: root.name,
    name: root.name,
    async list() {
      await ensure();
      return [...files.keys()];
    },
    async read(path) {
      // The never-read rule, enforced before a handle is even opened.
      if (!isReadable(path)) return null;
      await ensure();
      const handle = files.get(path);
      if (!handle) return null;
      try {
        return await (await handle.getFile()).text();
      } catch {
        return null;
      }
    },
    async remote() {
      await ensure();
      const handle = files.get(".git/config");
      if (!handle) return null;
      try {
        const cfg = await (await handle.getFile()).text();
        return /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/.exec(cfg)?.[1] ?? null;
      } catch {
        return null;
      }
    },
  };
}

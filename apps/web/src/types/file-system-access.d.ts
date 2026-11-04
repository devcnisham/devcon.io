/**
 * File System Access API declarations.
 *
 * Shipped in Chromium, absent from TypeScript's DOM library. Declared here so
 * the import feature can call it without casting to `any` at the call site.
 */

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle | string;
}

interface Window {
  showDirectoryPicker?: (
    options?: DirectoryPickerOptions
  ) => Promise<FileSystemDirectoryHandle>;
}

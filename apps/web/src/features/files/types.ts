export type FileKind = "document" | "presentation" | "spreadsheet";
export type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
export type DocumentContent = { kind: "document"; doc: RichNode };
export type Slide = {
  id: string;
  title: string;
  body: string;
  layout: "title" | "content" | "split";
  image?: string;
  x?: number;
  y?: number;
};
export type PresentationContent = {
  kind: "presentation";
  theme: "midnight" | "paper" | "ocean";
  slides: Slide[];
};
export type SheetCell = {
  value: string;
  bold?: boolean;
  format?: "text" | "number" | "currency" | "percent";
};
export type WorkbookContent = {
  kind: "spreadsheet";
  sheets: { id: string; name: string; rows: SheetCell[][] }[];
};
export type FileContent =
  DocumentContent | PresentationContent | WorkbookContent;
export type WorkspaceFile = {
  id: string;
  projectId: string;
  name: string;
  kind: FileKind;
  currentRevisionId: string;
  updatedAt: string;
  originalPath?: string | null;
  originalName?: string | null;
  warnings: string[];
};
export type FileRevision = {
  id: string;
  fileId: string;
  parentId: string | null;
  content: FileContent;
  source: "manual" | "ai" | "import" | "restore";
  createdAt: string;
  conflict: boolean;
};
export type FileMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  fileId?: string | null;
  createdAt: string;
};
export type FileJob = {
  id: string;
  projectId: string;
  fileId?: string | null;
  revisionId?: string | null;
  kind: "generate" | "import" | "export";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  error?: string | null;
  result?: {
    fileId?: string;
    revisionId?: string;
    conflict?: boolean;
    downloadUrl?: string;
    warnings?: string[];
  };
  createdAt: string;
};
export type FileSnapshot = {
  files: WorkspaceFile[];
  messages: FileMessage[];
  jobs: FileJob[];
  canEdit: boolean;
  aiAvailable: boolean;
  workerAvailable: boolean;
};

/**
 * Public surface of the codebase feature.
 *
 * Phase 1.1: the ignore engine, file classification, and the scanner are
 * complete and tested against an injected filesystem. The browser adapters
 * read a real folder; nothing is uploaded and nothing is stored yet.
 */

export { ImportProject } from "./components/import-project";
export { InspectionSummary } from "./components/inspection-summary";
export { DetectionSummary } from "./components/detection-summary";
export { LanguageBreakdown } from "./components/language-breakdown";
export { ToolchainSummary } from "./components/toolchain-summary";
export { DependencySummary } from "./components/dependency-summary";

export {
  parseLockfile,
  type Lockfile,
  type LockedPackage,
} from "./lib/lockfiles";
export {
  buildDependencyReport,
  type DependencyReport,
  type DirectDependency,
  type DeprecatedPackage,
} from "./lib/dependency-report";

export {
  detectToolchain,
  type Toolchain,
  type DetectedCommand,
  type PackageManagerInfo,
} from "./lib/toolchain";

export {
  detectRuntimes,
  primaryRuntime,
  type RuntimeDetection,
} from "./lib/runtimes";

export {
  detectLanguage,
  languageBreakdown,
  LANGUAGES,
  type Language,
  type LanguageKind,
  type LanguageShare,
  type LanguageBreakdown as LanguageBreakdownData,
} from "./lib/languages";
export { analyzeProject, type ProjectAnalysis } from "./lib/analyze";

export {
  classifyRole,
  inspectIndex,
  FILE_ROLES,
  type FileRole,
  type InspectedFile,
  type InspectionSummary as InspectionSummaryData,
} from "./lib/inspect";

export {
  parseManifest,
  mergeDependencies,
  type Manifest,
  type Dependency,
  type Ecosystem,
  type MergedDependencies,
} from "./lib/dependencies";

export {
  detectFrameworks,
  detectArchitecture,
  detectFeatures,
  confidenceLabel,
  type Detection,
  type Architecture,
} from "./lib/detect";

export {
  fingerprint,
  diffIndex,
  MemoryScanCache,
  type ScanCache,
  type IndexSnapshot,
  type IndexDiff,
  type FileFingerprint,
} from "./lib/cache";

export {
  readGitInfo,
  parseGitHead,
  parseGitConfig,
  type GitInfo,
  type GitRemote,
} from "./lib/git-info";

export {
  scanProject,
  type ScanSource,
  type ScanEntry,
  type ScanResult,
  type ScanProgress,
  type ScanError,
  type IndexedFile,
  type SkippedFile,
} from "./lib/scan";

export {
  createIgnore,
  parseGitignore,
  DEFAULT_IGNORES,
  type Ignore,
} from "./lib/ignore";

export {
  classifyFile,
  isBinaryExtension,
  looksBinary,
  LARGE_FILE_BYTES,
  SAMPLE_BYTES,
  type Classification,
  type SkipReason,
} from "./lib/classify";

export {
  supportsDirectoryPicker,
  createHandleSource,
  createFileListSource,
} from "./lib/browser-source";

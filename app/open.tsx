import { CLONE_MESSAGE, CLONE_ROOT, type CloneError } from "@/lib/clone.ts";
import { pickerAvailable } from "@/lib/pick-folder.ts";
import { IMPORT_MESSAGE, type ImportError } from "@/lib/workspaces.ts";
import {
  cloneWorkspace,
  importWorkspace,
  openFolderDialog,
} from "./actions.ts";

/**
 * "Open or create" — the ways in.
 *
 * The panels are native `<details>`, so they open with no client JavaScript.
 * Anything still unbuilt says so on its own face; a control that looks live and
 * does nothing is the same lie as a ticked box with no command behind it.
 */

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0 text-[var(--color-muted)]"
    >
      <path d={d} />
    </svg>
  );
}

const PATHS = {
  plus: "M12 5v14M5 12h14",
  folder:
    "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  branch:
    "M6 3v12a3 3 0 0 0 3 3h6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
};

const CARD =
  "flex cursor-pointer list-none items-center gap-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/50 px-4 py-3 text-[13.5px] text-[var(--color-text)] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 [&::-webkit-details-marker]:hidden";
const PANEL =
  "mt-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/50 p-3";
const FIELD =
  "min-w-0 flex-1 rounded-lg border bg-black/30 px-3 py-2 font-mono text-[12.5px] text-[var(--color-text)] placeholder:text-[var(--color-muted)]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30";
const GO =
  "shrink-0 rounded-lg border border-[var(--color-line)] bg-white/[0.06] px-3.5 py-2 text-[13px] text-[var(--color-text)] transition-colors hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30";

export function OpenOrCreate({
  error,
  attempted,
  added,
  cloneError,
  attemptedUrl,
  pickError,
}: {
  error?: ImportError;
  attempted: string;
  added?: string;
  cloneError?: CloneError;
  attemptedUrl: string;
  pickError?: string;
}) {
  const native = pickerAvailable();

  return (
    <section>
      <h2 className="font-medium text-[var(--color-text)] text-lg tracking-tight">
        Open or create
      </h2>

      {added && (
        <p className="mt-3 text-[12.5px] text-[var(--color-pass)]">
          Opened <span className="font-mono">{added}</span>
        </p>
      )}
      {pickError && (
        <p className="mt-3 text-[12.5px] text-[var(--color-fail)]">
          {pickError === "unsupported"
            ? "The system dialog is macOS only. Type a path instead."
            : "The folder dialog could not be opened. Type a path instead."}
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {/* A real Finder window, opened by the server on this same Mac. The
            browser cannot do it: showDirectoryPicker is Chromium-only and
            never exposes an absolute path. */}
        <details open={Boolean(error)} className="min-w-0">
          <summary className={CARD}>
            <Icon d={PATHS.folder} />
            <span>Open folder</span>
          </summary>

          <div className={PANEL}>
            {native && (
              <form action={openFolderDialog}>
                <button type="submit" className={`${GO} w-full`}>
                  Choose in Finder…
                </button>
                <p className="mt-2 text-[11px] text-[var(--color-muted)]/75 leading-relaxed">
                  Opens on this Mac. If it does not come to the front, look
                  behind the browser window.
                </p>
              </form>
            )}

            <form
              action={importWorkspace}
              className={
                native ? "mt-3 border-[var(--color-line)] border-t pt-3" : ""
              }
            >
              <label
                htmlFor="path"
                className="block text-[12px] text-[var(--color-muted)]"
              >
                {native ? "Or type a path" : "Full path to the project folder"}
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  id="path"
                  type="text"
                  name="path"
                  defaultValue={attempted}
                  placeholder="~/code/my-college-project"
                  aria-invalid={error ? true : undefined}
                  className={`${FIELD} ${error ? "border-[var(--color-fail)]/50" : "border-[var(--color-line)]"}`}
                />
                <button type="submit" className={GO}>
                  Open
                </button>
              </div>
              {error && (
                <p className="mt-2 text-[12px] text-[var(--color-fail)]">
                  {IMPORT_MESSAGE[error] ?? "That path could not be opened."}
                </p>
              )}
            </form>
          </div>
        </details>

        <details open={Boolean(cloneError)} className="min-w-0">
          <summary className={CARD}>
            <Icon d={PATHS.branch} />
            <span>Clone repo</span>
          </summary>

          <form action={cloneWorkspace} className={PANEL}>
            <label
              htmlFor="url"
              className="block text-[12px] text-[var(--color-muted)]"
            >
              Repository URL
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="url"
                type="text"
                name="url"
                defaultValue={attemptedUrl}
                placeholder="https://github.com/user/project"
                aria-invalid={cloneError ? true : undefined}
                className={`${FIELD} ${cloneError ? "border-[var(--color-fail)]/50" : "border-[var(--color-line)]"}`}
              />
              <button type="submit" className={GO}>
                Clone
              </button>
            </div>

            {cloneError && (
              <p className="mt-2 text-[12px] text-[var(--color-fail)]">
                {CLONE_MESSAGE[cloneError]}
              </p>
            )}

            <p className="mt-2 text-[11px] text-[var(--color-muted)]/75 leading-relaxed">
              Clones into <span className="font-mono">{CLONE_ROOT}</span>. Only{" "}
              <span className="font-mono">https://</span> and{" "}
              <span className="font-mono">git@host:path</span> are accepted —
              git treats some other URL forms as commands to run.
            </p>
          </form>
        </details>

        <a href="/work" className={CARD}>
          <Icon d={PATHS.plus} />
          <span>New workspace</span>
        </a>

        <details className="min-w-0">
          <summary className={CARD}>
            <Icon d={PATHS.link} />
            <span>Open from link</span>
            <span className="ml-auto text-[11px] text-[var(--color-muted)]/70">
              not wired
            </span>
          </summary>
          <p className="mt-2 rounded-xl border border-[var(--color-line)] border-dashed px-4 py-3 text-[12.5px] text-[var(--color-muted)] leading-relaxed">
            A share link would point at a project on someone else&rsquo;s
            machine. There are no accounts and nothing is hosted, so there is
            nothing for a link to resolve to — use Clone repo.
          </p>
        </details>
      </div>
    </section>
  );
}

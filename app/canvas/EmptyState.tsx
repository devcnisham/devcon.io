"use client";

/**
 * What the canvas shows before a project is loaded.
 *
 * There used to be three sample profiles here, so the first thing anyone saw
 * was a fully-rendered plan for a library management system they had never
 * heard of. It demoed well and taught the wrong thing: DevCon's claim is that
 * it reads YOUR project, and a convincing plan for a project that doesn't exist
 * undercuts that before the user has done anything.
 */
export function EmptyState({
  onOpen,
  hasDevScan,
}: {
  onOpen: () => void;
  /** The local-path scanner only exists in development. */
  hasDevScan: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-8">
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/12 bg-neutral-950/80 p-7 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-neutral-50">
          Point DevCon at a real project
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          It reads structure only — dependency names, directories, and the key
          NAMES in <code className="font-mono text-amber-300/90">.env.example</code>.
          Never <code className="font-mono text-amber-300/90">.env</code>, never
          your source, never a key value.
        </p>

        <button
          type="button"
          onClick={onOpen}
          className="mt-5 w-full rounded-xl border border-sky-400/40 bg-sky-400/15 px-4 py-2.5 text-sm font-medium text-sky-100 transition-colors hover:bg-sky-400/25"
        >
          Open a project
        </button>

        <ul className="mt-5 space-y-2 text-xs leading-relaxed text-neutral-500">
          <li>
            <span className="text-neutral-300">Pick a folder</span> — read in
            your browser, on your machine. Nothing is uploaded.
          </li>
          <li>
            <span className="text-neutral-300">Paste a public GitHub repo</span>{" "}
            — read over the public API, no sign-in.
          </li>
          <li>
            <span className="text-neutral-300">Drop files</span> —{" "}
            <code className="font-mono">package.json</code> and{" "}
            <code className="font-mono">.env.example</code> are enough to start.
          </li>
          {hasDevScan ? (
            <li>
              <span className="text-neutral-300">Type a local path</span> —
              development only; the route 404s in production by design.
            </li>
          ) : null}
        </ul>

        <p className="mt-5 border-t border-white/8 pt-4 text-[11px] leading-relaxed text-neutral-600">
          No sample project is included. Nothing here has been through a real
          cohort yet, and the prompts have not been verified against a live
          agent — the plan you get is the catalog's judgement, not a measured
          result.
        </p>
      </div>
    </div>
  );
}

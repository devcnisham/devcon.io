import { Empty, Shell } from "../shell";

/**
 * Empty canvas.
 *
 * Full-bleed and scroll-free on purpose: whatever goes here owns the viewport
 * rather than sitting in a column. The dotted ground is the only thing drawn,
 * so the area reads as a surface rather than as a page that failed to load.
 */
export default function Canvas() {
  return (
    <Shell here="/canvas" bleed>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      {/**
       * `absolute inset-0`, not `h-full`.
       *
       * A percentage height on a flex child does not reliably resolve, so
       * `h-full` here collapsed to the content height and pinned the label to
       * the top of the canvas instead of centring it. v0.1 hit the identical
       * bug and wrote the fix down; this is the first thing the archive has
       * actually been useful for.
       */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Empty label="canvas" />
      </div>
    </Shell>
  );
}

import { Empty } from "../../shell";
import { ViewTabs } from "../views";

/**
 * Empty canvas. Fills what is left below the tabs and does not scroll.
 */
export default function Canvas() {
  return (
    <>
      <ViewTabs active="canvas" />
      <div className="relative min-h-0 flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        {/* `absolute inset-0`, not `h-full` — a percentage height on a flex
            child does not reliably resolve, which pinned this label to the top.
            v0.1 hit the identical bug and wrote the fix down. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Empty label="canvas" />
        </div>
      </div>
    </>
  );
}

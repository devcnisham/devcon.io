import { ViewTabs } from "../views";

/**
 * Empty canvas.
 *
 * Cleared on request — not even a label. The ground is drawn by the layout.
 *
 * One thing this loses, recorded because it was found by clicking rather than
 * reading: with nothing on screen, switching to this view moves the tab
 * highlight and changes nothing else, which reads as a link that failed rather
 * than a navigation that worked. The label existed for that reason. The tabs
 * stay, so the way out is still here.
 */
export default function Canvas() {
  return (
    <>
      <ViewTabs active="canvas" />
      <div className="min-h-0 flex-1" />
    </>
  );
}

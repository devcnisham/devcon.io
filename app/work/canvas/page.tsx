import { Empty } from "@/app/shell";
import { ViewTabs } from "../views";

/**
 * Empty canvas.
 *
 * The ground is drawn by the layout; this adds nothing yet — but it says so.
 * Rendering literally nothing made switching to this view look like a broken
 * link: the tab highlight moved and the screen was otherwise identical, so a
 * navigation that had worked read as one that had failed.
 */
export default function Canvas() {
  return (
    <>
      <ViewTabs active="canvas" />
      <div className="flex min-h-0 flex-1 items-center justify-center pt-16">
        <Empty label="canvas — nothing here yet" />
      </div>
    </>
  );
}

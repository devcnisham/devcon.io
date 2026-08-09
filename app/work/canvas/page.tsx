import { ViewTabs } from "../views";

/** Empty canvas. The ground is drawn by the layout; this adds nothing yet. */
export default function Canvas() {
  return (
    <>
      <ViewTabs active="canvas" />
      <div className="min-h-0 flex-1" />
    </>
  );
}

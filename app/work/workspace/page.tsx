import { ViewTabs } from "../views";

/**
 * Empty workspace.
 *
 * The rail is the decision this shell exists to test — a narrow column beside
 * a wide one. It is translucent rather than filled so the ground shows
 * through, which is what makes it read as a panel over the surface rather than
 * a second page.
 */
export default function Workspace() {
  return (
    <>
      <ViewTabs active="workspace" />
      <div className="grid min-h-0 flex-1 pt-16 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-white/[0.06] px-5 lg:border-r" />
        <section className="min-h-0" />
      </div>
    </>
  );
}

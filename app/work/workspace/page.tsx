import { Empty } from "../../shell";
import { ViewTabs } from "../views";

/**
 * Empty workspace.
 *
 * Two columns, because that is the decision this shell exists to test: a
 * narrow rail beside a wide area. Both are empty. If nothing earns a permanent
 * 14rem, the split is wrong and it is cheapest to find that out now.
 */
export default function Workspace() {
  return (
    <>
      <ViewTabs active="workspace" />
      <div className="grid min-h-0 flex-1 overflow-auto lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-b border-[var(--color-line)] px-5 py-5 lg:border-r lg:border-b-0 lg:px-6">
          <Empty label="rail" />
        </aside>
        <section className="flex items-center px-5 py-10 sm:px-8">
          <Empty label="workspace" />
        </section>
      </div>
    </>
  );
}

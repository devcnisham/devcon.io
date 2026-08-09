import { Empty, Shell } from "../shell";

/**
 * Empty workspace.
 *
 * Two columns, because that is the decision this shell exists to test: a
 * narrow rail beside a wide area. Both are empty. If the rail turns out to
 * hold nothing worth a permanent 14rem, the split is wrong and it is cheaper
 * to find that out now.
 */
export default function Workspace() {
  return (
    <Shell here="/workspace">
      <div className="grid min-h-[70vh] lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-b border-[var(--color-line)] px-5 py-5 lg:border-r lg:border-b-0 lg:px-6">
          <Empty label="rail" />
        </aside>
        <section className="flex items-center px-5 py-10 sm:px-8">
          <Empty label="workspace" />
        </section>
      </div>
    </Shell>
  );
}

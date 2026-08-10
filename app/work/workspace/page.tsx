import { Empty } from "@/app/shell";
import { ViewTabs } from "../views";

/**
 * Empty workspace.
 *
 * Cleared on request. What was here — the spec rendered with a live verdict,
 * command and evidence per condition, the drift banner, and the filter — is in
 * git at `45ae91e`, not lost.
 *
 * `lib/ship/` is untouched and still tested: the parser, the checker, its
 * sandbox and the cache all work and are covered by 51 assertions. Nothing
 * currently calls `checkedSpec`, `tally`, `lies` or `filterSpec` — they are
 * waiting, not dead, and deleting them would throw away the only part of this
 * repo that has been attacked and mutation-verified.
 */
export default function Workspace() {
  return (
    <>
      <ViewTabs active="workspace" />
      <div className="flex min-h-0 flex-1 items-center justify-center pt-16">
        <Empty label="workspace — nothing here yet" />
      </div>
    </>
  );
}

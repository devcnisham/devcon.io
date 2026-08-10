import { ageLabel, checkedSpec } from "@/lib/ship/cache.ts";
import { lies, tally } from "@/lib/ship/check.ts";
import { ViewTabs } from "../views";
import { Assumptions, Condition, Count, Cuts, Drift } from "./spec";

/**
 * The workspace: this repo's `SHIP.md`, checked.
 *
 * The first thing in v2 that runs `lib/ship/` rather than just containing it.
 * Every condition's verdict on this page came from executing its command a
 * moment ago, inside the sandbox — nothing here is read off the file's ticks.
 *
 * `force-dynamic` is not a preference. Without it Next prerenders this at build
 * time, which would run `pnpm exec tsc` from inside `next build` — the same
 * class of collision that made `pnpm build` fight the dev server over `.next`
 * and fail a build that was fine.
 */
export const dynamic = "force-dynamic";

export default async function Workspace() {
  const root = process.cwd();
  // Shared with the canvas — running every command once per view put the round
  // trip between them at roughly thirteen seconds each way.
  const result = await checkedSpec(root);

  if (!result) {
    return (
      <>
        <ViewTabs active="workspace" />
        <div className="flex min-h-0 flex-1 items-center justify-center pt-16">
          <p className="max-w-sm text-center text-[13.5px] text-[var(--color-muted)]">
            No <span className="font-mono">SHIP.md</span> in{" "}
            <span className="font-mono">{root}</span>. That file is the whole
            interface — one sentence, what you are cutting, and the conditions
            that decide when it is done.
          </p>
        </div>
      </>
    );
  }

  const { spec, checked, at } = result;
  const t = tally(checked);
  const drift = lies(checked);

  return (
    <>
      <ViewTabs active="workspace" />
      <div className="grid flex-1 pt-16 lg:min-h-0 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* The rail. Translucent rather than filled so the ground shows
            through — a panel over the surface, not a second page. */}
        <aside className="px-5 pb-10 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-[var(--color-line)]">
          <h1 className="font-medium text-[13px] text-[var(--color-text)]">
            {spec.name}
          </h1>
          <p className="mt-2 text-[12.5px] text-[var(--color-muted)] leading-relaxed">
            {spec.shipping}
          </p>

          <div className="mt-6 border-[var(--color-line)] border-t pt-3">
            <Count label="passing" n={t.pass} />
            <Count label="failing" n={t.fail} verdict="fail" />
            <Count label="errored" n={t.error} />
            <Count label="yours to call" n={t.human} />
            <div className="mt-2 border-[var(--color-line)] border-t pt-2">
              <Count label="conditions" n={t.total} />
            </div>
          </div>

          {/* The age, not "just now". These verdicts are shared with the canvas
              and may be seconds old; saying otherwise would be the exact kind
              of unchecked claim this page exists to catch. */}
          <p className="mt-6 text-[11.5px] text-[var(--color-muted)] leading-relaxed">
            {t.pass + t.fail + t.error === 0
              ? "No condition here carries a command, so none of this is evidence."
              : `Every verdict above came from running its command, sandboxed — checked ${ageLabel(at)}.`}
          </p>

          <p className="mt-3 text-[11.5px] text-[var(--color-muted)]">
            Deadline: {spec.deadline ?? "none"}
          </p>
        </aside>

        <section className="px-6 pb-10 lg:min-h-0 lg:overflow-y-auto lg:px-10">
          <div className="mx-auto max-w-2xl">
            <Drift lying={drift} />

            <h2 className="font-medium text-[11px] text-[var(--color-muted)] uppercase tracking-[0.14em]">
              Done when
            </h2>
            <ul className="mt-2">
              {checked.map((c) => (
                <Condition key={c.text} c={c} />
              ))}
            </ul>

            <Cuts cuts={spec.cuts} />
            <Assumptions assumptions={spec.assumptions} />
          </div>
        </section>
      </div>
    </>
  );
}

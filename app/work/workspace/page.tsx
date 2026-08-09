import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkAll, lies, tally } from "@/lib/ship/check.ts";
import { parseSpec } from "@/lib/ship/parse.ts";
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

  let md: string | null = null;
  try {
    md = await readFile(join(root, "SHIP.md"), "utf8");
  } catch {
    md = null;
  }

  if (!md) {
    return (
      <>
        <ViewTabs active="workspace" />
        <div className="flex min-h-0 flex-1 items-center justify-center pt-16">
          <p className="max-w-sm text-center text-[13.5px] text-neutral-500">
            No <span className="font-mono text-neutral-400">SHIP.md</span> in{" "}
            <span className="font-mono text-neutral-400">{root}</span>. That
            file is the whole interface — one sentence, what you are cutting,
            and the conditions that decide when it is done.
          </p>
        </div>
      </>
    );
  }

  const spec = parseSpec(md);
  const checked = await checkAll(spec.conditions, root);
  const t = tally(checked);
  const drift = lies(checked);

  return (
    <>
      <ViewTabs active="workspace" />
      <div className="grid min-h-0 flex-1 pt-16 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* The rail. Translucent rather than filled so the ground shows
            through — a panel over the surface, not a second page. */}
        <aside className="min-h-0 overflow-y-auto border-white/[0.06] px-5 pb-10 lg:border-r">
          <h1 className="font-medium text-[13px] text-neutral-200">
            {spec.name}
          </h1>
          <p className="mt-2 text-[12.5px] text-neutral-500 leading-relaxed">
            {spec.shipping}
          </p>

          <div className="mt-6 border-white/[0.06] border-t pt-3">
            <Count label="passing" n={t.pass} />
            <Count label="failing" n={t.fail} verdict="fail" />
            <Count label="errored" n={t.error} />
            <Count label="yours to call" n={t.human} />
            <div className="mt-2 border-white/[0.06] border-t pt-2">
              <Count label="conditions" n={t.total} />
            </div>
          </div>

          <p className="mt-6 text-[11.5px] text-neutral-600 leading-relaxed">
            {t.pass + t.fail + t.error === 0
              ? "No condition here carries a command, so none of this is evidence."
              : "Every verdict above came from running its command just now, sandboxed."}
          </p>

          <p className="mt-3 text-[11.5px] text-neutral-600">
            Deadline: {spec.deadline ?? "none"}
          </p>
        </aside>

        <section className="min-h-0 overflow-y-auto px-6 pb-10 lg:px-10">
          <div className="mx-auto max-w-2xl">
            <Drift lying={drift} />

            <h2 className="font-medium text-[11px] text-neutral-500 uppercase tracking-[0.14em]">
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

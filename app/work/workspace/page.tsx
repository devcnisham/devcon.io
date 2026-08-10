import { detectProject, gaps } from "@/lib/detect.ts";
import { ageLabel, checkedSpec } from "@/lib/ship/cache.ts";
import { lies, tally } from "@/lib/ship/check.ts";
import { filterSpec, oneParam } from "@/lib/ship/search.ts";
import { getActive } from "@/lib/workspaces.ts";
import { ViewTabs } from "../views";
import {
  ConditionCard,
  Count,
  CutCard,
  Drift,
  NoProject,
  NoSpec,
} from "./spec-cards";

/**
 * The workspace — the open project's `SHIP.md`, checked.
 *
 * This is the first thing in v2 that runs `lib/ship/` against a project that is
 * **not this repo**, which is the whole reason the sandbox exists: the commands
 * come out of a markdown file in a folder someone else may have written.
 *
 * `force-dynamic` is load-bearing. Without it Next prerenders this route and
 * runs the project's checks during `next build`.
 */
export const dynamic = "force-dynamic";

export default async function Workspace({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const [project, params] = await Promise.all([getActive(), searchParams]);
  const query = oneParam(params.q);

  if (!project) {
    return (
      <>
        <ViewTabs active="workspace" />
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 pt-20">
          <NoProject />
        </div>
      </>
    );
  }

  const result = await checkedSpec(project.path);

  if (!result) {
    const detected = await detectProject(project.path);
    return (
      <>
        <ViewTabs active="workspace" project={project.name} />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-20 pb-10 lg:px-10">
          <NoSpec name={project.name} gaps={gaps(detected)} />
        </div>
      </>
    );
  }

  const { spec, checked, at } = result;
  const t = tally(checked);
  // From the full set, never the filtered one. Hiding a ticked box that its own
  // check disagrees with — because a search happened not to match it — would
  // suppress the most important thing this page says.
  const drift = lies(checked);
  const found = filterSpec(spec, checked, query);

  return (
    <>
      <ViewTabs active="workspace" project={project.name} />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-20 pb-12 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-medium text-[var(--color-text)] text-lg tracking-tight">
            {spec.name}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] text-[var(--color-muted)] leading-relaxed">
            {spec.shipping}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Count
              n={t.pass}
              label="passing"
              hint="a command exited 0"
              tone={t.pass > 0 ? "pass" : "text"}
            />
            <Count
              n={t.fail}
              label="failing"
              hint="ran, and said no"
              tone={t.fail > 0 ? "fail" : "text"}
            />
            <Count
              n={t.error}
              label="errored"
              hint="never answered — re-run"
              tone={t.error > 0 ? "cut" : "text"}
            />
            <Count n={t.human} label="yours to call" hint="no command to run" />
          </div>

          <p className="mt-3 text-[11.5px] text-[var(--color-muted)]/80">
            {t.pass + t.fail + t.error === 0
              ? "No condition here carries a command, so none of this is evidence."
              : `Every verdict came from running its command in the sandbox — checked ${ageLabel(at)}.`}
            {spec.deadline && ` · Deadline: ${spec.deadline}`}
          </p>

          <div className="mt-6">
            <Drift lying={drift} />
          </div>

          <form
            method="get"
            action="/work/workspace"
            className="mt-6 flex gap-2"
          >
            <input
              type="search"
              name="q"
              defaultValue={found.query}
              placeholder="Filter conditions, cuts and assumptions"
              aria-label="Filter this spec"
              className="min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-black/25 px-3 py-2 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-muted)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl border border-[var(--color-line)] bg-white/[0.04] px-3.5 py-2 text-[13.5px] text-[var(--color-text)] transition-colors hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Filter
            </button>
          </form>

          {found.query && (
            <p className="mt-2 text-[12.5px] text-[var(--color-muted)]">
              {found.matches === 0
                ? "Nothing matches"
                : `${found.matches} of ${found.total} shown`}{" "}
              for “{found.query}”{" "}
              <a
                href="/work/workspace"
                className="underline underline-offset-4 hover:text-[var(--color-text)]"
              >
                clear
              </a>
            </p>
          )}

          {found.matches === 0 ? (
            <p className="mt-8 text-[13.5px] text-[var(--color-muted)] leading-relaxed">
              Nothing mentions “{found.query}”. The filter searches each
              condition&rsquo;s text, its command and its evidence — so an error
              string from the output will find the row that produced it.
            </p>
          ) : (
            <>
              {found.conditions.length > 0 && (
                <section className="mt-8">
                  <h2 className="font-medium text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
                    Done when
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {found.conditions.map((c) => (
                      <ConditionCard key={c.text} c={c} />
                    ))}
                  </ul>
                </section>
              )}

              {found.cuts.length > 0 && (
                <section className="mt-10">
                  <h2 className="font-medium text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
                    Not shipping — {found.cuts.length}
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {found.cuts.map((c) => (
                      <CutCard key={c.thing} cut={c} />
                    ))}
                  </ul>
                </section>
              )}

              {found.assumptions.length > 0 && (
                <section className="mt-10">
                  <h2 className="font-medium text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
                    Assumptions
                  </h2>
                  <p className="mt-1.5 text-[12.5px] text-[var(--color-muted)]/80">
                    If one of these is wrong, the spec is wrong — not the build.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {found.assumptions.map((a) => (
                      <li
                        key={a}
                        className="rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/40 px-3.5 py-3 text-[13.5px] text-[var(--color-muted)] leading-relaxed"
                      >
                        {a}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

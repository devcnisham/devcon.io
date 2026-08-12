import {
  byCapability,
  CAPABILITY_LABEL,
  coverage,
  detectConnectors,
  filterConnectors,
} from "@/lib/connectors.ts";
import { listProjects } from "@/lib/projects.ts";
import { oneParam } from "@/lib/ship/search.ts";
import { Stat } from "../cards";
import {
  ConnectorRow,
  CoveredCapability,
  MissingCapability,
} from "../connector-cards";
import { HomeShell } from "../home-shell";

/**
 * Integrations — the services this project uses, and the ones it has nothing
 * for.
 *
 * Everything is read from the project's `package.json` as the page renders.
 * "Installed" means a package is present; it does **not** mean the service
 * works. Only a runnable check could say that, and there is not one yet, so
 * nothing here claims it.
 */
export const dynamic = "force-dynamic";

export default async function Connectors({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = oneParam((await searchParams).q);

  // The most recently opened project, falling back to this repo.
  const [recent] = await listProjects();
  const target = recent?.path ?? process.cwd();

  const all = await detectConnectors(target);
  const cover = coverage(all);
  const missing = cover.filter((c) => c.installed.length === 0);
  const covered = cover.filter((c) => c.installed.length > 0);

  const { items } = filterConnectors(all, query);
  const installed = items.filter((c) => c.installed);
  const groups = byCapability(items.filter((c) => !c.installed));

  return (
    <HomeShell here="/connectors" title="Integrations">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          n={all.length}
          label="integrations"
          hint="services devcon knows about"
        />
        <Stat
          n={installed.length}
          label="installed here"
          hint="a package is in the dependencies"
          tone={installed.length > 0 ? "pass" : "text"}
        />
        <Stat
          n={`${covered.length}/${cover.length}`}
          label="capabilities covered"
          hint="database, auth, hosting and the rest"
          tone={missing.length > 0 ? "cut" : "pass"}
        />
        <Stat
          n={all.filter((c) => c.mcp).length}
          label="with MCP"
          hint="the agent can drive these directly"
        />
      </div>

      <p className="mt-3 text-[11.5px] text-[var(--color-muted)]">
        Reading <span className="font-mono">{target}</span>
      </p>

      {missing.length > 0 && (
        <section className="mt-10">
          <h2 className="font-medium text-[var(--color-text)] text-lg tracking-tight">
            Nothing covers these yet
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--color-muted)]">
            Read from this project&rsquo;s dependencies, not from a list of
            things every project ought to have.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {missing.map((row) => (
              <MissingCapability key={row.capability} row={row} />
            ))}
          </ul>
        </section>
      )}

      {covered.length > 0 && (
        <section className="mt-10">
          <h2 className="font-medium text-[var(--color-text)] text-lg tracking-tight">
            Covered
          </h2>
          <ul className="mt-4 space-y-2">
            {covered.map((row) => (
              <CoveredCapability key={row.capability} row={row} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="font-medium text-[var(--color-text)] text-lg tracking-tight">
          All integrations
        </h2>

        <form method="get" action="/connectors" className="mt-4">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search integrations…"
            aria-label="Search integrations"
            className="w-full rounded-xl border border-[var(--color-line)] bg-black/25 px-4 py-3 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-muted)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          />
        </form>

        {query && (
          <p className="mt-2 text-[12px] text-[var(--color-muted)]">
            {items.length} of {all.length} match “{query}”{" "}
            <a
              href="/connectors"
              className="underline underline-offset-4 hover:text-[var(--color-text)]"
            >
              clear
            </a>
          </p>
        )}

        {installed.length > 0 && (
          <div className="mt-6">
            <h3 className="font-mono text-[11px] text-[var(--color-pass)] uppercase tracking-[0.16em]">
              Installed · {installed.length}
            </h3>
            <ul className="mt-3 space-y-2">
              {installed.map((c) => (
                <ConnectorRow key={c.id} c={c} />
              ))}
            </ul>
          </div>
        )}

        {groups.map(([capability, list]) => (
          <div key={capability} className="mt-6">
            <h3 className="font-mono text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
              {CAPABILITY_LABEL[capability]}
            </h3>
            <ul className="mt-3 space-y-2">
              {list.map((c) => (
                <ConnectorRow key={c.id} c={c} />
              ))}
            </ul>
          </div>
        ))}

        {items.length === 0 && (
          <p className="mt-6 text-[13.5px] text-[var(--color-muted)]">
            Nothing matches “{query}”.
          </p>
        )}
      </section>

      <p className="mt-10 text-[11.5px] text-[var(--color-muted)]/80 leading-relaxed">
        devcon never asks for, shows or stores an API key. Each panel names the
        environment variables a service needs; the values go in your{" "}
        <span className="font-mono">.env.local</span>, which is gitignored.
        Connecting is not wired up — no OAuth, no token exchange, no MCP config
        written.
      </p>
    </HomeShell>
  );
}

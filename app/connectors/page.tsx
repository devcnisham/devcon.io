import {
  byCapability,
  CAPABILITY_LABEL,
  type ConnectorState,
  detectConnectors,
  filterConnectors,
} from "@/lib/connectors.ts";
import { oneParam } from "@/lib/ship/search.ts";
import { listWorkspaces } from "@/lib/workspaces.ts";
import { HomeShell } from "../home-shell";

/**
 * Integrations — the services this project uses.
 *
 * "Installed" is read from the project's `package.json`, so it is evidence
 * rather than a checkbox someone ticked. It says the package is present; it
 * does **not** say the thing works. Only a runnable check can say that, and
 * that check is not built, so nothing here says "connected" on its own
 * authority.
 */
export const dynamic = "force-dynamic";

export default async function Connectors({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const query = oneParam((await searchParams).q);

  // The most recently opened project, falling back to this repo.
  const [recent] = await listWorkspaces();
  const target = recent?.path ?? process.cwd();

  const all = await detectConnectors(target);
  const { items } = filterConnectors(all, query);
  const installed = items.filter((c) => c.installed);
  const groups = byCapability(items.filter((c) => !c.installed));

  return (
    <HomeShell
      here="/connectors"
      title="Integrations"
      intro="The services this project uses, and what each one needs before it will work."
    >
      <form method="get" action="/connectors">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search integrations…"
          aria-label="Search integrations"
          className="w-full rounded-xl border border-[var(--color-line)] bg-black/25 px-4 py-3 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-muted)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        />
      </form>

      <p className="mt-3 text-[11.5px] text-[var(--color-muted)]">
        Reading <span className="font-mono">{target}</span>
        {query && (
          <>
            {" · "}
            {items.length} of {all.length} match “{query}”{" "}
            <a
              href="/connectors"
              className="underline underline-offset-4 hover:text-[var(--color-text)]"
            >
              clear
            </a>
          </>
        )}
      </p>

      {installed.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono text-[11px] text-[var(--color-pass)] uppercase tracking-[0.16em]">
            Installed · {installed.length}
          </h2>
          <ul className="mt-3 space-y-2">
            {installed.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        </section>
      )}

      {groups.map(([capability, list]) => (
        <section key={capability} className="mt-8">
          <h2 className="font-mono text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
            {CAPABILITY_LABEL[capability]}
          </h2>
          <ul className="mt-3 space-y-2">
            {list.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </ul>
        </section>
      ))}

      {items.length === 0 && (
        <p className="mt-8 text-[13.5px] text-[var(--color-muted)]">
          Nothing matches “{query}”.
        </p>
      )}

      <p className="mt-10 text-[11.5px] text-[var(--color-muted)]/80 leading-relaxed">
        devcon never asks for, shows or stores an API key. Each panel names the
        environment variables a service needs; the values go in your{" "}
        <span className="font-mono">.env.local</span>, which is gitignored.
      </p>
    </HomeShell>
  );
}

/**
 * One integration.
 *
 * "Connect" opens setup rather than starting an OAuth flow — there is no token
 * exchange, and a button that claimed to connect without one would be the
 * ticked box with nothing behind it.
 */
function Row({ c }: { c: ConnectorState }) {
  return (
    <li
      className={`rounded-xl border ${
        c.installed
          ? "border-[var(--color-pass)]/40 bg-[var(--color-pass)]/[0.05]"
          : "border-[var(--color-line)] bg-[var(--color-raised)]/50"
      }`}
    >
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className={`grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${c.tile} font-medium text-[15px] text-white/90`}
          >
            {c.name[0]}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[14px] text-[var(--color-text)]">
                {c.name}
              </span>
              {c.mcp && (
                <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)]">
                  MCP
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[12.5px] text-[var(--color-muted)]">
              {c.what} · {c.tier}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-2">
            {/* Inside the summary on purpose, so the docs are reachable without
                opening the panel. target=_blank, so the toggle it also triggers
                is harmless. */}
            <a
              href={c.docs}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-muted)] transition-colors hover:border-[var(--color-muted)]/50 hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Docs ↗
            </a>
            <span
              className={`rounded-lg border px-3 py-1.5 text-[13px] ${
                c.installed
                  ? "border-[var(--color-pass)]/40 text-[var(--color-pass)]"
                  : "border-[var(--color-line)] text-[var(--color-text)]"
              }`}
            >
              {c.installed ? "Installed" : "Connect"}
            </span>
          </span>
        </summary>

        <div className="border-[var(--color-line)] border-t px-4 py-3">
          {c.env.length > 0 ? (
            <>
              <p className="text-[11.5px] text-[var(--color-muted)]">
                Environment variables — names only, values go in{" "}
                <span className="font-mono">.env.local</span>
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {c.env.map((e) => (
                  <li
                    key={e}
                    className="font-mono text-[11.5px] text-[var(--color-text)]/85 [overflow-wrap:anywhere]"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[11.5px] text-[var(--color-muted)]">
              No keys or accounts needed.
            </p>
          )}

          <p className="mt-3 text-[11px] text-[var(--color-muted)]/70 leading-relaxed">
            {c.installed
              ? "The package is in this project's dependencies. That is not proof it works — a runnable check would be, and that is not built yet."
              : "No OAuth or token exchange is wired up. This tells you what the service needs; you set it up."}
          </p>
        </div>
      </details>
    </li>
  );
}

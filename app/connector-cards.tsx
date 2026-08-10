import type { ConnectorState, Coverage } from "@/lib/connectors.ts";

/**
 * The integrations page's pieces.
 *
 * Every state on these is read from the project's `package.json` a moment ago.
 * "Installed" means a package is present — nothing here claims a service
 * *works*, because only a runnable check could say that and there is not one
 * yet.
 */

/** The letter tile. A logo would mean shipping eleven trademarks. */
function Tile({ c, small = false }: { c: ConnectorState; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-lg bg-gradient-to-br font-medium text-white/90 ${c.tile} ${
        small ? "size-6 text-[11px]" : "size-9 text-[15px]"
      }`}
    >
      {c.name[0]}
    </span>
  );
}

/**
 * A capability with nothing installed.
 *
 * This is the half of the page worth reading. "No database" read off a
 * `package.json` is a fact about this project; "you should pick a database"
 * fits every project and helps none of them.
 */
export function MissingCapability({ row }: { row: Coverage }) {
  return (
    <li className="rounded-xl border border-[var(--color-cut)]/25 bg-[var(--color-cut)]/[0.05] px-4 py-3">
      <p className="text-[13.5px] text-[var(--color-text)]">
        No{" "}
        <span className="text-[var(--color-cut)]">
          {row.label.toLowerCase()}
        </span>
      </p>
      <p className="mt-1 text-[12px] text-[var(--color-muted)]">
        Nothing in this project&rsquo;s dependencies covers it.
      </p>

      <ul className="mt-2.5 flex flex-wrap gap-2">
        {row.options.slice(0, 3).map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-2 py-1 text-[12px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <Tile c={c} small />
              {c.name}
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** A capability that is covered, in one line. */
export function CoveredCapability({ row }: { row: Coverage }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/40 px-4 py-2.5">
      <span className="text-[13px] text-[var(--color-muted)]">{row.label}</span>
      <span aria-hidden="true" className="text-[var(--color-muted)]/50">
        ·
      </span>
      {row.installed.map((c) => (
        <span
          key={c.id}
          className="flex items-center gap-1.5 text-[13px] text-[var(--color-pass)]"
        >
          <Tile c={c} small />
          {c.name}
        </span>
      ))}
    </li>
  );
}

/**
 * One integration.
 *
 * "Connect" opens setup rather than starting an OAuth flow — there is no token
 * exchange, and a button claiming to connect without one would be the ticked
 * box with nothing behind it. Docs sits beside it so the link is reachable
 * without opening the panel.
 */
export function ConnectorRow({ c }: { c: ConnectorState }) {
  return (
    <li
      id={c.id}
      className={`scroll-mt-6 rounded-xl border ${
        c.installed
          ? "border-[var(--color-pass)]/40 bg-[var(--color-pass)]/[0.05]"
          : "border-[var(--color-line)] bg-[var(--color-raised)]/50"
      }`}
    >
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 [&::-webkit-details-marker]:hidden">
          <Tile c={c} />

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
            {/* Inside the summary so docs are reachable without opening the
                panel. target=_blank, so the toggle it also fires is harmless. */}
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

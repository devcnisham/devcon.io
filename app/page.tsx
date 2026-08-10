import type { CloneError } from "@/lib/clone.ts";
import { ageLabel } from "@/lib/ship/cache.ts";
import { oneParam } from "@/lib/ship/search.ts";
import {
  describeWorkspace,
  type ImportError,
  listWorkspaces,
} from "@/lib/workspaces.ts";
import { forgetWorkspace } from "./actions.ts";
import { HomeShell } from "./home-shell";
import { OpenOrCreate } from "./open";

/**
 * Dashboard — the way in, and everything opened before.
 *
 * Every card is checked against the disk as it renders. A recent list that
 * still offers a folder deleted last week is a list of claims, and this is not
 * the product that gets to ship those.
 */
export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    path?: string;
    added?: string;
    clone?: string;
    url?: string;
    pick?: string;
  }>;
}) {
  const params = await searchParams;
  const workspaces = await listWorkspaces();
  const rows = await Promise.all(
    workspaces.map(async (w) => ({ ...w, ...(await describeWorkspace(w)) })),
  );

  return (
    <HomeShell here="/" title="Dashboard">
      <OpenOrCreate
        error={oneParam(params.error) as ImportError | undefined}
        attempted={oneParam(params.path) ?? ""}
        added={oneParam(params.added)}
        cloneError={oneParam(params.clone) as CloneError | undefined}
        attemptedUrl={oneParam(params.url) ?? ""}
        pickError={oneParam(params.pick)}
      />

      <section className="mt-12">
        <h2 className="flex items-baseline gap-2 font-medium text-[var(--color-text)] text-lg tracking-tight">
          Recent
          <span className="text-[13px] text-[var(--color-muted)] tabular-nums">
            · {rows.length}
          </span>
        </h2>

        {rows.length === 0 ? (
          <p className="mt-4 max-w-md text-[13.5px] text-[var(--color-muted)] leading-relaxed">
            Nothing yet. Open a folder above — a college project, a side
            project, anything with a deadline you are trying to hit.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((w) => (
              <li
                key={w.path}
                className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-raised)]/40"
              >
                <Preview missing={!w.exists} />

                <div className="border-[var(--color-line)] border-t px-4 py-3">
                  <p className="truncate font-medium text-[14px] text-[var(--color-text)]">
                    {w.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--color-muted)]">
                    <span>{w.exists ? "Workspace" : "Missing"}</span>
                    <span aria-hidden>·</span>
                    <span>{ageLabel(w.lastOpenedAt)}</span>
                    {w.exists && !w.hasSpec && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-[var(--color-cut)]">
                          no SHIP.md
                        </span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-[var(--color-muted)]/70">
                    {w.path}
                  </p>

                  {/* Forgetting removes the row. It never touches the folder. */}
                  <form action={forgetWorkspace} className="mt-2">
                    <input type="hidden" name="path" value={w.path} />
                    <button
                      type="submit"
                      className="rounded text-[12px] text-[var(--color-muted)] underline underline-offset-4 transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      Forget
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 max-w-xl text-[11.5px] text-[var(--color-muted)]/80 leading-relaxed">
          Opening one of these is not wired up — the work page still reads this
          repo. That is the next piece, and this card says so rather than
          offering a link that goes somewhere else.
        </p>
      </section>
    </HomeShell>
  );
}

/**
 * The card's preview.
 *
 * Not a screenshot — devcon has never rendered these projects, and faking a
 * thumbnail would put a picture of work that does not exist on the page. It is
 * the work page's own ground, so a card reads as the surface it opens.
 */
function Preview({ missing }: { missing: boolean }) {
  return (
    <div
      aria-hidden
      className={`relative h-32 ${missing ? "opacity-30 grayscale" : ""}`}
      style={{
        background: `
          radial-gradient(420px 220px at 16% 0%, rgba(46,104,168,0.5), transparent 62%),
          radial-gradient(360px 200px at 92% 0%, rgba(116,88,182,0.4), transparent 60%),
          radial-gradient(460px 260px at 40% 110%, rgba(28,140,150,0.42), transparent 62%),
          #0b1119
        `,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />
    </div>
  );
}

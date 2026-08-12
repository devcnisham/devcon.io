import { stat } from "node:fs/promises";
import type { CloneError } from "@/lib/clone.ts";
import { detectProject, gaps } from "@/lib/detect.ts";
import { oneParam } from "@/lib/ship/search.ts";
import { type ImportError, listWorkspaces } from "@/lib/workspaces.ts";
import { NoProjects, ProjectCard, type ProjectRow, Stat } from "./cards";
import { currentUser } from "./current-user";
import { HomeShell } from "./home-shell";
import { Landing } from "./landing";
import { OpenOrCreate } from "./open";

/**
 * Dashboard — the way in, and the state of everything opened before.
 *
 * Each project is read from disk as the page renders: its stack from the
 * lockfile and dependencies, its gaps from files that are absent. A recent
 * list that still offers a folder deleted last week, or claims a stack it has
 * not looked at, is a list of claims — and this is not the product that gets
 * to ship those.
 *
 * **Signed out, `/` is the landing page instead.** One route rather than
 * moving the dashboard to `/dashboard`: every existing link, bookmark and
 * redirect in this repo already points at `/`, and moving it to add a front
 * door would break all of them to solve nothing. Which page you get is the
 * only thing that changes.
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
  if (!(await currentUser())) return <Landing />;

  const params = await searchParams;
  const workspaces = await listWorkspaces();

  const rows: ProjectRow[] = await Promise.all(
    workspaces.map(async (w) => {
      const detected = await detectProject(w.path);
      // The folder itself, not `.git` — a project without git is still a
      // project, and calling it missing would be wrong.
      const exists = await stat(w.path).then(
        (s) => s.isDirectory(),
        () => false,
      );
      return {
        ...w,
        ...detected,
        exists,
        gaps: exists ? gaps(detected) : [],
      };
    }),
  );

  const live = rows.filter((r) => r.exists);
  const withSpec = live.filter((r) => r.hasSpec).length;
  const urgent = live.filter((r) => r.gaps.some((g) => g.urgent)).length;
  const missing = rows.length - live.length;

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

      {rows.length > 0 && (
        <section className="mt-10">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              n={live.length}
              label="projects"
              hint="folders still on disk"
            />
            <Stat
              n={withSpec}
              label="with a SHIP.md"
              hint="the rest have no stated plan"
              tone={withSpec === 0 ? "cut" : "text"}
            />
            <Stat
              n={urgent}
              label="leaking a secret"
              hint=".env not covered by .gitignore"
              tone={urgent > 0 ? "fail" : "pass"}
            />
            <Stat
              n={missing}
              label="gone from disk"
              hint="the folder moved or was deleted"
              tone={missing > 0 ? "cut" : "text"}
            />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="flex items-baseline gap-2 font-medium text-[var(--color-text)] text-lg tracking-tight">
          Recent
          {rows.length > 0 && (
            <span className="text-[13px] text-[var(--color-muted)] tabular-nums">
              · {rows.length}
            </span>
          )}
        </h2>

        {rows.length === 0 ? (
          <div className="mt-4">
            <NoProjects />
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <ProjectCard key={row.path} row={row} />
            ))}
          </ul>
        )}

        <p className="mt-6 max-w-xl text-[11.5px] text-[var(--color-muted)]/80 leading-relaxed">
          Opening a card makes that project the one the work page is about. Both
          of its views are still empty, so what you get is the project&rsquo;s
          name on the switch and nothing else yet.
        </p>
      </section>
    </HomeShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { listProjects } from "@/lib/projects.ts";
import { oneParam } from "@/lib/ship/search.ts";
import {
  listWorkspaces,
  WORKSPACE_MESSAGE,
  type WorkspaceError,
} from "@/lib/workspace.ts";
import { Field, Submit } from "../auth-shell";
import { currentUser } from "../current-user";
import { currentWorkspace } from "../current-workspace";
import { HomeShell } from "../home-shell";
import {
  createMyWorkspace,
  renameMyWorkspace,
  switchMyWorkspace,
} from "../workspace-actions";

/**
 * Settings — the workspace, and the way to your account.
 *
 * `/settings` was a redirect to `/console` from the day Settings was renamed,
 * kept because the old path might be in a tab. Feature 003 gives it something
 * to be: the console is what devcon *is doing*, this is what *you have set*.
 */
export const dynamic = "force-dynamic";

const SAVED: Record<string, string> = {
  created: "Workspace created, and switched to.",
  renamed: "Workspace renamed.",
  switched: "Switched workspace.",
};

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    saved?: string | string[];
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const workspace = await currentWorkspace();
  if (!workspace) redirect("/login");

  const [mine, projects, params] = await Promise.all([
    listWorkspaces(user.id),
    listProjects(workspace.id),
    searchParams,
  ]);

  const error = WORKSPACE_MESSAGE[oneParam(params.error) as WorkspaceError];
  const saved = SAVED[oneParam(params.saved) ?? ""];

  return (
    <HomeShell
      here="/settings"
      title="Settings"
      intro="What you have set. The console is the other half — what devcon is doing and what this machine can do."
    >
      {error && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-[var(--color-fail)]/40 bg-[var(--color-fail)]/10 px-3 py-2.5 text-[13px] text-[var(--color-fail)]"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-[var(--color-pass)]/40 bg-[var(--color-pass)]/10 px-3 py-2.5 text-[13px] text-[var(--color-pass)]"
        >
          {saved}
        </p>
      )}

      <dl className="mb-10 grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3">
        <div className="bg-[var(--color-ink)] p-4">
          <dt className="font-mono text-[10.5px] text-[var(--color-muted)] uppercase tracking-[0.18em]">
            Workspace
          </dt>
          <dd className="mt-1.5 break-words text-[14px] text-[var(--color-text)]">
            {workspace.name}
          </dd>
        </div>
        <div className="bg-[var(--color-ink)] p-4">
          <dt className="font-mono text-[10.5px] text-[var(--color-muted)] uppercase tracking-[0.18em]">
            Projects in it
          </dt>
          <dd className="mt-1.5 text-[14px] text-[var(--color-text)] tabular-nums">
            {projects.length}
          </dd>
        </div>
        <div className="bg-[var(--color-ink)] p-4">
          <dt className="font-mono text-[10.5px] text-[var(--color-muted)] uppercase tracking-[0.18em]">
            Account
          </dt>
          <dd className="mt-1.5 break-all text-[13.5px] text-[var(--color-text)]">
            <Link
              href="/profile"
              className="rounded underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              {user.name ?? user.email}
            </Link>
          </dd>
        </div>
      </dl>

      <section className="mb-10">
        <h2 className="mb-1 font-medium text-[15px] text-[var(--color-text)]">
          Rename this workspace
        </h2>
        <p className="mb-4 max-w-md text-[13px] text-[var(--color-muted)] leading-relaxed">
          The name is for you. Nothing outside this machine ever sees it.
        </p>
        <form action={renameMyWorkspace} className="max-w-sm" noValidate>
          <Field
            label="Name"
            name="name"
            type="text"
            autoComplete="off"
            defaultValue={workspace.name}
          />
          <Submit>Rename</Submit>
        </form>
      </section>

      {mine.length > 1 && (
        <section className="mb-10">
          <h2 className="mb-1 font-medium text-[15px] text-[var(--color-text)]">
            Switch workspace
          </h2>
          <p className="mb-4 max-w-md text-[13px] text-[var(--color-muted)] leading-relaxed">
            Each one keeps its own projects. Nothing is deleted by switching.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {mine.map((w) => {
              const here = w.id === workspace.id;
              return (
                <li key={w.id}>
                  <form action={switchMyWorkspace}>
                    <input type="hidden" name="id" value={w.id} />
                    <button
                      type="submit"
                      disabled={here}
                      aria-current={here ? "true" : undefined}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-[13.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                        here
                          ? "cursor-default border-[var(--color-pass)]/40 bg-[var(--color-pass)]/10 text-[var(--color-text)]"
                          : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-white/25 hover:text-[var(--color-text)]"
                      }`}
                    >
                      {w.name}
                      {here && (
                        <span className="ml-2 text-[11.5px] text-[var(--color-pass)]">
                          current
                        </span>
                      )}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 font-medium text-[15px] text-[var(--color-text)]">
          New workspace
        </h2>
        <p className="mb-4 max-w-md text-[13px] text-[var(--color-muted)] leading-relaxed">
          A second one is for separating unrelated work — projects belong to one
          workspace at a time.{" "}
          <strong className="font-medium">Not for sharing with anyone:</strong>{" "}
          there are no invites, roles or permissions, and there is no server to
          share through.
        </p>
        <form action={createMyWorkspace} className="max-w-sm" noValidate>
          <Field
            label="Name"
            name="name"
            type="text"
            autoComplete="off"
            hint="For example: Client work, or Side projects."
          />
          <Submit>Create workspace</Submit>
        </form>
      </section>
    </HomeShell>
  );
}

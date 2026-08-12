import Link from "next/link";
import type { Detected, Gap } from "@/lib/detect.ts";
import { stackLine } from "@/lib/detect.ts";
import type { Project } from "@/lib/projects.ts";
import { ageLabel } from "@/lib/ship/cache.ts";
import { forgetProject, openProject } from "./actions.ts";

/**
 * The dashboard's pieces.
 *
 * Every number and label on these comes from a file that was read a moment
 * ago. Nothing is stored from a previous visit and nothing is estimated — a
 * card that says "no tests" says it because it looked for a test directory and
 * did not find one.
 */

export interface ProjectRow extends Project, Detected {
  exists: boolean;
  gaps: Gap[];
}

/** One number, with the sentence that stops it being read as more than it is. */
export function Stat({
  n,
  label,
  hint,
  tone = "text",
}: {
  n: number | string;
  label: string;
  hint: string;
  tone?: "text" | "cut" | "fail" | "pass";
}) {
  const colour = {
    text: "text-[var(--color-text)]",
    cut: "text-[var(--color-cut)]",
    fail: "text-[var(--color-fail)]",
    pass: "text-[var(--color-pass)]",
  }[tone];

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/40 px-4 py-3">
      <p className={`font-medium text-2xl tabular-nums ${colour}`}>{n}</p>
      <p className="mt-0.5 text-[12.5px] text-[var(--color-muted)]">{label}</p>
      <p className="text-[11px] text-[var(--color-muted)]/70 leading-relaxed">
        {hint}
      </p>
    </div>
  );
}

/**
 * The card's preview.
 *
 * Not a screenshot — devcon has never rendered these projects, and a fake
 * thumbnail would be a picture of work that does not exist. It is the work
 * page's own ground, so a card reads as the surface it opens.
 */
function Preview({ row }: { row: ProjectRow }) {
  const urgent = row.gaps.some((g) => g.urgent);
  return (
    <div
      aria-hidden="true"
      className={`relative h-24 ${row.exists ? "" : "opacity-25 grayscale"}`}
      style={{
        background: `
          radial-gradient(380px 200px at 16% 0%, rgba(46,104,168,0.5), transparent 62%),
          radial-gradient(320px 180px at 92% 0%, rgba(116,88,182,0.4), transparent 60%),
          radial-gradient(400px 240px at 40% 110%, rgba(28,140,150,0.42), transparent 62%),
          #0b1119
        `,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "13px 13px",
        }}
      />
      {urgent && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--color-fail)]" />
      )}
    </div>
  );
}

function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "cut" | "fail" | "pass";
}) {
  const cls = {
    muted: "border-[var(--color-line)] text-[var(--color-muted)]",
    cut: "border-[var(--color-cut)]/30 bg-[var(--color-cut)]/10 text-[var(--color-cut)]",
    fail: "border-[var(--color-fail)]/30 bg-[var(--color-fail)]/10 text-[var(--color-fail)]",
    pass: "border-[var(--color-pass)]/30 bg-[var(--color-pass)]/10 text-[var(--color-pass)]",
  }[tone];
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[11px] leading-none ${cls}`}
    >
      {children}
    </span>
  );
}

export function ProjectCard({ row }: { row: ProjectRow }) {
  const stack = stackLine(row);
  // Urgent first — a committed .env is a different kind of problem from a
  // missing README, and sorting them together would bury it.
  const shown = [...row.gaps].sort(
    (a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)),
  );

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-raised)]/40 transition-colors hover:border-[var(--color-muted)]/40">
      <form action={openProject} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="path" value={row.path} />
        {/* The whole card is the control. A link would be tidier, but opening a
            project writes which one is active, and a GET that mutates is wrong
            the first time something prefetches it. */}
        <button
          type="submit"
          className="flex min-h-0 flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Preview row={row} />

          <div className="flex min-h-0 w-full flex-1 flex-col border-[var(--color-line)] border-t px-4 py-3">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate font-medium text-[14px] text-[var(--color-text)]">
                {row.name}
              </p>
              {!row.exists && <Tag tone="fail">missing</Tag>}
            </div>

            <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-muted)]/70">
              {row.path}
            </p>

            {row.exists && (
              <>
                <p className="mt-2 text-[12px] text-[var(--color-muted)]">
                  {stack || "Stack not detected"} · {ageLabel(row.lastOpenedAt)}
                </p>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {row.hasSpec ? (
                    <Tag tone="pass">SHIP.md</Tag>
                  ) : (
                    <Tag tone="cut">no SHIP.md</Tag>
                  )}
                  {row.hasGit && <Tag>git</Tag>}
                  {row.hasTests && <Tag>tests</Tag>}
                  {row.hasCi && <Tag>CI</Tag>}
                </div>

                {shown.length > 0 && (
                  <div className="mt-3 border-[var(--color-line)] border-t pt-2.5">
                    <p className="text-[11px] text-[var(--color-muted)]/80">
                      Missing — read from the folder, not a checklist
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {shown.slice(0, 4).map((g) => (
                        <li
                          key={g.id}
                          className={`text-[12px] ${
                            g.urgent
                              ? "text-[var(--color-fail)]"
                              : "text-[var(--color-muted)]"
                          }`}
                        >
                          {g.label}
                        </li>
                      ))}
                      {shown.length > 4 && (
                        <li className="text-[11.5px] text-[var(--color-muted)]/70">
                          and {shown.length - 4} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}

            {!row.exists && (
              <p className="mt-2 text-[12px] text-[var(--color-muted)]">
                The folder is gone. Nothing was deleted by devcon — only this
                row remembers it.
              </p>
            )}
          </div>
        </button>
      </form>

      {/* A sibling, not a child — nested forms are invalid HTML and the inner
          one is dropped, which would make Forget silently open the project. */}
      <form action={forgetProject} className="px-4 pb-3">
        <input type="hidden" name="path" value={row.path} />
        <button
          type="submit"
          className="rounded text-[12px] text-[var(--color-muted)] underline underline-offset-4 transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Forget
        </button>
      </form>
    </li>
  );
}

/** What the page says before anything has been opened. */
export function NoProjects() {
  return (
    <div className="rounded-2xl border border-[var(--color-line)] border-dashed px-5 py-8 text-center">
      <p className="text-[14px] text-[var(--color-text)]">No projects yet</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-[var(--color-muted)] leading-relaxed">
        Open a folder or clone a repo above — a college project, a side project,
        anything with a deadline you are trying to hit. devcon reads it and
        tells you what is still missing.
      </p>
      <Link
        href="/connectors"
        className="mt-4 inline-block rounded text-[12.5px] text-[var(--color-muted)] underline underline-offset-4 transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        Or browse the integrations first
      </Link>
    </div>
  );
}

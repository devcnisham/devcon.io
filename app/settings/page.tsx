import { TTL_MS } from "@/lib/ship/cache.ts";
import { DEFAULTS } from "@/lib/ship/check.ts";
import { sandboxUnavailable } from "@/lib/ship/sandbox.ts";
import { STORE } from "@/lib/workspaces.ts";
import { HomeShell } from "../home-shell";

/**
 * Settings — what devcon is currently doing, and where it keeps things.
 *
 * Read-only for now, and labelled as such. Every number here is real, imported
 * from the module that uses it, so this page cannot drift from the behaviour it
 * describes the way a hand-typed settings screen would.
 *
 * There is no profile, because there are no accounts. Drawing an avatar and a
 * name field for a local tool that has never had a user would be decoration
 * pretending to be a feature.
 */
export const dynamic = "force-dynamic";

export default async function Settings() {
  const blocked = sandboxUnavailable();

  return (
    <HomeShell
      here="/settings"
      title="Settings"
      intro="What devcon is doing right now. Every value is read from the code that uses it."
    >
      <section>
        <h2 className="font-medium text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
          Running checks
        </h2>
        <dl className="mt-3 divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/50">
          <Row
            label="Time a check may take"
            value={`${DEFAULTS.timeoutMs / 1000}s`}
            hint="Past this it is stopped and reported as error, never as fail — a timeout is not an exit code."
          />
          <Row
            label="Checks at once"
            value={String(DEFAULTS.concurrency)}
            hint="Running all of them at once created the load that made verdicts change between runs."
          />
          <Row
            label="Results reused for"
            value={`${TTL_MS / 1000}s`}
            hint="Shared between views. Editing SHIP.md beats the clock, and the age is always shown."
          />
          <Row
            label="Sandbox"
            value={blocked ? "unavailable" : "active"}
            hint={
              blocked ??
              "macOS seatbelt. No network, no filesystem outside the project and toolchain, no .git or .env writes."
            }
            bad={Boolean(blocked)}
          />
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
          Where things are kept
        </h2>
        <dl className="mt-3 divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)]/50">
          <Row
            label="Imported projects"
            value={STORE}
            mono
            hint="Paths only. Never written inside a project, so it cannot land in your diff."
          />
          <Row
            label="Secrets"
            value="never stored"
            hint="devcon does not ask for, display or write an API key. Values live in your .env.local, which is gitignored."
          />
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-[11px] text-[var(--color-muted)] uppercase tracking-[0.16em]">
          Profile
        </h2>
        <p className="mt-3 text-[13.5px] text-[var(--color-muted)] leading-relaxed">
          There isn&rsquo;t one. devcon has no accounts and no sign-in — it runs
          on your machine and reads your repo. A name and an avatar here would
          be decoration for something that does not exist.
        </p>
      </section>

      <p className="mt-10 text-[11.5px] text-[var(--color-muted)]/80 leading-relaxed">
        Nothing on this page is editable yet. The four numbers above are
        judgement calls made while building the checker, and making them
        adjustable is a change to how checks run, not a change to this screen.
      </p>
    </HomeShell>
  );
}

function Row({
  label,
  value,
  hint,
  mono = false,
  bad = false,
}: {
  label: string;
  value: string;
  hint: string;
  mono?: boolean;
  bad?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <dt className="text-[13.5px] text-[var(--color-text)]">{label}</dt>
        <dd
          className={`${mono ? "font-mono text-[11.5px]" : "text-[13px]"} [overflow-wrap:anywhere] ${
            bad ? "text-[var(--color-fail)]" : "text-[var(--color-muted)]"
          }`}
        >
          {value}
        </dd>
      </div>
      <p className="mt-1 text-[11.5px] text-[var(--color-muted)]/75 leading-relaxed">
        {hint}
      </p>
    </div>
  );
}

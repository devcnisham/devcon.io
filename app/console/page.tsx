import { CLONE_ROOT } from "@/lib/clone.ts";
import { CONNECTORS } from "@/lib/connectors.ts";
import { hostDiagnostics } from "@/lib/diagnostics.ts";
import { ACTIVE, listProjects, STORE } from "@/lib/projects.ts";
import { TTL_MS } from "@/lib/ship/cache.ts";
import { DEFAULTS } from "@/lib/ship/check.ts";
import { sandboxUnavailable } from "@/lib/ship/sandbox.ts";
import { Stat } from "../cards";
import { Group, ProbeRow, Row, Rule } from "../console-cards";
import { HomeShell } from "../home-shell";

/**
 * Console — what devcon is doing, and what this machine can do.
 *
 * Read-only, and labelled as such. Every number is imported from the module
 * that uses it and every capability is probed rather than assumed, so this page
 * cannot claim a behaviour the code does not have.
 *
 * There is no profile, because there are no accounts. An avatar and a name
 * field for a local tool that has never had a user would be decoration
 * pretending to be a feature.
 */
export const dynamic = "force-dynamic";

export default async function Settings() {
  const [probes, projects] = await Promise.all([
    hostDiagnostics(),
    listProjects(),
  ]);

  const blocked = sandboxUnavailable();
  const problems = probes.filter((p) => p.problem).length;

  return (
    <HomeShell here="/console" title="Console">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          n={blocked ? "off" : "on"}
          label="check sandbox"
          hint={blocked ? "checks refuse to run here" : "seatbelt, no network"}
          tone={blocked ? "fail" : "pass"}
        />
        <Stat
          n={problems}
          label="things unavailable"
          hint="probed on this machine, not assumed"
          tone={problems > 0 ? "cut" : "pass"}
        />
        <Stat
          n={projects.length}
          label="projects tracked"
          hint="paths only, stored outside your repos"
        />
        <Stat
          n={CONNECTORS.length}
          label="integrations known"
          hint="a thin catalog — facts rot"
        />
      </div>

      <Group
        title="This machine"
        note="Probed when this page loaded. Several features below are macOS-only, and listing them as working because the code exists would be a claim rather than a fact."
      >
        {probes.map((p) => (
          <ProbeRow key={p.label} probe={p} />
        ))}
      </Group>

      <Group
        title="Running checks"
        note="Imported from lib/ship/check.ts and lib/ship/cache.ts, so these cannot drift from what actually happens."
      >
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
      </Group>

      <Group title="Where things are kept">
        <Row
          label="Projects you have opened"
          value={STORE}
          mono
          hint="Paths only. Never written inside a project, where it would land in your diff and your submission."
        />
        <Row
          label="Which project is open"
          value={ACTIVE}
          mono
          hint="Checked against the disk on every read, so a deleted folder reports as nothing open."
        />
        <Row
          label="Clones land in"
          value={CLONE_ROOT}
          mono
          hint="Only https:// and git@host:path URLs are accepted — git treats some other forms as commands to run."
        />
      </Group>

      <section className="mt-10 space-y-3">
        <Rule title="devcon never asks for, shows or stores an API key.">
          Integration panels name the environment variables a service needs. The
          values go in your <span className="font-mono">.env.local</span>, which
          is gitignored. A form that accepted a service key would be a
          credential surface inside a tool whose second rule is that no secret
          enters the repo.
        </Rule>
        <Rule title="Checks are confined, and refuse to run where they cannot be.">
          No network, no filesystem outside the project and its toolchain, no
          writes to <span className="font-mono">.git</span>,{" "}
          <span className="font-mono">.env*</span> or{" "}
          <span className="font-mono">.vercel</span>, and a replaced environment
          rather than an inherited one. A check can still change the
          project&rsquo;s own uncommitted files — writes cannot be denied.
        </Rule>
      </section>

      <section className="mt-10">
        <h2 className="font-medium text-[var(--color-text)] text-lg tracking-tight">
          Profile
        </h2>
        <p className="mt-2 max-w-xl text-[13.5px] text-[var(--color-muted)] leading-relaxed">
          There isn&rsquo;t one. devcon has no accounts and no sign-in — it runs
          on your machine and reads your folders. A name and an avatar here
          would be decoration for something that does not exist.
        </p>
      </section>

      <p className="mt-10 max-w-xl text-[11.5px] text-[var(--color-muted)]/80 leading-relaxed">
        Nothing on this page is editable. The three numbers under “Running
        checks” are judgement calls made while building the checker, and making
        them adjustable is a change to how checks run rather than a change to
        this screen.
      </p>
    </HomeShell>
  );
}

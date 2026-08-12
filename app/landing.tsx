import Link from "next/link";

/**
 * What `/` shows when nobody is signed in.
 *
 * Deliberately not a marketing page. **Nobody has finished a project because of
 * devcon** — that is the open gap `SHIP.md` and `HANDOFF.md` both record — so
 * there are no testimonials, no "trusted by", no counter, and no claim about
 * outcomes. Every line below is either what the tool does or what it does not
 * do yet, and a reader can check both by using it.
 *
 * Zero client JavaScript, like the rest. Two links and no state.
 */

const DOES = [
  {
    title: "Reads what you actually built",
    body: "Point it at a folder. It reads the lockfile, the dependencies and the files that are missing — not a questionnaire you fill in.",
  },
  {
    title: "Keeps one SHIP.md in your repo",
    body: "What ships, what is cut and why, and the conditions that say you are done. Plain markdown, useful even with devcon uninstalled.",
  },
  {
    title: "Runs the checks, and disagrees with you",
    body: "A ticked box is a claim. Each condition names a command, and devcon runs it confined and reports what actually happened.",
  },
] as const;

export function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-8 sm:px-8">
      <header className="flex items-center justify-between">
        <span className="font-mono text-[var(--color-text)] text-sm tracking-tight">
          devcon
        </span>
        <Link
          href="/login"
          className="rounded px-1 text-[13px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Sign in
        </Link>
      </header>

      <div className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-xl font-medium text-[var(--color-text)] text-3xl leading-[1.15] tracking-tight sm:text-4xl">
          A shipping critic that runs inside your coding agent.
        </h1>

        <p className="mt-5 max-w-xl text-[15px] text-[var(--color-muted)] leading-relaxed">
          It keeps one <span className="font-mono text-[13.5px]">SHIP.md</span>{" "}
          in your repo, reads what you actually built, and tells you what to
          cut.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-[var(--color-text)] px-4 py-2.5 font-medium text-[14px] text-[var(--color-ink)] transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-[var(--color-line)] px-4 py-2.5 text-[14px] text-[var(--color-text)] transition-colors hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Sign in
          </Link>
        </div>

        <p className="mt-4 text-[12.5px] text-[var(--color-muted)]">
          Runs on your machine. Accounts are stored under{" "}
          <span className="font-mono">~/.devcon</span> and nothing is sent
          anywhere.
        </p>

        <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3">
          {DOES.map((d) => (
            <section key={d.title} className="bg-[var(--color-ink)] p-5">
              <h2 className="font-medium text-[13.5px] text-[var(--color-text)]">
                {d.title}
              </h2>
              <p className="mt-2 text-[12.5px] text-[var(--color-muted)] leading-relaxed">
                {d.body}
              </p>
            </section>
          ))}
        </div>

        {/* The thing a landing page normally hides. It is the most useful
            sentence on the page, and leaving it out would make this the first
            unchecked claim devcon ships. */}
        <p className="mt-8 max-w-xl text-[12.5px] text-[var(--color-muted)] leading-relaxed">
          <span className="text-[var(--color-cut)]">Early.</span> Nobody has
          finished a project because of devcon yet, and checks currently run
          only on macOS. If either matters to you, that is worth knowing before
          you sign up rather than after.
        </p>
      </div>
    </main>
  );
}

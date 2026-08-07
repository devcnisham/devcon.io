import type { Metadata } from "next";
import { ALL_STEPS } from "@/lib/catalog";
import { PROVIDERS } from "@/lib/catalog/providers";
import { executionOf, verificationState } from "@/lib/catalog/types";
import { SITE_NAME } from "@/lib/site";
import { Code, DocsShell, Note, Section, Table } from "./ui";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How DevCon builds a plan: what it reads, how steps are selected and ordered, why hidden steps carry reasons, and what is not built yet.",
  alternates: { canonical: "/docs" },
};

/**
 * Counted from the catalog at build time, never typed by hand.
 *
 * Every number on this page is derived from the same source the engine reads,
 * so the docs cannot quietly drift from the product. The README already shows
 * why that matters — it says "209 tests" and "4 of 62 prompts" because both
 * were true when someone typed them and neither is now.
 */
const doSteps = ALL_STEPS.filter((s) => s.kind === "do");
const antiSteps = ALL_STEPS.filter((s) => s.kind === "avoid");
const verification = doSteps.map(verificationState);
const COUNTS = {
  do: doSteps.length,
  anti: antiSteps.length,
  providers: PROVIDERS.length,
  mcp: PROVIDERS.filter((p) => p.mcp_server).length,
  verified: verification.filter((v) => v === "verified").length,
  partial: verification.filter((v) => v === "partial").length,
  unverified: verification.filter((v) => v === "unverified").length,
  agent: doSteps.filter((s) => executionOf(s) === "agent").length,
  needsInput: doSteps.filter((s) => executionOf(s) === "needs-input").length,
  human: doSteps.filter((s) => executionOf(s) === "human").length,
};

const SECTIONS = [
  { id: "what-it-does", title: "What it does" },
  { id: "point-it", title: "Point it at a project" },
  { id: "what-it-reads", title: "What it reads" },
  { id: "how-a-plan-is-built", title: "How a plan is built" },
  { id: "reading-a-plan", title: "Reading a plan" },
  { id: "prompts", title: "Prompts and verification" },
  { id: "integrations", title: "Integrations and MCP" },
  { id: "your-data", title: "Where your data lives" },
  { id: "not-built", title: "What isn't built" },
];

export default function DocsPage() {
  return (
    <DocsShell sections={SECTIONS}>
      <h1 className="text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl">
        {SITE_NAME} documentation
      </h1>
      <p className="mt-5 max-w-2xl text-pretty text-[17px] leading-relaxed text-neutral-400">
        What the tool reads, how it decides, and what it deliberately does not
        do yet. Every count on this page is derived from the catalog at build
        time rather than written down, so it cannot go stale.
      </p>

      <Section id="what-it-does" title="What it does">
        <p>
          You point DevCon at an idea or an existing repository. It returns a
          short, ordered sequence of steps to ship that thing, and hides
          everything that doesn&apos;t apply — with the reason it was hidden
          attached to each one.
        </p>
        <p>
          The catalog holds <strong>{COUNTS.do} do-steps</strong> and{" "}
          <strong>{COUNTS.anti} anti-steps</strong> across three contexts:
          academic, competition and commercial. A given project sees a fraction
          of them. That fraction is the product — the work is in deciding what
          to leave out, not in listing everything that could matter.
        </p>
        <Note>
          A hackathon team that says it needs authentication does not get a
          login step. It gets a loud instruction <em>not</em> to build one,
          because judges never sign up and four hours spent there scores
          nothing.
        </Note>
      </Section>

      <Section id="point-it" title="Point it at a project">
        <p>Four ways in. They are not equivalent, so pick by what you have:</p>
        <Table
          head={["Source", "Works in production", "What it needs"]}
          rows={[
            [
              "Folder picker",
              "Yes — Chromium only",
              "Read access to a directory. Your browser reads it on your machine; nothing is uploaded and no server is involved.",
            ],
            [
              "Public GitHub repo",
              "Yes",
              "A public URL. Read over the anonymous API, no sign-in. Private repositories would need a token, and no field anywhere accepts one.",
            ],
            [
              "Dropped files",
              "Yes",
              "A package.json and an .env.example are enough. The universal fallback when the other two don't fit.",
            ],
            [
              "Local path",
              "No — 404s by design",
              "Development only. The route reads the host filesystem, so it is disabled in production rather than shipped as a hole.",
            ],
          ]}
        />
      </Section>

      <Section id="what-it-reads" title="What it reads">
        <p>
          Structure only: dependency names, config filenames, the directory
          tree, the git remote, and the key <em>names</em> in{" "}
          <Code>.env.example</Code>.
        </p>
        <p>
          It does not read your source, and it never reads <Code>.env</Code>.
          There is deliberately no input anywhere in the product that accepts a
          key value — not a password field, not a paste box. What is stored is a
          key name plus a boolean saying whether you have configured it.
        </p>
        <Note tone="strong">
          This is a structural guarantee, not a policy. Generated MCP config
          emits <Code>{"${YOUR_KEY}"}</Code> references that your own client
          expands from your environment, so the credential never passes through
          a file DevCon wrote.
        </Note>
      </Section>

      <Section id="how-a-plan-is-built" title="How a plan is built">
        <p>
          Selection and ordering are pure functions over a versioned TypeScript
          catalog. <strong>No model picks your steps.</strong> Each step carries
          a predicate over your project&apos;s profile; selection is a filter,
          ordering is a topological sort with a tie-break on step id so the same
          profile produces the same plan on any machine.
        </p>
        <p>
          When a predicate fails, the condition tree is walked to find the leaf
          that failed. That leaf is what the hidden drawer shows you. The copy
          is generated from the predicate rather than written by hand, because a
          hand-written reason rots the moment the predicate changes.
        </p>
        <Note>
          The constraint is the point. Subtraction only earns trust if{" "}
          <em>&ldquo;why was this hidden?&rdquo;</em> has an answer, and
          freeform generation has none — it also produces a different plan every
          run for the same input.
        </Note>
      </Section>

      <Section id="reading-a-plan" title="Reading a plan">
        <p>A plan has three kinds of entry, and they behave differently:</p>
        <Table
          head={["Kind", "Shown", "Meaning"]}
          rows={[
            [
              "Step",
              "In order",
              "Work to do. Carries a done-when checklist and, where it makes sense, a prompt.",
            ],
            [
              "Anti-step",
              "Loudly, out of order",
              "Work not to do. Never a dependency, because it isn't work — it is a warning about something you were about to start.",
            ],
            [
              "Hidden",
              "In a drawer, with a reason",
              "Did not apply. Silent in the plan, but never silently dropped — open the drawer to see which condition failed.",
            ],
          ]}
        />
        <p>
          Steps also declare who can do them, which decides whether a prompt is
          offered at all:
        </p>
        <Table
          head={["Execution", "Count", "What you get"]}
          rows={[
            [
              "agent",
              String(COUNTS.agent),
              "A prompt to paste into your coding agent.",
            ],
            [
              "needs-input",
              String(COUNTS.needsInput),
              "Fields to fill first — a rubric, a deadline — then a prompt built from them.",
            ],
            [
              "human",
              String(COUNTS.human),
              "No prompt. Some work has no agent-shaped version: transferring account ownership, looking at your demo on the projector you'll present from.",
            ],
          ]}
        />
      </Section>

      <Section id="prompts" title="Prompts and verification">
        <p>
          Each agent-executable step generates a prompt built from your actual
          stack — the dependencies you have, the services you connected, the
          files the scan found. Assembly is a template, not a model call, for
          the same reason selection is.
        </p>
        <p>
          The catalog&apos;s own bar for calling a prompt verified is that it
          has been pasted into <strong>two</strong> agents against a real
          repository and produced working output. Measured against that bar
          right now:
        </p>
        <Table
          head={["State", "Count", "Means"]}
          rows={[
            [
              "verified",
              String(COUNTS.verified),
              "Two or more agents, against a real repo.",
            ],
            [
              "partial",
              String(COUNTS.partial),
              "One agent. Half the bar, reported as half rather than rounded up.",
            ],
            [
              "unverified",
              String(COUNTS.unverified),
              "Never run through an agent.",
            ],
          ]}
        />
        <Note tone="strong">
          {COUNTS.verified === 0
            ? "No prompt meets the two-agent bar yet."
            : `${COUNTS.verified} prompts meet the two-agent bar.`}{" "}
          Verification state is shown in the product and deliberately does{" "}
          <em>not</em> filter your plan — a verified-only plan would today be an
          empty one, and hiding the gap is worse than showing it.
        </Note>
      </Section>

      <Section id="integrations" title="Integrations and MCP">
        <p>
          {COUNTS.providers} providers across eight capabilities, {COUNTS.mcp}{" "}
          of them with an MCP server. Connecting one generates config for Claude
          Code, Cursor or VS Code, plus the equivalent{" "}
          <Code>claude mcp add</Code> commands.
        </p>
        <p>
          Every shipped server is remote and authenticates over OAuth, so the
          generated config carries no credential at all. Where a server does
          need an environment variable, the config emits a{" "}
          <Code>{"${NAME}"}</Code> reference — the client expands it from your
          environment.
        </p>
        <Note>
          An earlier version emitted <Code>&lt;your KEY&gt;</Code>, which the
          client passes through verbatim as the credential. The server starts,
          then fails its first authenticated call — config that reads as working
          right up until it isn&apos;t.
        </Note>
      </Section>

      <Section id="your-data" title="Where your data lives">
        <p>
          In your browser. All state — your plan, completed steps, notes,
          connected services, the local event log — is <Code>localStorage</Code>{" "}
          on the origin you are using. There is no backend, no account and no
          sync.
        </p>
        <p>Two consequences worth knowing before you rely on it:</p>
        <ul>
          <li>
            Clearing site data wipes everything. There is no copy anywhere else.
          </li>
          <li>
            State does not follow you between machines, browsers, or between{" "}
            <Code>localhost</Code> and the deployed site — those are different
            origins.
          </li>
        </ul>
      </Section>

      <Section id="not-built" title="What isn't built">
        <p>Stated here rather than discovered later:</p>
        <ul>
          <li>
            <strong>No accounts, auth or teams.</strong> The schema is already
            team- and account-shaped so adding them is not a migration, but none
            of it exists.
          </li>
          <li>
            <strong>The sync engine has no remote.</strong> Queue, retry,
            deduplication and revision-based conflict resolution are implemented
            and tested against a transport interface that nothing implements.
          </li>
          <li>
            <strong>The registry REST API is development-only.</strong> It has
            no auth, and an unauthenticated write endpoint on a deployed host
            lets anyone rewrite anyone&apos;s registry.
          </li>
          <li>
            <strong>Provider free tiers are seeded, not audited.</strong> A
            build-time check fails the suite when any provider&apos;s
            verification date is more than 90 days old.
          </li>
          <li>
            <strong>The waitlist has no backend.</strong> Addresses are written
            to <Code>localStorage</Code> and do not leave your machine.
          </li>
        </ul>
        <Note tone="strong">
          And the one that matters: nobody has finished a project because of
          DevCon. There is no number yet for{" "}
          <em>&ldquo;of N who started a plan, M reached demo&rdquo;</em>. Until
          that exists, everything on this page — including the whole subtraction
          thesis — is an assertion.
        </Note>
      </Section>
    </DocsShell>
  );
}

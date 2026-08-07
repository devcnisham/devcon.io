import {
  all,
  context,
  hasJudgingCriteria,
  hasSponsorTracks,
  isTeam,
  needs,
  not,
  submission,
  underHours,
} from "../conditions";
import type { Step } from "../types";

/**
 * Competition catalog — hackathons and judged builds.
 *
 * The failure mode here is unlike the other two tracks. A student loses marks
 * and a commercial project loses money; a hackathon team loses *the whole
 * thing* by arriving at judging with nothing to show. Almost every anti-step
 * below exists because the work it forbids is genuinely good practice
 * everywhere else — auth, tests, deploys, a design system — and is fatal
 * inside 36 hours.
 *
 * That makes this the track where subtraction earns its keep most visibly:
 * the plan is short, and what it refuses to tell you to do is the point.
 *
 * NOT YET VERIFIED. No prompt here has been through an agent, and no cohort
 * has run on it. Sizing assumes a weekend event.
 */

const competition = context("competition");

export const COMPETITION_STEPS: Step[] = [
  // -------------------------------------------------------- foundation
  {
    id: "comp-read-judging",
    title: "Read the judging criteria and pick which prizes you're chasing",
    kind: "do",
    phase: "foundation",
    weight: 0,
    criticality: "must",
    applies_when: all(competition, hasJudgingCriteria()),
    requires: [],
    why: "Judges score against a published rubric. Building something they have no column for is building for nobody — and most teams read the criteria for the first time on Sunday morning.",
    done_when: [
      { text: "Every criterion has something in your build that answers it" },
      { text: "Prizes you are NOT chasing are written down as not chasing" },
    ],
    execution: "needs-input",
    inputs: [
      {
        key: "criteria",
        label: "The judging criteria, pasted from the event page",
        placeholder:
          "Innovation 25% · Technical difficulty 25% · Impact 25% · Demo 25%",
        multiline: true,
      },
      {
        key: "prizes",
        label: "Prizes you're entering",
        placeholder: "Grand prize, Best use of AI",
      },
    ],
    est_minutes: 20,
  },
  {
    id: "comp-scope-to-demo",
    title: "Cut scope to one demoable path",
    kind: "do",
    phase: "foundation",
    weight: 1,
    criticality: "must",
    applies_when: competition,
    requires: [],
    why: "The only thing judged is what you can show in three minutes. Everything that isn't on that path is invisible to scoring, however hard it was.",
    done_when: [
      { text: "One sentence describing what you demo, start to finish" },
      { text: "Everything not in that sentence is written down as later" },
    ],
    est_minutes: 30,
  },
  {
    id: "comp-sponsor-requirements",
    title: "Confirm what each sponsor prize actually requires",
    kind: "do",
    phase: "foundation",
    weight: 2,
    criticality: "must",
    applies_when: all(competition, hasSponsorTracks()),
    requires: ["comp-scope-to-demo"],
    why: "Sponsor prizes usually mandate a specific API and some proof you used it meaningfully. Discovering that at hour 30 costs you the prize you were building toward.",
    done_when: [
      { text: "The required service is named for each prize you're entering" },
      {
        text: "Any 'must be used meaningfully' wording is understood, not skimmed",
      },
      { text: "API keys obtained and working before you need them" },
    ],
    execution: "needs-input",
    inputs: [
      {
        key: "rules",
        label: "The sponsor prize rules, pasted verbatim",
        placeholder:
          "Must use the X API in a way that is core to the project, not decorative. Show it in the demo video.",
        multiline: true,
      },
    ],
    est_minutes: 30,
  },
  {
    id: "comp-repo",
    title: "Set up the repo and get everyone pushing",
    kind: "do",
    phase: "foundation",
    weight: 3,
    criticality: "must",
    applies_when: competition,
    requires: ["comp-scope-to-demo"],
    why: "Ten minutes now, or an hour at 3am when someone's laptop dies and their work exists nowhere else.",
    done_when: [
      { text: "Repo exists and every teammate has pushed at least once" },
      { text: "Someone can clone and run it" },
    ],
    est_minutes: 20,
    serves: ["version-control"],
  },
  {
    id: "comp-split-work",
    title: "Split the work so nobody is blocked",
    kind: "do",
    phase: "foundation",
    weight: 4,
    criticality: "must",
    applies_when: all(competition, isTeam()),
    requires: ["comp-repo"],
    why: "In a short event the cost of two people waiting on a third is the whole project. Split along seams that don't touch.",
    done_when: [
      { text: "Each person owns files nobody else is editing" },
      { text: "The interface between your pieces is agreed in writing" },
    ],
    execution: "human",
    est_minutes: 20,
  },

  // -------------------------------------------------------------- core
  {
    id: "comp-fake-data-first",
    title: "Hardcode the data before you build anything real",
    kind: "do",
    phase: "core",
    weight: 0,
    criticality: "must",
    applies_when: competition,
    requires: ["comp-repo"],
    why: "A demo needs data that looks real, not a database that is real. Fixtures first means the interface is never blocked on the backend, and the backend can be swapped in later — or never.",
    done_when: [
      { text: "The demo path renders end to end from hardcoded data" },
      { text: "The data looks plausible on a projector, not lorem ipsum" },
    ],
    verification: {
      verified_at: "2026-08-05",
      // One agent. The rubric asks for two, so this is half the bar and
      // `verificationState` reports it as "partial", not "verified".
      agents: ["claude-opus-5 (Claude Code)"],
      notes:
        "Ran against a scratch Node repo: produced src/fixtures.mjs with plausible meeting data and no lorem ipsum. Unambiguous, no clarification needed.",
    },
    est_minutes: 45,
  },
  {
    id: "comp-happy-path",
    title: "Build the happy path, and only the happy path",
    kind: "do",
    phase: "core",
    weight: 1,
    criticality: "must",
    applies_when: competition,
    requires: ["comp-fake-data-first"],
    why: "This is the entire product as far as judging is concerned. Every hour spent on a branch the demo never takes is an hour not spent on the one it does.",
    done_when: [
      {
        text: "The full flow works, start to finish, without you narrating around it",
      },
      { text: "Someone who didn't build it can complete it" },
    ],
    verification: {
      verified_at: "2026-08-05",
      // One agent. The rubric asks for two, so this is half the bar and
      // `verificationState` reports it as "partial", not "verified".
      agents: ["claude-opus-5 (Claude Code)"],
      notes:
        "Produced a working single-flow demo (streaming transcript, summarise button) that renders end to end. Both done_when checks met. The run also surfaced a rendering fault the step does not guard against — see comp-guard-happy-path.",
    },
    est_minutes: 240,
  },
  {
    id: "comp-sponsor-integration",
    title: "Wire the sponsor API you're being judged on",
    kind: "do",
    phase: "core",
    weight: 2,
    criticality: "must",
    applies_when: all(competition, hasSponsorTracks()),
    requires: ["comp-happy-path"],
    why: "The prize needs the integration visible in the demo, not present in the repo. Judges are looking for it specifically.",
    done_when: [
      { text: "The integration does something the demo actually shows" },
      { text: "It still works with the network you'll have on the day" },
    ],
    est_minutes: 90,
  },
  {
    id: "comp-ai-hosted",
    title: "Call a hosted model — nothing local, nothing fine-tuned",
    kind: "do",
    phase: "core",
    weight: 3,
    criticality: "must",
    applies_when: all(competition, needs("ai")),
    requires: ["comp-happy-path"],
    why: "A hosted API is one HTTP call. Running a model locally means a download, a GPU you may not have, and a laptop that overheats mid-demo. Fine-tuning inside a weekend is not a plan.",
    done_when: [
      { text: "One API call, one key, in an env var" },
      {
        text: "A canned fallback response exists for when the API is slow or down",
      },
    ],
    verification: {
      verified_at: "2026-08-05",
      // One agent. The rubric asks for two, so this is half the bar and
      // `verificationState` reports it as "partial", not "verified".
      agents: ["claude-opus-5 (Claude Code)"],
      notes:
        "Produced one hosted API call behind an env var with a timeout and a canned fallback. That done_when is what made the demo survive an unreachable API.",
    },
    est_minutes: 60,
    serves: ["llm"],
  },

  // ------------------------------------------------------------ harden
  {
    id: "comp-triage-cut",
    title: "Cut everything that won't be finished",
    kind: "do",
    phase: "harden",
    weight: 0,
    criticality: "must",
    applies_when: all(competition, underHours(12)),
    requires: ["comp-happy-path"],
    why: "In the last stretch the question stops being what you can add and becomes what you can finish. Half-built features are worse than absent ones — they break in front of judges.",
    done_when: [
      { text: "Anything not demoable is deleted or hidden behind a flag" },
      { text: "What's left is what you'll actually show" },
    ],
    est_minutes: 30,
  },
  {
    id: "comp-demo-environment",
    title: "Freeze the machine you'll demo from",
    kind: "do",
    phase: "harden",
    weight: 1,
    criticality: "must",
    applies_when: competition,
    requires: ["comp-happy-path"],
    why: "Venue wifi fails, and it fails during your slot. Decide now which laptop, which browser, which data, and stop changing it.",
    done_when: [
      { text: "One named machine runs the demo, with the data already seeded" },
      {
        text: "It works with the network unplugged, or you know exactly which parts don't",
      },
      { text: "Nobody pushes to the demo branch after this point" },
    ],
    est_minutes: 45,
  },
  {
    id: "comp-guard-happy-path",
    title: "Stop the happy path crashing when someone clicks wrong",
    kind: "do",
    phase: "harden",
    weight: 2,
    criticality: "should",
    applies_when: competition,
    requires: ["comp-happy-path"],
    why: "Judges take the mouse. They click the thing you never click. A stack trace on the projector undoes the whole demo.",
    done_when: [
      { text: "Empty and error states render something, not a crash" },
      { text: "You've handed it to someone else and watched them use it" },
    ],
    verification: {
      verified_at: "2026-08-05",
      // One agent. The rubric asks for two, so this is half the bar and
      // `verificationState` reports it as "partial", not "verified".
      agents: ["claude-opus-5 (Claude Code)"],
      notes:
        "Caught a real defect: the summarise button stuck on its loading state forever when the call failed, and could stack concurrent requests. Both fixed and re-verified by simulating an offline fetch.",
    },
    est_minutes: 45,
  },

  {
    id: "comp-render-check",
    title: "Look at the demo on the screen you'll present from",
    kind: "do",
    phase: "harden",
    weight: 3,
    criticality: "must",
    applies_when: competition,
    requires: ["comp-happy-path"],
    why: "Working and looking right are different properties, and only one of them is what judges see. A projector is a low-contrast display at a resolution you didn't design for, viewed from ten metres. Broken glyphs, grey-on-grey text and clipped labels all pass every check that isn't a person looking at it.",
    done_when: [
      {
        text: "Opened on the actual display you'll present from, at its resolution",
      },
      {
        text: "Every character renders — no boxes, no question marks, no mojibake",
      },
      { text: "Readable from the back of the room, not just from your laptop" },
      {
        text: "Nothing is clipped, overlapping, or off the bottom of the screen",
      },
    ],
    /**
     * Human, and it cannot be anything else. The failure this exists for is
     * invisible to the tools an agent has: DevCon's own verification demo
     * shipped mojibake that rendered as boxes on screen and came back clean
     * through `curl`, because the bytes were fine and the font was not.
     */
    execution: "human",
    est_minutes: 20,
  },

  // ----------------------------------------------------------- deliver
  {
    id: "comp-demo-script",
    title: "Write and time a three-minute demo",
    kind: "do",
    phase: "deliver",
    weight: 0,
    criticality: "must",
    applies_when: competition,
    requires: ["comp-demo-environment"],
    why: "Adrenaline erases memory and slots are short. The teams that look composed rehearsed; they aren't better at improvising.",
    done_when: [
      {
        text: "Script written, opening with what it does — not how you built it",
      },
      { text: "Run twice out loud, with a timer, inside the limit" },
      { text: "A recording exists as a backup in case the live demo dies" },
    ],
    execution: "needs-input",
    inputs: [
      {
        key: "shows",
        label: "What the demo shows, start to finish",
        placeholder:
          "Open the app, paste a meeting transcript, hit Summarise, read out the action items",
        multiline: true,
      },
      {
        key: "limit",
        label: "Time limit",
        placeholder: "3 minutes",
      },
    ],
    est_minutes: 45,
  },
  {
    id: "comp-submission-video",
    title: "Record the submission video",
    kind: "do",
    phase: "deliver",
    weight: 1,
    criticality: "must",
    applies_when: all(competition, submission("video")),
    requires: ["comp-demo-script"],
    why: "For many events this is what judges actually watch, and it's usually made in a panic in the last twenty minutes. It's the same script you already rehearsed.",
    done_when: [
      { text: "Under the length limit, uploaded, and the link opens" },
      { text: "Audio is audible — screen recordings usually aren't" },
    ],
    execution: "human",
    est_minutes: 45,
  },
  {
    id: "comp-writeup",
    title: "Write the submission text",
    kind: "do",
    phase: "deliver",
    weight: 2,
    criticality: "must",
    applies_when: all(competition, submission("writeup")),
    requires: ["comp-scope-to-demo"],
    why: "Judges read this before they see you, and it's the only part they keep. Every required field is a scored field.",
    done_when: [
      { text: "Every field the portal asks for is filled" },
      { text: "It names the problem before the technology" },
      {
        text: "Sponsor tech is named explicitly if you're entering those prizes",
      },
    ],
    execution: "needs-input",
    inputs: [
      {
        key: "fields",
        label: "The fields the submission portal asks for",
        placeholder:
          "Elevator pitch, problem, what it does, how we built it, challenges, what's next",
        multiline: true,
      },
    ],
    est_minutes: 40,
  },
  {
    id: "comp-deploy-for-judging",
    title: "Deploy somewhere a judge can reach",
    kind: "do",
    phase: "deliver",
    weight: 3,
    criticality: "must",
    applies_when: all(competition, submission("live-demo")),
    requires: ["comp-demo-environment"],
    why: "Only when the rules demand a reachable URL. It's the step most likely to eat four hours for zero scoring benefit, so it exists here gated rather than by default.",
    done_when: [
      { text: "The URL opens on a phone, on someone else's network" },
      { text: "The demo path works there, not just locally" },
    ],
    est_minutes: 60,
  },
  {
    id: "comp-submit-early",
    title: "Submit an hour before the deadline",
    kind: "do",
    phase: "deliver",
    weight: 4,
    criticality: "must",
    applies_when: competition,
    requires: ["comp-demo-script"],
    why: "Submission portals fall over at the deadline, every event, without fail. You can almost always edit after submitting — you cannot submit after closing.",
    done_when: [
      { text: "Submitted with time to spare" },
      { text: "Every required link opens in a private window" },
      { text: "Confirmation screenshotted" },
    ],
    execution: "human",
    est_minutes: 20,
  },

  // -------------------------------------------------------- anti-steps
  {
    id: "comp-avoid-real-auth",
    title: "Don't build real authentication",
    kind: "avoid",
    phase: "core",
    weight: 90,
    criticality: "nice",
    applies_when: all(competition, needs("auth")),
    requires: [],
    why: "You said you need accounts. In a weekend you don't — judges never sign up. A hardcoded current user costs five minutes; a real provider plus a user table costs four hours and scores nothing.",
    done_when: [],
    est_minutes: 0,
  },
  {
    id: "comp-avoid-tests",
    title: "Don't write tests",
    kind: "avoid",
    phase: "core",
    weight: 91,
    criticality: "nice",
    applies_when: competition,
    requires: [],
    why: "Nothing here is maintained after Sunday. Tests protect against future change, and there is no future. The only check that pays is running the demo path yourself.",
    done_when: [],
    est_minutes: 0,
  },
  {
    id: "comp-avoid-deploy",
    title: "Don't deploy to a real host",
    kind: "avoid",
    phase: "harden",
    weight: 90,
    criticality: "nice",
    applies_when: all(competition, not(submission("live-demo"))),
    requires: [],
    why: "Nothing asks for a live URL, so DNS, SSL and a first-time build pipeline at hour 34 buy you nothing. Demo from localhost.",
    done_when: [],
    est_minutes: 0,
  },
  {
    id: "comp-avoid-payments",
    title: "Don't wire real payments",
    kind: "avoid",
    phase: "core",
    weight: 92,
    criticality: "nice",
    applies_when: all(competition, needs("payments")),
    requires: [],
    why: "A checkout screenshot demos identically to a working integration and costs a day less. Live payments also need an account approval you won't get by Sunday.",
    done_when: [],
    est_minutes: 0,
  },
  {
    id: "comp-avoid-design-system",
    title: "Don't build a design system",
    kind: "avoid",
    phase: "core",
    weight: 93,
    criticality: "nice",
    applies_when: competition,
    requires: [],
    why: "Use a component library's defaults and change nothing. Judges score the idea and whether it works — nobody has ever won on custom spacing tokens.",
    done_when: [],
    est_minutes: 0,
  },
  {
    id: "comp-avoid-rewrite",
    title: "Don't rewrite anything after the halfway mark",
    kind: "avoid",
    phase: "core",
    weight: 94,
    criticality: "nice",
    applies_when: competition,
    requires: [],
    why: "The rewrite always looks like the right call and it is how teams arrive at judging with nothing. Ugly and working beats clean and half-finished, and the code dies on Sunday either way.",
    done_when: [],
    est_minutes: 0,
  },
  {
    id: "comp-avoid-new-stack",
    title: "Don't learn a new framework this weekend",
    kind: "avoid",
    phase: "foundation",
    weight: 90,
    criticality: "nice",
    applies_when: competition,
    requires: [],
    why: "The first six hours go to setup errors instead of the build. Familiar beats fashionable, and nobody is scoring your stack.",
    done_when: [],
    est_minutes: 0,
  },
  {
    id: "comp-avoid-same-file",
    title: "Don't all edit the same file",
    kind: "avoid",
    phase: "core",
    weight: 95,
    criticality: "nice",
    applies_when: all(competition, isTeam()),
    requires: [],
    why: "A merge conflict at hour 28 costs more than the feature was worth, and the person resolving it isn't building. Split by file, agreed up front.",
    done_when: [],
    est_minutes: 0,
  },
];

// The combined registry lives in lib/catalog/index.ts. Re-exporting it from
// here would be a cycle: index imports this file.

# Gaps — what to fix, and what only looks like a gap

> Plan only. Nothing here is implemented.
> Written against the Cursor/YC-frame feedback, the two planning docs, and the
> state of the code as of the `devcon-engine-and-catalogs` branch.

---

## The distinction that matters most

The feedback mixes two different kinds of problem, and they need opposite
treatment:

- **Product defects** — things that make DevCon worse for the person using it.
  Fix these regardless of who is watching.
- **Narrative gaps** — things that make DevCon harder to *fund*. Fix these in
  how it's described, not in what it does.

Rebuilding the product to answer a partner objection is how you end up with
something optimised for investors instead of users. Below, they're kept apart
on purpose.

---

## The one gap that dominates everything

**Nobody has finished a project because of DevCon.**

Traction 2/10 is the correct read, and it is not a feature gap — it cannot be
closed by building more surfaces. Every other item on this page is either a
prerequisite for producing that evidence, or it is downstream of it.

Concretely: there is no number for *"of N people who started a plan, M reached
demo/submit/deploy."* Until that number exists, every other claim about DevCon
— including the entire subtraction thesis — is an assertion.

This reframes the whole backlog. The question for any proposed work becomes:
**does this get us closer to that number?** Most current backlog items do not.

---

## Real product gaps

### G1 · Prompts have never been run through an agent
**Severity: blocking.** The catalog rubric says a prompt isn't verified until
it's been pasted into two agents against a real repo and produced working
output. Zero of 53 steps meet that bar.

The `/api/verify` route checks prompts make *true claims* about a repo. It
cannot tell you whether one produces working code. Running a cohort on
unverified prompts tests the wrong thing — a failure would be ambiguous
between "the plan is wrong" and "the prompt is wrong."

**Fix:** run each competition-track prompt through Claude Code and one other
agent against a scratch repo. Record pass/fail and edit until it passes.
~10 steps, so this is days not weeks. Mark `verified_at` per step; the engine
already excludes unverified steps from plans, so this gates itself.

### G2 · Nothing is measured, so the evidence can't be produced
**Severity: blocking, and it precedes G3.** The plan specifies per-step funnel
events — `prompt_copied` and `step_completed` as *separate* events, because
the gap between them is the most diagnostic signal in the product. None of it
is implemented.

You cannot run a cohort and learn anything without this. Instrumenting after
the cohort means the cohort produced no data.

**Fix:** the event taxonomy from the plan, written to a local table.
Deliberately not a vendor — drop-off ranks the catalog fix list, which makes
it product data, not marketing analytics.

### G3 · No return loop beyond a bookmarked URL
**Severity: high for academic, LOW for competition.** This is where I'd push
back on the feedback.

For a 12-week academic project, URL-as-identity is genuinely fragile and the
objection is correct. For a **36-hour hackathon it is a non-issue** — nobody
loses a bookmark inside one weekend.

So this is not "add accounts because an investor asked." It's a reason to run
the first cohort on the **competition track**, where the gap doesn't bite,
and let that cohort tell you whether accounts are actually needed. The parent
plan already sequenced competition first for exactly this kind of reason.

**Fix:** none yet. Deliberate. Revisit after the first cohort.

### G4 · Catalog freshness has no owner or process
**Severity: medium, rising over time.** 53 steps and 30 providers, with
`last_verified` fields that nothing checks. Free tiers change quarterly.

**Fix:** a CI check that fails when any provider's `last_verified` is older
than 90 days. Cheap, and converts a silent rot into a visible task.

### G5 · Only the competition catalog is small enough to verify quickly
The commercial catalog is 31 steps and the academic 22. Verifying all three
tracks before the first cohort is weeks of work for evidence you don't need
yet.

**Fix:** verify the competition track only (~10 steps + 7 anti-steps).
Leave the other two marked unverified — the engine already handles that.

---

## Narrative gaps — change the words, not the code

### N1 · Lead with the shared bottleneck, not with students
The feedback's own correction is the right one: DevCon is one engine, three
contexts. Academic was a *release order* choice, never the market.

Nothing in the product changes. The landing page, README and any application
lead with the bottleneck every builder has — order and wiring and what to
skip — and use the tracks as **proof the engine is context-native**, not as
the identity.

### N2 · The name
"DevCon" collides with developer conferences and the search term is crowded.
Already logged in both planning docs. Cheap now, expensive after any
marketing. Still open, still unblocked by anything.

### N3 · Pricing
Deferred, and the feedback agrees that's fine this early. Nothing to do.
The recorded direction — one-time payment, BYO API key, paid extra if DevCon
supplies agent access — is unchanged.

---

## Where I'd push back

**"Cursor/Claude could ship this."** Partly true and worth taking seriously,
but it's not a gap to fix — it's the reason the moat is the catalog and the
measured loop rather than the UI. That's already the thesis. Building more UI
in response would make it *less* defensible, not more.

**"They'd want accounts sooner."** Only true for the academic track. Adding
accounts before the first cohort would be building for a fundraising
objection rather than for a user in a 36-hour window. See G3.

**"Catalog is an ops burden."** Correct, and it's the moat. The burden *is*
the defensibility — a thing that's cheap to maintain is cheap to copy.

---

## Ordered plan

The order is forced by dependency, not preference.

| # | Work | Why it must come here |
|---|---|---|
| 1 | ~~**Instrument the funnel** (G2)~~ — **DONE** | Taxonomy, local store, funnel aggregation, ranked fix list, and the Funnel section all built and verified firing. |
| 2 | **Verify the competition prompts** (G1, G5) | Running a cohort on unverified prompts makes failure un-diagnosable. |
| 3 | **Run one hackathon cohort** | The only thing that closes the dominant gap. 10–50 teams. |
| 4 | **Read the drop-off, fix the catalog** | The flywheel from the plan. First time it has real input. |
| 5 | Accounts + return loop (G3) | Only if the cohort shows it's needed. |
| 6 | `last_verified` CI check (G4) | Independent, do it whenever. |
| — | Name, positioning, README (N1, N2) | Not blocked by any of the above. Do in parallel. |

**Everything currently unstarted on `checklist.md` — waitlist, docs page,
pricing page, sign-in — sits below line 4.** They are surfaces, and surfaces
are not the gap.

---

## The measurable outcome

One number, from one weekend:

> Of the teams that created a plan, what percentage demoed?

With a control group if possible — teams at the same event who didn't use it.
That single number is what converts every claim in both planning documents
from a hypothesis into a finding, and it's the thing the feedback correctly
identifies as missing.

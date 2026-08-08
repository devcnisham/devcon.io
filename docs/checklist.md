# DevCon — Page Build Checklist

Surfaces, and where each one actually stands. Four are live at
https://devcon-hazel.vercel.app.

- [x] **Landing page** (`/`) — hero performs the subtraction with a live example
      plan, waitlist capture, three facts. Server-rendered.
- [x] **Waitlist** — on the landing page rather than its own route. Validates,
      deduplicates on a lowercased email, and shows a confirmation state.
      **It has no backend**: addresses are written to browser `localStorage`
      and never leave the machine, so the "we'll email you" copy is a promise
      the product cannot currently keep. Recorded in `HANDOFF.md`.
- [x] **Docs page** (`/docs`) — what it reads, how a plan is built, the
      execution modes, verification state, and what isn't built. Every count is
      read from the catalog at build time.
- [x] **Workspace** (`/canvas`) — plan, step detail, prompts, board, hidden
      drawer, deliverables, registry, funnel, integrations, settings. The
      picker lives at `/start`.
- [ ] **Sign in / Sign up page** — auth entry, both modes. Blocked on there
      being any auth at all; there are no accounts.
- [ ] **Onboarding page** — intake, profile confirm, stack picker. The four
      ingest sources currently do this job from the canvas.
- [ ] **Pricing page** — tiers and comparison.

---

Note: pricing and paywalls sit under "Out of scope for v1.0.0" in
`v1.0.0-solo-team-plan.md`. Pricing page kept here as requested — treat as
marketing surface, not billing.

Note on priority: `docs/gaps-plan.md` puts every unstarted item here below
"read the drop-off, fix the catalog". These are surfaces, and surfaces are not
the gap — nobody has finished a project because of DevCon yet.

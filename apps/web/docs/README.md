# devstep — Project Documentation

Single source of truth for what devstep is, how it is built, and what comes
next. Read 01–06 in order; the three trackers below them are live state.

| #   | Document                                   | What it answers                                               |
| --- | ------------------------------------------ | ------------------------------------------------------------- |
| 01  | [Product](01-product.md)                   | What are we building, for whom, and why                       |
| 02  | [Architecture](02-architecture.md)         | Stack, folder structure, and the reasoning behind each choice |
| 03  | [Database](03-database.md)                 | Schema, grown in six waves                                    |
| 04  | [Roadmap](04-roadmap.md)                   | MVP scope, 27-step build order, V2 backlog                    |
| 05  | [Feature workflow](05-feature-workflow.md) | The 18 steps every feature passes through                     |
| 06  | [Status](06-status.md)                     | What is actually built right now                              |

### Live trackers

| Document                  | What it holds                                                          |
| ------------------------- | ---------------------------------------------------------------------- |
| [Phase tracker](phase.md) | Every phase item, its flow diagram, and its live status                |
| [Blockers](blocker.md)    | What is blocked, which external services need connecting, what remains |
| [Bug log](bug.md)         | Every defect found: symptom, root cause, fix, how it was caught        |

These three are updated as work happens, enforced by a Stop hook
(`.claude/hooks/check-trackers.sh`) that blocks a turn changing `src/` without
touching a tracker.

## The one rule

Nothing gets built until it is explicitly requested. Scope, order, and timing
are the project owner's call — see [Phase tracker](phase.md) for the live
position, [Status](06-status.md) for what exists, and [Roadmap](04-roadmap.md)
for what comes next.

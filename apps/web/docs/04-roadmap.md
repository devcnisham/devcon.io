# 04 — Roadmap

## The MVP

The first version must prove **one chain works end to end**:

```
CREATE PROJECT
      ↓
IMPORT PROJECT
      ↓
DETECT STACK
      ↓
UNDERSTAND PROJECT
      ↓
GENERATE ROADMAP
      ↓
GUIDE DEVELOPER
      ↓
CONNECT GITHUB
      ↓
TEST
      ↓
PREVIEW
      ↓
DEPLOY
      ↓
SHOW HEALTH
```

That is the real MVP. **Anything that does not serve a link in this chain is out
of v1** — no matter how appealing.

Explicitly out of v1: AI assistant, integrations beyond what GitHub/deploy
needs, team collaboration, QA module, releases, security, dependencies,
learning, templates, automation, desktop app.

## Phase 0 — Production Foundation

Steps 01–06 below are phase 0: **build the platform itself**. Not a prototype —
devstep as a real running product, where things persist, CI runs, and the app
deploys. Its result is _a user can create and manage a project_. Live detail in
[phase.md](phase.md).

## Build order (27 steps)

Do not start with AI, dozens of integrations, or team features.

| #   | Step                        |     | #   | Step                       |
| --- | --------------------------- | --- | --- | -------------------------- |
| 01  | Set up architecture         |     | 15  | Build GitHub integration   |
| 02  | Set up database             |     | 16  | Build testing              |
| 03  | Set up authentication       |     | 17  | Build CI/CD                |
| 04  | Build workspace             |     | 18  | Build Supabase integration |
| 05  | Build project creation      |     | 19  | Build Vercel integration   |
| 06  | Build project dashboard     |     | 20  | Build preview              |
| 07  | Build local project import  |     | 21  | Build QA                   |
| 08  | Build codebase scanner      |     | 22  | Build production readiness |
| 09  | Build framework detection   |     | 23  | Build deployment           |
| 10  | Build technology detection  |     | 24  | Build monitoring           |
| 11  | Build project intelligence  |     | 25  | Build project health       |
| 12  | Build roadmap engine        |     | 26  | Test the entire journey    |
| 13  | Build task/step system      |     | 27  | Launch MVP                 |
| 14  | Build documentation mapping |     |     |                            |

Current position: [Status](06-status.md).

## V2 — only after the MVP chain is proven

```
Feature Traceability → Releases → AI Assistant → Debugging
   → Documentation Generation → Learning System → Templates
   → More Integrations → Team Collaboration → AI Coding Agent → Automation
```

Nothing on this list justifies work during v1. Note that AI lands third in V2,
not in v1 — AI is a layer over structured project data, and that data has to
exist first.

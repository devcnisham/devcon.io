# 01 — Product

## Definition

devstep is a **Developer Project Operating System**.

It takes a developer — especially a new one — from
**Idea → Plan → Build → Test → Deploy → Monitor → Maintain** inside one platform,
instead of jumping between VS Code/Cursor, GitHub, Supabase, Vercel, Jira,
Notion, documentation, browser, terminal, testing tools, and monitoring tools.

## Problem

A new developer can write code but does not know the complete
software-development process. After the code is written, they are stuck on:

```
What should I build?  →  How do I structure it?  →  What do I do next?
   →  How do I use Git?  →  How do I test?  →  How do I set up CI/CD?
   →  How do I deploy?  →  How do I monitor it?  →  How do I fix production?
```

These workflows exist today, but fragmented across a dozen disconnected tools.

## Solution

```
                        devstep
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
      BUILD              SHIP              MANAGE
        │                  │                  │
     Codebase           Testing           Monitoring
     Roadmap            CI/CD             Health
     Features           Preview           Errors
     AI                 Deploy            Releases
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ↓
                     INTEGRATIONS
```

The platform answers three questions at every moment:

1. What is happening with my project?
2. What should I do next?
3. How do I actually do it?

Which is: **Understand → Plan → Build → Verify → Ship → Monitor**.

## The core mental model

devstep is **not** "a dashboard with lots of features." It is three layers.

| Layer              | Contains                                                                            |
| ------------------ | ----------------------------------------------------------------------------------- |
| **1 — Understand** | project, codebase, technology, architecture, features, dependencies, infrastructure |
| **2 — Guide**      | roadmap, tasks, documentation, learning, next action, best practices, AI            |
| **3 — Execute**    | git, code, testing, CI/CD, preview, QA, deployment, monitoring                      |

> **UNDERSTAND → GUIDE → EXECUTE**

This is the inclusion test. When a new feature is proposed, ask which layer it
serves. If it serves none, it does not belong in the product.

## Core product loop

```
create project → connect/import → understand → plan → build → test → CI/CD
   → preview → QA → deploy → monitor → maintain → build next feature
```

## Target users

**Primary:** new developers — people who can code but do not fully understand
professional end-to-end development.

**Secondary:** students, indie hackers, solo developers, junior developers,
small teams, developers building SaaS, developers building side projects.

## Vision

One place to understand, build, ship, and operate software — GitHub + project
management + documentation + CI/CD + deployment + monitoring + AI coding
assistant + developer education — centered on the project lifecycle.

## Product modules

27 potential modules. **This is a menu, not a launch checklist** — the full
surface area the platform can eventually cover, not a plan to build.

Each module is placed in the layer it serves ([Understand → Guide →
Execute](#the-core-mental-model)) and marked against v1 scope. "v1" means it
serves a link in the [MVP chain](04-roadmap.md#the-mvp); everything else waits.

| #   | Module                | Layer      | In v1?                              |
| --- | --------------------- | ---------- | ----------------------------------- |
| 01  | Dashboard             | Understand | ✅ understand project               |
| 02  | Projects              | Understand | ✅ create project                   |
| 03  | Codebase Intelligence | Understand | ✅ detect stack, understand project |
| 04  | Roadmap               | Guide      | ✅ generate roadmap                 |
| 05  | Features              | Guide      | ✅ guide developer                  |
| 06  | Tasks                 | Guide      | ✅ guide developer                  |
| 07  | Documentation         | Guide      | ✅ guide developer                  |
| 08  | Integrations          | Execute    | ◐ GitHub only                       |
| 09  | Git                   | Execute    | ✅ connect GitHub                   |
| 10  | Testing               | Execute    | ✅ test                             |
| 11  | CI/CD                 | Execute    | ✅ test                             |
| 12  | Preview               | Execute    | ✅ preview                          |
| 13  | QA                    | Execute    | ◐ minimal                           |
| 14  | Deployment            | Execute    | ✅ deploy                           |
| 15  | Monitoring            | Execute    | ✅ show health                      |
| 16  | Project Health        | Execute    | ✅ show health                      |
| 17  | Security              | Execute    | ✗                                   |
| 18  | Dependencies          | Understand | ✗                                   |
| 19  | Environments          | Execute    | ✗                                   |
| 20  | Releases              | Execute    | ✗ — V2                              |
| 21  | AI Assistant          | Guide      | ✗ — V2, third                       |
| 22  | AI Coding Agent       | Guide      | ✗ — V2, late                        |
| 23  | Debugging             | Execute    | ✗ — V2                              |
| 24  | Learning              | Guide      | ✗ — V2                              |
| 25  | Templates             | Guide      | ✗ — V2                              |
| 26  | Teams                 | —          | ✗ — V2                              |
| 27  | Automation            | Execute    | ✗ — V2, last                        |

✅ in v1 · ◐ partial in v1 · ✗ not in v1

**14 modules serve v1 fully, 2 partially, 11 not at all.** The discipline is
the ✗ column: a module that serves no link in the MVP chain does not get built,
however appealing. AI sits at 21 and 22 deliberately — it is a layer over
structured project data, and modules 01–16 are what produce that data.

Build order in [04-roadmap.md](04-roadmap.md); live status in
[phase.md](phase.md).

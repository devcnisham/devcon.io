# 02 — Architecture

## Principle

**Structure around domains, not layers.** Each domain (roadmap, codebase,
integrations…) is self-contained, so it can be read, moved, or deleted in one
place.

## Target tree

`✅` exists · `⬜` planned, not created yet.

```
src/
├── app/                     ✅
│   ├── (auth)/              ✅ login, signup, forgot/reset password, verify email
│   ├── (marketing)/         ✅ public landing
│   ├── dashboard/           ✅
│   ├── projects/            ✅ list, new, import
│   ├── workspaces/          ✅ new
│   ├── activity/            ✅
│   ├── settings/            ✅ workspace, project
│   └── api/                 ✅ health
│
├── middleware.ts            ✅ edge route guard
│
├── features/                one folder per domain — see src/features/README.md
│   ├── auth/                ✅
│   ├── workspace/           ✅
│   ├── project/             ✅
│   ├── dashboard/           ✅
│   ├── codebase/            ✅
│   ├── roadmap/             ⬜
│   ├── features/            ⬜
│   ├── documentation/       ⬜
│   ├── integrations/{github,supabase,vercel}/   ⬜
│   ├── testing/  cicd/  preview/  qa/           ⬜
│   ├── deployments/  monitoring/  health/       ⬜
│   ├── dependencies/  environments/  releases/  ⬜
│   ├── ai/  debugging/  learning/  templates/   ⬜
│   └── common/              ⬜
│
├── components/
│   ├── ui/                  ✅ shadcn/ui output — generated, do not hand-edit
│   └── layout/              ✅ app shell: sidebar, topbar, theme toggle
│
├── lib/
│   ├── env.ts  utils.ts     ✅
│   └── database/  auth/  api/  security/  logging/  errors/   ⬜
│
├── config/                  ✅ site.ts, nav.ts
├── types/                   ✅
└── hooks/                   ✅

docs/                        ✅ this documentation
tests/                       ✅ stubs only; unit tests live beside their source
scripts/                     ⬜
```

Unit tests sit next to the code they cover (`lib/thing.ts` →
`lib/thing.test.ts`) rather than in a mirrored tree, so a feature stays
self-contained. `tests/` holds shared fixtures and stubs.

### Feature folder shape

```
src/features/<feature-name>/
├── components/     UI specific to this feature
├── hooks/          hooks specific to this feature
├── lib/            data access, server actions, pure logic
├── types.ts
└── index.ts        public surface — the only file other code imports from
```

Rules: import a feature through its `index.ts` only; features never import each
other; routes stay thin and compose feature exports. Full detail in
`src/features/README.md`.

**Known, plan-mandated exception:** shared domain primitives live in the
workspace feature, and other features import them directly — the project and
codebase services use `can`/`WorkspaceRole` from
`@/features/workspace/lib/permissions` (permission gates) and `uniqueSlug`
from `@/features/workspace/lib/slug`. This was prescribed by the local-database
plan (workspace owns the permission model) and is deliberately not refactored;
hoist these primitives to `src/lib/` when a third feature needs them.

## Stack

| Concern         | Choice                                                             |
| --------------- | ------------------------------------------------------------------ |
| Frontend        | Next.js (App Router) + React + TypeScript                          |
| UI              | Tailwind CSS + shadcn/ui                                           |
| Backend         | Next.js server — Server Actions, Route Handlers, Server Components |
| Database        | PostgreSQL via Supabase                                            |
| ORM             | Drizzle (Prisma as fallback)                                       |
| Auth            | Supabase Auth                                                      |
| Storage         | Supabase Storage                                                   |
| Validation      | Zod                                                                |
| State           | React state → Server Components → URL state → TanStack Query       |
| Background jobs | Trigger.dev                                                        |
| Monitoring      | Sentry                                                             |
| Testing         | Vitest (unit/integration) + Playwright (e2e)                       |
| Source control  | GitHub                                                             |
| Deployment      | Vercel                                                             |
| CI/CD           | GitHub Actions                                                     |
| AI              | thin provider abstraction over OpenAI / Anthropic / Google         |
| Desktop         | later — Tauri vs Electron undecided                                |

## Decisions and their reasoning

**Guiding constraint: solo developer.** Keep the initial stack simple.

- **No separate backend.** Next.js server capability covers day one. Heavy
  workloads move to workers/services later, only if genuinely required.
- **Supabase** because auth, storage, database, RLS, and realtime arrive
  together.
- **Drizzle** for a lightweight, TypeScript-first data layer.
- **Auth:** email/password and OAuth first; GitHub login later.
- **Storage scope:** project metadata, user files, documentation assets,
  avatars. **Never upload an entire local source repository to the cloud** —
  local project analysis is the eventual desktop app's job.
- **State:** no heavy state library up front. Add Zustand only if real
  client-side global state appears.
- **Zod** covers API validation, forms, external responses, environment
  variables, and webhooks.
- **Background jobs** handle codebase scanning and detection, repository sync,
  documentation indexing, deployment sync, and AI analysis.
- **AI is a layer over structured project data, not the product.** Provider
  switching must always be possible; local models later.
- **Monitoring:** Sentry first; PostHog / Better Stack / Datadog later.
- **Source control:** GitHub first; GitLab and Bitbucket later.

## The server-only boundary

A feature's `index.ts` is reachable from client components, so anything it
re-exports is bundled for the browser. Server-only code — password hashing,
crypto, cookie headers, database access — is exported from a separate
`server.ts` and imports the `server-only` package, which turns a mistaken
client import into a build error instead of a silent leak.

```
src/features/<feature>/
├── index.ts     safe for client components
└── server.ts    server-only; imports "server-only"
```

`src/features/auth/` is the reference implementation.

## CI/CD pipeline

devstep uses CI/CD on itself from the beginning.

```
Push → Install → Lint → Type Check → Test → Build → Deploy
```

# Features

One folder per domain. All code for a feature lives here — components, hooks,
server logic, types — so a feature can be read, moved, or deleted in one place.

## What exists today

| Feature      | Covers                                                                | State                              |
| ------------ | --------------------------------------------------------------------- | ---------------------------------- |
| `auth/`      | Signup, login, reset, verification, security primitives, route guards | UI + logic; no backend             |
| `workspace/` | Creation, rename, delete, activity, roles and capabilities            | UI + logic; no storage             |
| `project/`   | Creation wizard, technology catalogue, project settings               | UI + logic; no storage             |
| `dashboard/` | Progress, health scoring, next-action ranking                         | Logic + panels; no data            |
| `codebase/`  | Local import: ignore rules, classification, scanner                   | Works end to end; index not stored |
| `_template/` | Copy this to start a new feature                                      | —                                  |

The full set of planned domains is in
[`docs/02-architecture.md`](../../docs/02-architecture.md); live status per
feature is in [`docs/phase.md`](../../docs/phase.md).

## Shape

```
src/features/<feature-name>/
├── components/     UI specific to this feature
├── hooks/          React hooks specific to this feature
├── lib/            data access, server actions, pure logic
├── types.ts        feature types
├── index.ts        public surface — safe for client components
└── server.ts       server-only surface (optional)
```

## Rules

- **Import a feature through its `index.ts`**, never reach into internals:
  ```ts
  import { ProjectWizard } from "@/features/project"; // yes
  import { ProjectWizard } from "@/features/project/components/project-wizard"; // no
  ```
- **Server-only code goes in `server.ts`, never `index.ts`.** The barrel is
  reachable from client components, so anything re-exported there is bundled for
  the browser. `server.ts` imports the `server-only` package, which turns a
  mistaken client import into a build error. `auth/` is the reference.
- **Features must not import each other.** If two need the same thing, it
  belongs in `src/components`, `src/lib`, or `src/hooks`. (`workspace/` and
  `project/` currently import `AuthAlert` from `auth/` — a shared alert
  component that should move to `src/components` when a third caller appears.)
- **Routes stay thin.** A page in `src/app/**` composes feature exports and
  handles routing concerns; it does not hold feature logic.
- **Pure logic gets tests.** Every `lib/*.ts` with real behaviour has a
  `lib/*.test.ts` beside it, written before the implementation.

## Adding a feature

```bash
cp -R src/features/_template src/features/<feature-name>
```

Then rename the placeholders inside and export the public pieces from
`index.ts`.

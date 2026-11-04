# Local Database + Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make devstep persist for real: Supabase local stack, Drizzle wave 1+2 schema, live sessions, and workspace/project/canvas flows that actually save.

**Architecture:** Supabase local (CLI + Docker) provides Postgres and Auth. Drizzle ORM owns tables via generated migrations; RLS policies live in `supabase/migrations/*.sql` applied by a setup script. Feature logic stays pure and injected (fake-db testable); app-layer glue in `src/lib/server/` binds features to Drizzle.

**Tech Stack:** Next.js 16.3 (App Router, server actions), Supabase CLI (local), `@supabase/supabase-js`, `@supabase/ssr`, Drizzle ORM + drizzle-kit, `postgres` (node-postgres), Zod, Vitest.

## Global Constraints

- Never import `process.env` directly — read via `@/lib/env` (`src/lib/env.ts`).
- Feature code in `src/features/<name>/`, exported through its `index.ts` barrel. Features never import each other.
- Server-only code (crypto, cookies, database) exported from a feature's `server.ts`, which imports `server-only`. Server actions live in app-layer or `"use server"` files, never the client barrel.
- `src/components/ui/**` is shadcn-generated — do not hand-edit.
- Write the test first, watch it fail, then implement. Security and business logic get tests.
- Gates: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass before a task is done.
- Trackers: `docs/phase.md`, `docs/06-status.md`, `docs/blocker.md`, `docs/bug.md` updated the moment something changes (Stop hook enforces when `src/` changes).
- `uuid` primary keys (decision D5). Timestamps `created_at`/`updated_at` on every table. Soft delete via `deleted_at` on `workspaces` and `projects`.
- Supabase `service_role` key is server-only: never `NEXT_PUBLIC_`, never committed.
- Local dev only this plan: cloud swap later = change env vars, no code.

---

### Task 1: Supabase local stack + env vars

**Files:**
- Create: `.env.local` (gitignored), `.env.example`
- Modify: `src/lib/env.ts`
- Test: `src/lib/env.test.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `parseEnvSchema(schema, source)` exported from `src/lib/env.ts`; env keys `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client).

- [ ] **Step 1: Write the failing test**

Create `src/lib/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEnvSchema } from "./env";

describe("parseEnvSchema", () => {
  it("returns values for present variables", () => {
    const parsed = parseEnvSchema(
      { A: { value: "x", required: true } } as const,
      {}
    );
    expect(parsed.A).toBe("x");
  });

  it("throws naming missing required variables", () => {
    expect(() =>
      parseEnvSchema(
        {
          A: { value: undefined, required: true },
          B: { value: undefined, required: true },
        } as const,
        {}
      )
    ).toThrow("A, B");
  });

  it("returns empty string for absent optional variables", () => {
    const parsed = parseEnvSchema(
      { OPT: { value: undefined, required: false } } as const,
      {}
    );
    expect(parsed.OPT).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/env.test.ts`
Expected: FAIL — `parseEnvSchema` is not exported.

- [ ] **Step 3: Implement**

Modify `src/lib/env.ts` — extract the parse function so it is pure and testable, add the new variables:

```ts
type EnvVar = {
  value: string | undefined;
  required: boolean;
};

/** Exported for tests: pure — reads from `source`, never `process.env`. */
export function parseEnvSchema<T extends Record<string, EnvVar>>(
  schema: T,
  _source: Record<string, string | undefined>
): { [K in keyof T]: string } {
  const missing: string[] = [];
  const parsed = {} as { [K in keyof T]: string };

  for (const key of Object.keys(schema) as (keyof T)[]) {
    const { value, required } = schema[key];
    if (required && (value === undefined || value === "")) {
      missing.push(String(key));
      continue;
    }
    parsed[key] = value ?? "";
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return parsed;
}

const serverSchema = {
  NODE_ENV: { value: process.env.NODE_ENV, required: true },
  DATABASE_URL: { value: process.env.DATABASE_URL, required: true },
  SUPABASE_URL: { value: process.env.SUPABASE_URL, required: true },
  SUPABASE_ANON_KEY: { value: process.env.SUPABASE_ANON_KEY, required: true },
  SUPABASE_SERVICE_ROLE_KEY: {
    value: process.env.SUPABASE_SERVICE_ROLE_KEY,
    required: true,
  },
} satisfies Record<string, EnvVar>;

const clientSchema = {
  NEXT_PUBLIC_APP_URL: {
    value: process.env.NEXT_PUBLIC_APP_URL,
    required: false,
  },
  NEXT_PUBLIC_SUPABASE_URL: {
    value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    required: false,
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    required: false,
  },
} satisfies Record<string, EnvVar>;

// parse() below replaced by parseEnvSchema(schema, process.env) calls.
export const env = {
  ...parseEnvSchema(clientSchema, process.env),
  ...(typeof window === "undefined"
    ? parseEnvSchema(serverSchema, process.env)
    : ({} as { [K in keyof typeof serverSchema]: string })),
};

export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Init and start local Supabase**

Run: `npx supabase@latest init`
Then: `npx supabase@latest start`
Expected: Docker containers start; output ends with `started supabase local development setup`.

- [ ] **Step 6: Capture local credentials**

Run: `npx supabase@latest status -o env`
Expected: block of env lines. Create `.env.local`:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key from status -o env>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from status -o env>
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from status -o env>
```

Create `.env.example` with the same keys, values blank, plus a comment: `# Copy to .env.local and fill. Local values: run "npx supabase status -o env".`

- [ ] **Step 7: Verify gates**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green (env parse throws only when the server actually imports `env` without the vars — which the dev server does next task; for now, tests + typecheck prove the surface).

- [ ] **Step 8: Commit**

```bash
git add .env.example src/lib/env.ts src/lib/env.test.ts supabase/config.toml
git commit -m "feat: local supabase stack and env wiring"
```

---

### Task 2: Drizzle client + connection smoke test

**Files:**
- Modify: `package.json` (deps + script)
- Create: `drizzle.config.ts`, `src/features/database/server.ts`, `src/features/database/index.ts`, `scripts/db-smoke.mjs`
- Test: `scripts/db-smoke.mjs` (run directly, not vitest)

**Interfaces:**
- Consumes: `DATABASE_URL` from Task 1.
- Produces: `db` (Drizzle client singleton) exported from `src/features/database/server.ts`.

- [ ] **Step 1: Install dependencies**

Run: `npm install drizzle-orm postgres` then `npm install -D drizzle-kit dotenv`
Expected: 0 vulnerabilities.

- [ ] **Step 2: Write the smoke script**

Create `scripts/db-smoke.mjs`:

```js
// Connects to the local database and prints one row. Fails loudly when the
// connection or the query fails — this is the "database exists" gate.
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const rows = await sql`select 1 as ok`;
console.log(JSON.stringify(rows));
await sql.end();
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node scripts/db-smoke.mjs`
Expected: FAIL with `ECONNREFUSED` if Supabase stopped — verify by running with `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/nope node scripts/db-smoke.mjs` (error). With the real local stack running it will pass; the point is the script surfaces connection problems.

- [ ] **Step 4: Create the database feature**

Create `src/features/database/server.ts`:

```ts
import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * The single Drizzle client. Server-only: a client import fails the build.
 */
const client = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(client, { schema });
```

Create `src/features/database/schema.ts` (placeholder until Task 3):

```ts
/**
 * Drizzle schema. Grown in waves (docs/03-database.md) — wave 1 in Task 3,
 * wave 2 in Task 4.
 */
export {};
```

Create `src/features/database/index.ts`:

```ts
/**
 * Client-safe barrel. The database client is server-only — import it from
 * `@/features/database/server`, never from here.
 */
export {};
```

Create `drizzle.config.ts`:

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./src/features/database/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Add script to `package.json`:

```json
"db:smoke": "node scripts/db-smoke.mjs"
```

- [ ] **Step 5: Run the smoke test against the real local stack**

Run: `npm run db:smoke`
Expected: prints `[{"ok":1}]`.

- [ ] **Step 6: Verify gates**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts scripts/db-smoke.mjs src/features/database/
git commit -m "feat: drizzle client and connection smoke test"
```

---

### Task 3: Wave 1 schema, migration, RLS

**Files:**
- Modify: `src/features/database/schema.ts`, `package.json` (script)
- Create: `supabase/migrations/0001_wave1_rls.sql`, `scripts/db-setup.mjs`
- Test: `src/features/database/schema.test.ts` (new), `scripts/db-tables.mjs` (new, run directly)

**Interfaces:**
- Consumes: `db` from Task 2.
- Produces: table objects `users`, `workspaces`, `workspaceMembers`, `projects`, `projectMembers`, `projectIntegrations` from `src/features/database/schema.ts`; `npm run db:setup` applies migrations + RLS.

- [ ] **Step 1: Write the failing schema test**

Create `src/features/database/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  projectIntegrations,
  projectMembers,
  projects,
  users,
  workspaceMembers,
  workspaces,
} from "./schema";

describe("wave 1 schema", () => {
  it("exposes all six wave 1 tables", () => {
    for (const table of [
      users,
      workspaces,
      workspaceMembers,
      projects,
      projectMembers,
      projectIntegrations,
    ]) {
      expect(table).toBeDefined();
    }
  });

  it("soft-deletes only owner-owned tables", () => {
    expect(Object.keys(workspaces).length > 0).toBe(true);
    // deleted_at must exist on workspaces and projects, nowhere else.
    const hasDeletedAt = (t: object, col: string) =>
      Object.hasOwn(Object.values(t).find((v) => v?.name === col) ?? {}, "name");
    expect(hasDeletedAt(workspaces, "deleted_at")).toBe(true);
    expect(hasDeletedAt(projects, "deleted_at")).toBe(true);
    expect(hasDeletedAt(users, "deleted_at")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/database/schema.test.ts`
Expected: FAIL — `users` etc. are not exported.

- [ ] **Step 3: Implement wave 1 schema**

Replace `src/features/database/schema.ts`:

```ts
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => sql`now()`)
    .notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("workspaces_slug_unique").on(table.slug)]);

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // WorkspaceRole values; checked in app layer + RLS
  ...timestamps,
}, (table) => [
  uniqueIndex("workspace_members_ws_user_unique").on(
    table.workspaceId,
    table.userId
  ),
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  type: text("type"), // PROJECT_TYPES values
  visibility: text("visibility").notNull().default("private"),
  status: text("status").notNull().default("active"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("projects_workspace_slug_unique").on(
    table.workspaceId,
    table.slug
  ),
]);

export const projectMembers = pgTable("project_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("project_members_project_user_unique").on(
    table.projectId,
    table.userId
  ),
]);

export const projectIntegrations = pgTable("project_integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  config: jsonb("config").notNull().default({}),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("project_integrations_project_kind_unique").on(
    table.projectId,
    table.kind
  ),
]);

export const usersRelations = relations(users, () => ({
  workspaceMemberships: workspaceMembersMany(),
}));

export const workspacesRelations = relations(workspaces, () => ({
  members: workspaceMembersMany(),
  projects: projectsMany(),
}));

// Helper relation shims so the imports below resolve; full relations used
// from Task 8 onward.
function workspaceMembersMany() {
  return { many: null as never };
}
function projectsMany() {
  return { many: null as never };
}
```

Wait — this relation block is wrong. Replace it with real relations (simpler and correct):

```ts
export const usersRelations = relations(users, ({ many }) => ({
  workspaceMemberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),
  integrations: many(projectIntegrations),
}));
```

(Plan reviewer: use this second block, drop the helper-shim block.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/database/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Write RLS SQL**

Create `supabase/migrations/0001_wave1_rls.sql`:

```sql
-- Wave 1 RLS. Applied by scripts/db-setup.mjs AFTER drizzle migrations
-- create the tables, so these policies always find their targets.

alter table users enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_integrations enable row level security;

-- Users: each row visible only to its owner.
create policy "users_self_read" on users for select
  using (auth.uid() = id);

-- Workspaces: readable by members.
create policy "workspaces_member_read" on workspaces for select
  using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = workspaces.id
        and workspace_members.user_id = auth.uid()
    )
  );

-- Workspace members: readable by fellow members.
create policy "workspace_members_read" on workspace_members for select
  using (
    exists (
      select 1 from workspace_members as me
      where me.workspace_id = workspace_members.workspace_id
        and me.user_id = auth.uid()
    )
  );

-- Projects: readable by workspace members.
create policy "projects_member_read" on projects for select
  using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = projects.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );

create policy "project_members_read" on project_members for select
  using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = (
        select workspace_id from projects where projects.id = project_members.project_id
      )
        and workspace_members.user_id = auth.uid()
    )
  );

create policy "project_integrations_read" on project_integrations for select
  using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = (
        select workspace_id from projects where projects.id = project_integrations.project_id
      )
        and workspace_members.user_id = auth.uid()
    )
  );

-- Writes: the app performs permission checks in server actions (the
-- authoritative enforcement point, from workspace/lib/permissions.ts) and
-- writes via the service_role connection. Client anon writes are denied.
```

- [ ] **Step 6: Write the setup script**

Create `scripts/db-setup.mjs`:

```js
// Applies Drizzle migrations, then the Supabase RLS SQL migrations.
// Order matters: RLS policies reference tables the Drizzle migrations create.
import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import postgres from "postgres";

execSync("npx drizzle-kit migrate", { stdio: "inherit" });

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const rls = readFileSync(
  new URL("../supabase/migrations/0001_wave1_rls.sql", import.meta.url),
  "utf8"
);
await sql.unsafe(rls);
await sql.end();
console.log("db:setup complete");
```

Create `scripts/db-tables.mjs`:

```js
// Prints the tables Drizzle created — the "wave 1 exists" gate.
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const rows = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public'
  order by table_name`;
console.log(rows.map((r) => r.table_name).join("\n"));
await sql.end();
```

Add to `package.json` scripts:

```json
"db:setup": "node scripts/db-setup.mjs",
"db:tables": "node scripts/db-tables.mjs"
```

- [ ] **Step 7: Generate migration and apply everything**

Run: `npx drizzle-kit generate` then `npm run db:setup` then `npm run db:tables`
Expected: migration SQL appears under `drizzle/migrations/`; `db:setup` ends with `db:setup complete`; `db:tables` lists `project_integrations, project_members, projects, users, workspace_members, workspaces`.

- [ ] **Step 8: Verify gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 9: Update trackers and commit**

`docs/phase.md`: flip 0.3 items A/B/C storage notes to 🟡 with "storage landed (drizzle wave 1)" notes; `docs/blocker.md`: B5 resolved. Then:

```bash
git add src/features/database/ drizzle/ supabase/migrations/ scripts/ package.json docs/phase.md docs/blocker.md
git commit -m "feat: wave 1 schema, migrations, and RLS policies"
```

---

### Task 4: Wave 2 schema (codebase / canvas)

**Files:**
- Modify: `src/features/database/schema.ts`, `scripts/db-setup.mjs`
- Create: `supabase/migrations/0002_wave2_rls.sql`
- Test: extend `src/features/database/schema.test.ts`

**Interfaces:**
- Consumes: wave 1 tables from Task 3.
- Produces: `codebases`, `codebaseScans`, `detectedTechnologies`, `detectedFeatures` from `schema.ts`.

- [ ] **Step 1: Extend the failing test**

Add to `src/features/database/schema.test.ts`:

```ts
import {
  codebaseScans,
  codebases,
  detectedFeatures,
  detectedTechnologies,
} from "./schema";

it("exposes all four wave 2 tables", () => {
  for (const table of [
    codebases,
    codebaseScans,
    detectedTechnologies,
    detectedFeatures,
  ]) {
    expect(table).toBeDefined();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/database/schema.test.ts`
Expected: FAIL — wave 2 tables not exported.

- [ ] **Step 3: Implement wave 2 schema**

Append to `src/features/database/schema.ts`:

```ts
export const codebases = pgTable("codebases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  rootPath: text("root_path").notNull(),
  fileCount: integer("file_count").notNull(),
  totalBytes: integer("total_bytes").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("codebases_project_unique").on(table.projectId)]);

export const codebaseScans = pgTable("codebase_scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  codebaseId: uuid("codebase_id")
    .notNull()
    .references(() => codebases.id, { onDelete: "cascade" }),
  scannedAt: timestamp("scanned_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  entries: jsonb("entries").notNull(),
  skipped: jsonb("skipped").notNull(),
  errors: jsonb("errors").notNull(),
  analysis: jsonb("analysis").notNull(),
  ...timestamps,
});

export const detectedTechnologies = pgTable("detected_technologies", {
  id: uuid("id").primaryKey().defaultRandom(),
  codebaseId: uuid("codebase_id")
    .notNull()
    .references(() => codebases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  confidence: integer("confidence").notNull(),
  evidence: jsonb("evidence").notNull().default([]),
  ...timestamps,
}, (table) => [uniqueIndex("detected_technologies_codebase_name_unique").on(table.codebaseId, table.name)]);

export const detectedFeatures = pgTable("detected_features", {
  id: uuid("id").primaryKey().defaultRandom(),
  codebaseId: uuid("codebase_id")
    .notNull()
    .references(() => codebases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  confidence: integer("confidence").notNull(),
  evidence: jsonb("evidence").notNull().default([]),
  ...timestamps,
}, (table) => [uniqueIndex("detected_features_codebase_name_unique").on(table.codebaseId, table.name)]);

export const codebasesRelations = relations(codebases, ({ one, many }) => ({
  project: one(projects, {
    fields: [codebases.projectId],
    references: [projects.id],
  }),
  scans: many(codebaseScans),
  technologies: many(detectedTechnologies),
  features: many(detectedFeatures),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/database/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Write wave 2 RLS SQL**

Create `supabase/migrations/0002_wave2_rls.sql`:

```sql
-- AMENDED after the Task 3 review found infinite recursion: policies must
-- never subquery workspace_members directly (RLS applies to policy
-- subqueries). All membership checks go through the SECURITY DEFINER
-- helper `is_workspace_member` created in 0001_wave1_rls.sql.

alter table codebases enable row level security;
alter table codebase_scans enable row level security;
alter table detected_technologies enable row level security;
alter table detected_features enable row level security;

-- Same membership rule as projects: a workspace member may read everything
-- owned by a project in that workspace.
drop policy if exists "codebases_member_read" on codebases;
create policy "codebases_member_read" on codebases for select
  using (
    is_workspace_member(
      (select workspace_id from projects where projects.id = codebases.project_id),
      auth.uid()
    )
  );

drop policy if exists "codebase_scans_member_read" on codebase_scans;
create policy "codebase_scans_member_read" on codebase_scans for select
  using (
    is_workspace_member(
      (select projects.workspace_id from codebases
       join projects on projects.id = codebases.project_id
       where codebases.id = codebase_scans.codebase_id),
      auth.uid()
    )
  );

drop policy if exists "detected_technologies_member_read" on detected_technologies;
create policy "detected_technologies_member_read" on detected_technologies for select
  using (
    is_workspace_member(
      (select projects.workspace_id from codebases
       join projects on projects.id = codebases.project_id
       where codebases.id = detected_technologies.codebase_id),
      auth.uid()
    )
  );

drop policy if exists "detected_features_member_read" on detected_features;
create policy "detected_features_member_read" on detected_features for select
  using (
    is_workspace_member(
      (select projects.workspace_id from codebases
       join projects on projects.id = codebases.project_id
       where codebases.id = detected_features.codebase_id),
      auth.uid()
    )
  );
```

- [ ] **Step 6: Extend the setup script**

In `scripts/db-setup.mjs`, apply RLS files in order:

```js
const rlsFiles = ["0001_wave1_rls.sql", "0002_wave2_rls.sql"];
for (const file of rlsFiles) {
  const rls = readFileSync(
    new URL(`../supabase/migrations/${file}`, import.meta.url),
    "utf8"
  );
  await sql.unsafe(rls);
}
```

- [ ] **Step 7: Generate migration and apply**

Run: `npx drizzle-kit generate` then `npm run db:setup` then `npm run db:tables`
Expected: `db:tables` now also lists `codebase_scans, codebases, detected_features, detected_technologies`.

- [ ] **Step 8: Verify gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/features/database/ drizzle/ supabase/migrations/ scripts/
git commit -m "feat: wave 2 codebase schema and RLS"
```

---

### Task 5: Session provider (Supabase-managed sessions)

**Files:**
- Create: `src/lib/server/supabase.ts`, `src/lib/server/init.ts`, `src/features/auth/server/session-provider.ts`
- Modify: `src/app/layout.tsx`
- Test: `src/features/auth/server/session-provider.test.ts` (new)

**Interfaces:**
- Consumes: `setSessionProvider` from `@/features/auth/server` (signature `(token: string) => Promise<AuthSession | null>`); `AuthSession`, `AuthUser` from `@/features/auth/types`.
- Produces: `mapSupabaseSession(session)` from `src/features/auth/server/session-provider.ts` returning `AuthSession | null`; `registerAuthSessionProvider()` called once from `src/lib/server/init.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/server/session-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapSupabaseSession } from "./session-provider";

describe("mapSupabaseSession", () => {
  it("maps a valid Supabase session to an AuthSession", () => {
    const mapped = mapSupabaseSession({
      user: {
        id: "u1",
        email: "a@b.test",
        user_metadata: { name: "Ada" },
        email_confirmed_at: "2026-08-18T10:00:00Z",
      },
      expires_at: 1789836000,
    });
    expect(mapped).toEqual({
      user: {
        id: "u1",
        name: "Ada",
        email: "a@b.test",
        emailVerified: true,
      },
      expiresAt: "2026-08-18T10:00:00Z".slice(0, 0) || expect.any(String),
    });
  });

  it("returns null for an unverified user (hard gate, D3)", () => {
    expect(
      mapSupabaseSession({
        user: {
          id: "u2",
          email: "c@d.test",
          user_metadata: {},
          email_confirmed_at: null,
        },
        expires_at: 1789836000,
      })
    ).toBeNull();
  });
});
```

Note for the implementer: the first assertion's `expiresAt` is awkward — write it exactly as:

```ts
    expect(mapped?.user).toEqual({
      id: "u1",
      name: "Ada",
      email: "a@b.test",
      emailVerified: true,
    });
    expect(typeof mapped?.expiresAt).toBe("string");
    expect(mapped?.expiresAt.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/server/session-provider.test.ts`
Expected: FAIL — `mapSupabaseSession` is not exported.

- [ ] **Step 3: Implement the mapping**

Create `src/features/auth/server/session-provider.ts`:

```ts
import "server-only";

import type { AuthSession, AuthUser } from "@/features/auth/types";

/** The slice of a Supabase session this module needs. */
export type SupabaseSession = {
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
    email_confirmed_at?: string | null;
  };
  expires_at?: number | null;
};

/**
 * Maps a Supabase session to the app's AuthSession shape.
 *
 * Hard gate (D3): a user whose email is not confirmed is treated as signed
 * out — they land on /verify-email, never inside the app.
 */
export function mapSupabaseSession(
  session: SupabaseSession
): AuthSession | null {
  const { user } = session;
  if (!user.email) return null;
  if (!user.email_confirmed_at) return null;

  const name =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : user.email;

  const authUser: AuthUser = {
    id: user.id,
    name,
    email: user.email,
    emailVerified: true,
  };

  return {
    user: authUser,
    expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/server/session-provider.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the Supabase server client + provider registration**

Create `src/lib/server/supabase.ts`:

```ts
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** One Supabase server client per request — reads and writes its own cookies. */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
```

Create `src/lib/server/init.ts`:

```ts
import "server-only";

import { createSupabaseServerClient } from "@/lib/server/supabase";
import { setSessionProvider } from "@/features/auth/server";
import { mapSupabaseSession } from "@/features/auth/server/session-provider";

/**
 * Boot-time wiring that crosses feature boundaries — lives in lib, not in a
 * feature, because features never import each other.
 *
 * The provider contract (token) is satisfied by asking Supabase for the
 * current session; Supabase's own cookie is the token. The existing
 * SESSION_COOKIE is still written by the login action so middleware's
 * existence check keeps working unchanged.
 */
export async function registerAuthSessionProvider(): Promise<void> {
  setSessionProvider(async () => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();
    return data.session ? mapSupabaseSession(data.session) : null;
  });
}
```

Modify `src/app/layout.tsx` — add near the top of the server component body (before returning JSX):

```tsx
// Register the session provider once per request. Side-effect import is
// deliberate: there is no value to render.
await registerAuthSessionProvider();
```

- [ ] **Step 6: Verify gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/ src/features/auth/server/session-provider.ts src/features/auth/server/session-provider.test.ts src/app/layout.tsx
git commit -m "feat: supabase session provider registration"
```

---

### Task 6: Signup + login actions (rate limit, brute force, CSRF)

**Files:**
- Create: `src/features/auth/lib/actions.ts` (`"use server"`), `src/features/auth/lib/actions.test.ts`
- Modify: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/features/auth/components/login-form.tsx`, `src/features/auth/components/signup-form.tsx`, `src/features/auth/index.ts` (export new result type only — never the actions)

**Interfaces:**
- Consumes: `RateLimiter`, `MemoryRateLimitStore`, `BruteForceGuard` from `@/features/auth/server`; `createCsrfToken`, `verifyCsrfToken`, `isTrustedOrigin` from `@/features/auth/server`; `SESSION_COOKIE`, `sessionCookieOptions`, `clearedCookieOptions` from `@/features/auth/server`; `createSupabaseServerClient` from `@/lib/server/supabase`; `loginSchema`, `signupSchema` from `@/features/auth/lib/schemas`.
- Produces: `AuthActionResult = { ok: true } | { ok: false; message: string }`; `createAuthActions(deps)` factory returning `{ login(values), signup(values) }`; forms call these through the `"use server"` export.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/lib/actions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAuthActions } from "./actions";

function fakeDeps(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      signInWithPassword: async () => ({ error: null, data: {} }),
      signUp: async () => ({
        error: null,
        data: {
          user: { id: "u1", email: "a@b.test", email_confirmed_at: null },
        },
      }),
    },
    verifyCsrfToken: async () => true,
    origin: "https://devstep.test",
    setCookie: async () => {},
    recordFailure: async () => {},
    checkBruteForce: async () => ({ locked: false }),
    consumeRateLimit: async () => ({ ok: true, remaining: 9 }),
    ...overrides,
  };
}

describe("createAuthActions", () => {
  it("signs in and reports success", async () => {
    const { login } = createAuthActions(fakeDeps() as never);
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "t",
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects when CSRF verification fails", async () => {
    const { login } = createAuthActions(
      fakeDeps({ verifyCsrfToken: async () => false }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "bad",
    });
    expect(result).toEqual({
      ok: false,
      message: "Your session expired. Refresh the page and try again.",
    });
  });

  it("rejects when brute force says locked", async () => {
    const { login } = createAuthActions(
      fakeDeps({ checkBruteForce: async () => ({ locked: true }) }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "hunter2hunter2",
      csrfToken: "t",
    });
    expect(result).toEqual({
      ok: false,
      message: "Too many attempts. Try again later.",
    });
  });

  it("records a failure when the password is wrong", async () => {
    let recorded = 0;
    const { login } = createAuthActions(
      fakeDeps({
        auth: {
          signInWithPassword: async () => ({
            error: { message: "Invalid login credentials" },
            data: {},
          }),
        },
        recordFailure: async () => {
          recorded += 1;
        },
      }) as never
    );
    const result = await login({
      email: "a@b.test",
      password: "wrongpassword",
      csrfToken: "t",
    });
    expect(result.ok).toBe(false);
    expect(recorded).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/lib/actions.test.ts`
Expected: FAIL — `createAuthActions` is not exported.

- [ ] **Step 3: Implement the actions factory**

Create `src/features/auth/lib/actions.ts`:

```ts
"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { loginSchema, signupSchema } from "@/features/auth/lib/schemas";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/features/auth/lib/cookies";
import { verifyCsrfToken, isTrustedOrigin } from "@/features/auth/lib/csrf";
import {
  BruteForceGuard,
  MemoryRateLimitStore,
  RateLimiter,
} from "@/features/auth/lib/rate-limit-server-reexports";

export type AuthActionResult = { ok: true } | { ok: false; message: string };

const CSRF_FAILURE: AuthActionResult = {
  ok: false,
  message: "Your session expired. Refresh the page and try again.",
};

const LOCKED: AuthActionResult = {
  ok: false,
  message: "Too many attempts. Try again later.",
};

const INVALID_CREDENTIALS: AuthActionResult = {
  ok: false,
  message: "Email or password is incorrect.",
};

// NOTE for implementer: rate-limit + brute-force live in lib/rate-limit.ts and
// lib/brute-force.ts; import them directly:
//   import { BruteForceGuard, MemoryRateLimitStore } from "./rate-limit-…"
// NO — the real import is:
//   import { BruteForceGuard } from "./brute-force";
//   import { MemoryRateLimitStore, RateLimiter } from "./rate-limit";
// (The re-export file above does not exist; write the two direct imports.)

type AuthLike = {
  signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<{ error: { message: string } | null; data: unknown }>;
  signUp(input: {
    email: string;
    password: string;
    options: { data: { name: string }; emailRedirectTo?: string };
  }): Promise<{
    error: { message: string } | null;
    data: { user: { id: string } | null };
  }>;
};

export type AuthActionsDeps = {
  auth: AuthLike;
  verifyCsrf: (token: string) => Promise<boolean>;
  origin: string;
  setCookie: (name: string, value: string) => Promise<void>;
  recordFailure: (key: string) => Promise<void>;
  isLocked: (key: string) => Promise<boolean>;
  consumeLoginAttempt: (key: string) => Promise<boolean>;
};

export function createAuthActions(deps: AuthActionsDeps) {
  async function guardRequest(
    csrfToken: string
  ): Promise<AuthActionResult | null> {
    if (!isTrustedOrigin(deps.origin, env.NEXT_PUBLIC_APP_URL)) {
      return CSRF_FAILURE;
    }
    if (!(await deps.verifyCsrf(csrfToken))) return CSRF_FAILURE;
    return null;
  }

  async function login(values: {
    email: string;
    password: string;
    csrfToken: string;
  }): Promise<AuthActionResult> {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) return { ok: false, message: "Invalid input." };

    const guard = await guardRequest(values.csrfToken);
    if (guard) return guard;

    const email = values.email.trim().toLowerCase();
    if (await deps.isLocked(email)) return LOCKED;
    if (!(await deps.consumeLoginAttempt(email))) return LOCKED;

    const { error, data } = await deps.auth.signInWithPassword({
      email,
      password: values.password,
    });
    if (error) {
      await deps.recordFailure(email);
      return INVALID_CREDENTIALS;
    }

    await deps.setCookie(SESSION_COOKIE, "supabase");
    return { ok: true };
  }

  async function signup(values: {
    name: string;
    email: string;
    password: string;
    csrfToken: string;
  }): Promise<AuthActionResult> {
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) return { ok: false, message: "Invalid input." };

    const guard = await guardRequest(values.csrfToken);
    if (guard) return guard;

    const { error } = await deps.auth.signUp({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      options: {
        data: { name: values.name.trim() },
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/verify-email`,
      },
    });
    if (error) return { ok: false, message: error.message };

    return { ok: true };
  }

  return { login, signup };
}

/** The bound actions used by the real forms. */
// AMENDED after Task 6 review: limiter and bruteForce MUST be module-scope
// singletons. Constructing them inside realDeps() rebuilt the in-memory
// stores on every request, so consume always allowed and lockouts never
// engaged — the controls were decorative. Per-process stores are the
// accepted dev trade-off; a shared Postgres/Redis store comes later (see
// docs/blocker.md Testing section).
const limiter = new RateLimiter(new MemoryRateLimitStore());
const bruteForce = new BruteForceGuard(new MemoryRateLimitStore());

async function realDeps(): Promise<AuthActionsDeps> {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();

  return {
    auth: supabase.auth as never,
    verifyCsrf: async (token) => {
      const csrf = cookieStore.get(CSRF_COOKIE)?.value ?? "";
      return verifyCsrfToken(csrf, token);
    },
    origin: (await headers()).get("origin") ?? "",
    setCookie: async (name, value) => {
      cookieStore.set(name, value, sessionCookieOptions);
    },
    recordFailure: async (key) => {
      await bruteForce.recordFailure(key);
    },
    isLocked: async (key) => {
      return (await bruteForce.check(key)).locked;
    },
    consumeLoginAttempt: async (key) => {
      return (await limiter.consume(key)).ok;
    },
  };
}

export async function loginAction(values: {
  email: string;
  password: string;
  csrfToken: string;
}): Promise<AuthActionResult> {
  return createAuthActions(await realDeps()).login(values);
}

export async function signupAction(values: {
  name: string;
  email: string;
  password: string;
  csrfToken: string;
}): Promise<AuthActionResult> {
  return createAuthActions(await realDeps()).signup(values);
}
```

Implementer corrections to apply while writing:
- Import `BruteForceGuard` from `./brute-force` and `RateLimiter`, `MemoryRateLimitStore` from `./rate-limit` (check exact exported names in those files — `consume` and `check`/`recordFailure` signatures are already tested there).
- Import `createCsrfToken`, `verifyCsrfToken`, `isTrustedOrigin` from `./csrf` (their exact signatures are in `src/features/auth/lib/csrf.ts`).
- CSRF cookie name: use the `CSRF_COOKIE` constant from `./cookies` instead of the literal `"devstep-csrf"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/lib/actions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the login page + form**

Modify `src/app/(auth)/login/page.tsx`: make it read a CSRF token and pass it as a prop:

```tsx
import { createCsrfToken } from "@/features/auth/server";
import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage() {
  const csrfToken = await createCsrfToken();
  return <LoginForm csrfToken={csrfToken} />;
}
```

(Keep the page's existing layout/wrapper exactly as-is; only add the token flow.)

Modify `src/features/auth/components/login-form.tsx`:

```tsx
import { loginAction } from "@/features/auth/lib/actions";
// …existing imports stay; remove the placeholder import…

export function LoginForm({ csrfToken }: { csrfToken: string }) {
  // …existing state and useForm stay…

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await loginAction({ ...values, csrfToken });
    if (!result.ok) setFormError(result.message);
  });

  // …rest of the JSX unchanged…
}
```

- [ ] **Step 6: Wire the signup page + form**

Same pattern. Modify `src/app/(auth)/signup/page.tsx` to issue `createCsrfToken()` and pass `csrfToken`; modify `src/features/auth/components/signup-form.tsx` to accept `{ csrfToken: string }`, call `signupAction({ ...values, csrfToken })`, and surface `result.message` on failure. On success, show the existing success state text: "Check your email to verify your account."

- [ ] **Step 7: Verify gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 8: Update trackers and commit**

`docs/phase.md` 0.1.2: mark server actions for signup/login 🟡→✅ with test notes; `docs/blocker.md`: note rate limiter + brute force now wired into login. Then:

```bash
git add src/features/auth/ src/app/\(auth\)/ docs/phase.md docs/blocker.md
git commit -m "feat: signup and login server actions with rate limit, brute force, CSRF"
```

---

### Task 7: Logout, forgot-password, reset, verify-email actions

**Files:**
- Modify: `src/features/auth/lib/actions.ts`, `src/features/auth/lib/actions.test.ts`
- Modify: `src/features/auth/components/logout-button.tsx`, `src/features/auth/components/forgot-password-form.tsx`, `src/features/auth/components/reset-password-form.tsx`, `src/features/auth/components/verify-email-card.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx`, `src/app/(auth)/verify-email/page.tsx`

**Interfaces:**
- Consumes: `createAuthActions` from Task 6; `SESSION_COOKIE`, `clearedCookieOptions`, `CSRF_COOKIE` from `@/features/auth/lib/cookies`.
- Produces: `logout()`, `forgotPassword(email, csrfToken)`, `resetPassword(password, csrfToken)`, `resendVerification(email, csrfToken)` on the actions object; `logoutAction`, `forgotPasswordAction`, `resetPasswordAction`, `resendVerificationAction` bound exports.

- [ ] **Step 1: Write the failing test**

Append to `src/features/auth/lib/actions.test.ts`:

```ts
describe("createAuthActions — session lifecycle", () => {
  it("logout clears the session cookie", async () => {
    const cleared: string[] = [];
    const { logout } = createAuthActions(
      fakeDeps({
        auth: { signOut: async () => ({ error: null }) },
        clearCookie: async (name: string) => {
          cleared.push(name);
        },
      }) as never
    );
    const result = await logout();
    expect(result).toEqual({ ok: true });
    expect(cleared).toContain("devstep-session");
  });

  it("forgotPassword reports success without leaking account existence", async () => {
    const { forgotPassword } = createAuthActions(
      fakeDeps({
        auth: {
          resetPasswordForEmail: async () => ({ error: null }),
        },
      }) as never
    );
    const result = await forgotPassword("a@b.test", "t");
    expect(result).toEqual({
      ok: true,
      message:
        "If that email is registered, a reset link is on its way.",
    });
  });

  it("resetPassword refuses a CSRF mismatch", async () => {
    const { resetPassword } = createAuthActions(
      fakeDeps({ verifyCsrfToken: async () => false }) as never
    );
    const result = await resetPassword("newpassword123", "bad");
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/auth/lib/actions.test.ts`
Expected: FAIL — `logout` etc. not on the returned object.

- [ ] **Step 3: Implement**

Extend `createAuthActions` in `src/features/auth/lib/actions.ts`. Add to `AuthActionsDeps`: `clearCookie: (name: string) => Promise<void>`; extend `AuthLike` with `signOut`, `resetPasswordForEmail`, `updateUser`, `resend`; add to the returned object:

```ts
  async function logout(): Promise<AuthActionResult> {
    await deps.auth.signOut();
    await deps.clearCookie(SESSION_COOKIE);
    await deps.clearCookie(CSRF_COOKIE);
    return { ok: true };
  }

  async function forgotPassword(
    email: string,
    csrfToken: string
  ): Promise<AuthActionResult> {
    const guard = await guardRequest(csrfToken);
    if (guard) return guard;

    const { error } = await deps.auth.resetPasswordForEmail({
      email: email.trim().toLowerCase(),
    });
    // Same message either way — never confirm whether an account exists.
    if (error) console.error("resetPasswordForEmail failed", error.message);
    return {
      ok: true,
      message: "If that email is registered, a reset link is on its way.",
    };
  }

  async function resetPassword(
    password: string,
    csrfToken: string
  ): Promise<AuthActionResult> {
    const guard = await guardRequest(csrfToken);
    if (guard) return guard;

    const { error } = await deps.auth.updateUser({ password });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  async function resendVerification(
    email: string,
    csrfToken: string
  ): Promise<AuthActionResult> {
    const guard = await guardRequest(csrfToken);
    if (guard) return guard;

    const { error } = await deps.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  }

  return { login, signup, logout, forgotPassword, resetPassword, resendVerification };
```

Add bound exports next to `loginAction`:

```ts
export async function logoutAction(): Promise<AuthActionResult> {
  return createAuthActions(await realDeps()).logout();
}

export async function forgotPasswordAction(email: string, csrfToken: string) {
  return createAuthActions(await realDeps()).forgotPassword(email, csrfToken);
}

export async function resetPasswordAction(password: string, csrfToken: string) {
  return createAuthActions(await realDeps()).resetPassword(password, csrfToken);
}

export async function resendVerificationAction(email: string, csrfToken: string) {
  return createAuthActions(await realDeps()).resendVerification(email, csrfToken);
}
```

In `realDeps()`, add `clearCookie` (uses `clearedCookieOptions`) and the four `auth` methods from `supabase.auth`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/auth/lib/actions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Wire the four components**

- `logout-button.tsx`: replace `submitPlaceholder({})` with `await logoutAction()` then `window.location.href = "/login"` (or `router.push`).
- `forgot-password-form.tsx`: accept `csrfToken` prop, call `forgotPasswordAction(values.email, csrfToken)`, show returned `message` in the success state.
- `reset-password-form.tsx`: accept `csrfToken` prop, call `resetPasswordAction(values.password, csrfToken)`, surface errors/success.
- `verify-email-card.tsx`: call `resendVerificationAction(email, csrfToken)` on resend click, show `message` on success.

Their pages (`forgot-password`, `reset-password`, `verify-email`) each issue `createCsrfToken()` and pass it down — same pattern as Task 6 Step 5.

- [ ] **Step 6: Verify gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 7: Update trackers and commit**

`docs/phase.md` 0.1.2: mark signup/login/logout/reset/verify actions ✅; note email delivery runs on Supabase local sender (D2 path). Then:

```bash
git add src/features/auth/ src/app/\(auth\)/ docs/phase.md
git commit -m "feat: logout, reset, and verify-email actions"
```

---

### Task 8: Workspace persistence (create/rename/delete + activity)

**Files:**
- Create: `src/features/workspace/server/workspace-service.ts`, `src/features/workspace/server/workspace-service.test.ts`, `src/features/workspace/lib/actions.ts` (`"use server"`)
- Modify: `src/features/workspace/components/create-workspace-form.tsx`, `src/features/workspace/components/rename-workspace-form.tsx`, `src/features/workspace/components/delete-workspace.tsx`

**Interfaces:**
- Consumes: `createWorkspaceSchema`, `renameWorkspaceSchema`, `deleteWorkspaceSchema` from `@/features/workspace/lib/schemas`; `uniqueSlug`, `toSlug` from `@/features/workspace/lib/slug`; `can` from `@/features/workspace/lib/permissions`; `db` from `@/features/database/server`; `users/workspaces/workspaceMembers` tables from `@/features/database/schema`; `getSession` from `@/features/auth/server`.
- Produces: `WorkspaceDb` interface; `createWorkspaceService(db)` returning `{ createWorkspace(input, userId), renameWorkspace(input, userId), deleteWorkspace(input, userId) }`; `createWorkspaceAction` etc. used by the forms; `WorkspaceActionResult = { ok: true; data?: … } | { ok: false; message: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/features/workspace/server/workspace-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createWorkspaceService } from "./workspace-service";

function fakeDb() {
  const rows: {
    workspaces: { id: string; name: string; slug: string }[];
    memberships: { workspaceId: string; userId: string; role: string }[];
    events: { kind: string; summary: string }[];
  } = { workspaces: [], memberships: [], events: [] };

  const db = {
    listWorkspaceSlugs: async () => rows.workspaces.map((w) => w.slug),
    findMembership: async (workspaceId: string, userId: string) =>
      rows.memberships.find(
        (m) => m.workspaceId === workspaceId && m.userId === userId
      ) ?? null,
    insertWorkspace: async (row: { name: string; slug: string }) => {
      const id = `ws-${rows.workspaces.length + 1}`;
      rows.workspaces.push({ id, ...row });
      return { id, slug: row.slug };
    },
    insertMembership: async (row: { workspaceId: string; userId: string; role: string }) => {
      rows.memberships.push(row);
    },
    insertEvent: async (row: { kind: string; summary: string }) => {
      rows.events.push(row);
    },
    updateWorkspace: async (id: string, patch: { name: string }) => {
      const ws = rows.workspaces.find((w) => w.id === id);
      if (!ws) throw new Error("not found");
      Object.assign(ws, patch);
    },
    softDeleteWorkspace: async (id: string) => {
      const ws = rows.workspaces.find((w) => w.id === id);
      if (!ws) throw new Error("not found");
      rows.workspaces.splice(rows.workspaces.indexOf(ws), 1);
    },
  };

  return { db, rows };
}

describe("createWorkspaceService", () => {
  it("creates a workspace with owner membership and an event", async () => {
    const { db, rows } = fakeDb();
    const service = createWorkspaceService(db as never);

    const result = await service.createWorkspace(
      { name: "Acme", slug: "acme" },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.workspaces).toHaveLength(1);
    expect(rows.workspaces[0]).toMatchObject({ name: "Acme", slug: "acme" });
    expect(rows.memberships).toEqual([
      { workspaceId: "ws-1", userId: "u1", role: "owner" },
    ]);
    expect(rows.events).toEqual([
      { kind: "workspace.created", summary: "Acme was created" },
    ]);
  });

  it("derives a unique slug when the requested one is taken", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({ id: "ws-x", name: "Acme", slug: "acme" });
    const service = createWorkspaceService(db as never);

    const result = await service.createWorkspace(
      { name: "Acme", slug: "acme" },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.workspaces[1].slug).toBe("acme-2");
  });

  it("renames only when the caller can update", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({ id: "ws-1", name: "Old", slug: "old" });
    rows.memberships.push({ workspaceId: "ws-1", userId: "u2", role: "viewer" });
    const service = createWorkspaceService(db as never);

    const denied = await service.renameWorkspace(
      { workspaceId: "ws-1", name: "New" },
      "u2"
    );
    expect(denied).toEqual({
      ok: false,
      message: "You do not have permission to do that.",
    });

    rows.memberships[0].role = "admin";
    const allowed = await service.renameWorkspace(
      { workspaceId: "ws-1", name: "New" },
      "u2"
    );
    expect(allowed.ok).toBe(true);
    expect(rows.workspaces[0].name).toBe("New");
  });

  it("soft-deletes only as owner", async () => {
    const { db, rows } = fakeDb();
    rows.workspaces.push({ id: "ws-1", name: "Acme", slug: "acme" });
    rows.memberships.push({ workspaceId: "ws-1", userId: "u1", role: "admin" });
    const service = createWorkspaceService(db as never);

    const denied = await service.deleteWorkspace(
      { workspaceId: "ws-1", confirmation: "Acme" },
      "u1"
    );
    expect(denied.ok).toBe(false);

    rows.memberships[0].role = "owner";
    const allowed = await service.deleteWorkspace(
      { workspaceId: "ws-1", confirmation: "Acme" },
      "u1"
    );
    expect(allowed.ok).toBe(true);
    expect(rows.workspaces).toHaveLength(0);
    expect(rows.events.at(-1)).toEqual({
      kind: "workspace.renamed",
      summary: "Acme was deleted",
    });
  });
});
```

Implementer note: the last event assertion is deliberately loose — the exact event kind for deletion is `"workspace.deleted"` (add it to the `ActivityKind` union in `src/features/workspace/types.ts` alongside `"workspace.renamed"`). Fix the assertion to that value when writing.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/workspace/server/workspace-service.test.ts`
Expected: FAIL — `createWorkspaceService` is not exported.

- [ ] **Step 3: Implement the service**

Create `src/features/workspace/server/workspace-service.ts`:

```ts
import "server-only";

import { can, type WorkspaceRole } from "@/features/workspace/lib/permissions";
import { uniqueSlug } from "@/features/workspace/lib/slug";
import type { ActivityKind } from "@/features/workspace/types";

/**
 * The persistence seam for workspaces. The database feature's Drizzle
 * implementation lives in src/lib/server/stores/ (app glue), so this module
 * stays feature-local and fake-db testable.
 */

export type WorkspaceDb = {
  listWorkspaceSlugs(): Promise<string[]>;
  findMembership(
    workspaceId: string,
    userId: string
  ): Promise<{ role: string } | null>;
  insertWorkspace(row: { name: string; slug: string }): Promise<{
    id: string;
    slug: string;
  }>;
  insertMembership(row: {
    workspaceId: string;
    userId: string;
    role: string;
  }): Promise<void>;
  insertEvent(row: {
    kind: ActivityKind;
    actorName: string;
    summary: string;
  }): Promise<void>;
  updateWorkspace(id: string, patch: { name: string }): Promise<void>;
  softDeleteWorkspace(id: string): Promise<void>;
};

export type WorkspaceActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

const DENIED = {
  ok: false,
  message: "You do not have permission to do that.",
} as const;

export function createWorkspaceService(db: WorkspaceDb) {
  async function membership(
    workspaceId: string,
    userId: string
  ): Promise<{ role: WorkspaceRole } | null> {
    const row = await db.findMembership(workspaceId, userId);
    if (!row) return null;
    return { role: row.role as WorkspaceRole };
  }

  async function createWorkspace(
    input: { name: string; slug: string },
    userId: string
  ): Promise<WorkspaceActionResult<{ id: string; slug: string }>> {
    const taken = new Set(await db.listWorkspaceSlugs());
    const slug = uniqueSlug(input.name, taken);

    const ws = await db.insertWorkspace({ name: input.name, slug });
    await db.insertMembership({
      workspaceId: ws.id,
      userId,
      role: "owner",
    });
    await db.insertEvent({
      kind: "workspace.created",
      actorName: "you",
      summary: `${input.name} was created`,
    });

    return { ok: true, data: { id: ws.id, slug: ws.slug } };
  }

  async function renameWorkspace(
    input: { workspaceId: string; name: string },
    userId: string
  ): Promise<WorkspaceActionResult> {
    const membershipRow = await membership(input.workspaceId, userId);
    if (!membershipRow || !can(membershipRow.role, "workspace:update")) {
      return DENIED;
    }

    await db.updateWorkspace(input.workspaceId, { name: input.name });
    await db.insertEvent({
      kind: "workspace.renamed",
      actorName: "you",
      summary: `${input.name} was renamed`,
    });
    return { ok: true };
  }

  async function deleteWorkspace(
    input: { workspaceId: string; confirmation: string },
    userId: string
  ): Promise<WorkspaceActionResult> {
    const membershipRow = await membership(input.workspaceId, userId);
    if (!membershipRow || !can(membershipRow.role, "workspace:delete")) {
      return DENIED;
    }

    await db.softDeleteWorkspace(input.workspaceId);
    await db.insertEvent({
      kind: "workspace.deleted",
      actorName: "you",
      summary: `${input.confirmation} was deleted`,
    });
    return { ok: true };
  }

  return { createWorkspace, renameWorkspace, deleteWorkspace };
}
```

Also modify `src/features/workspace/types.ts` — add `"workspace.deleted"` to `ActivityKind`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/workspace/server/workspace-service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the Drizzle store (app glue)**

Create `src/lib/server/stores/workspace-store.ts`:

```ts
import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/features/database/server";
import {
  users,
  workspaceMembers,
  workspaces,
} from "@/features/database/schema";
import { getSession } from "@/features/auth/server";
import {
  createWorkspaceService,
  type WorkspaceDb,
} from "@/features/workspace/server/workspace-service";
import type { ActivityKind } from "@/features/workspace/types";

const drizzleWorkspaceDb: WorkspaceDb = {
  listWorkspaceSlugs: async () => {
    const rows = await db
      .select({ slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.deletedAt, null as never));
    return rows.map((r) => r.slug);
  },

  findMembership: async (workspaceId, userId) => {
    const row = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        eq(workspaceMembers.workspaceId, workspaceId) &&
          eq(workspaceMembers.userId, userId)
      )
      .limit(1);
    return row[0] ?? null;
  },

  insertWorkspace: async ({ name, slug }) => {
    const [row] = await db
      .insert(workspaces)
      .values({ name, slug })
      .returning({ id: workspaces.id, slug: workspaces.slug });
    return row;
  },

  insertMembership: async (row) => {
    await db.insert(workspaceMembers).values(row);
  },

  insertEvent: async (row) => {
    // Activity rows live in the workspace_activities table — created in this
    // same step. See the note below the code block.
    await db.insert(workspaceActivities).values(row);
  },

  updateWorkspace: async (id, patch) => {
    await db.update(workspaces).set(patch).where(eq(workspaces.id, id));
  },

  softDeleteWorkspace: async (id) => {
    await db
      .update(workspaces)
      .set({ deletedAt: new Date() })
      .where(eq(workspaces.id, id));
  },
};

export const workspaceService = createWorkspaceService(drizzleWorkspaceDb);
```

Implementer note — the activity table: `ActivityEvent` types already exist but no table does. Add `workspace_activities` to `src/features/database/schema.ts` in this task (columns: `id` uuid PK, `workspace_id` uuid FK, `kind` text, `actor_name` text, `summary` text, `occurred_at` timestamptz default now, plus timestamps), add its RLS policy to `supabase/migrations/0001_wave1_rls.sql` (member read), regenerate (`npx drizzle-kit generate`), re-run `npm run db:setup`. `insertEvent` maps `occurredAt` to `occurred_at`.

Also add `import { workspaceActivities } from "@/features/database/schema";` and use `eq(workspaces.deletedAt, null)` — note `eq` with null requires `isNull`; use `isNull(workspaces.deletedAt)` instead of the `as never` cast.

- [ ] **Step 6: Create the server actions**

Create `src/features/workspace/lib/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { createWorkspaceSchema, renameWorkspaceSchema, deleteWorkspaceSchema } from "@/features/workspace/lib/schemas";
import { workspaceService } from "@/lib/server/stores/workspace-store";
import { getSession } from "@/features/auth/server";
import { revalidatePath } from "next/cache";

export type WorkspaceActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

async function userIdOrFail(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };
  return { userId: session.user.id };
}

export async function createWorkspaceAction(
  values: { name: string; slug: string }
): Promise<WorkspaceActionResult<{ id: string; slug: string }>> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  const parsed = createWorkspaceSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await workspaceService.createWorkspace(parsed.data, who.userId);
  if (result.ok) revalidatePath("/workspaces");
  return result;
}

export async function renameWorkspaceAction(
  values: { workspaceId: string; name: string }
): Promise<WorkspaceActionResult> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  const parsed = renameWorkspaceSchema.safeParse({ name: values.name });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  return workspaceService.renameWorkspace(
    { workspaceId: values.workspaceId, name: parsed.data.name },
    who.userId
  );
}

export async function deleteWorkspaceAction(
  values: { workspaceId: string; confirmation: string }
): Promise<WorkspaceActionResult> {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };

  const parsed = deleteWorkspaceSchema(values.confirmation).safeParse({
    confirmation: values.confirmation,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  return workspaceService.deleteWorkspace(values, who.userId);
}
```

- [ ] **Step 7: Wire the three workspace components**

- `create-workspace-form.tsx`: replace the "cannot be saved" handler with `const result = await createWorkspaceAction(values);` — on failure `setFormError(result.message)`; on success clear the form and show a success message ("Workspace created"). Keep the slug auto-derive effect untouched.
- `rename-workspace-form.tsx`: same swap to `renameWorkspaceAction({ workspaceId, name: values.name })`.
- `delete-workspace.tsx`: same swap to `deleteWorkspaceAction({ workspaceId, confirmation })`.

- [ ] **Step 8: Verify gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 9: Update trackers and commit**

`docs/phase.md` 0.3: items A/B/C → ✅ (storage landed); note D/E/F partial as designed. `docs/blocker.md`: B1 (part) — local stack running; note cloud project still owner's task. Then:

```bash
git add src/features/workspace/ src/features/database/ src/lib/server/ drizzle/ supabase/migrations/ docs/phase.md docs/blocker.md
git commit -m "feat: workspace persistence with permissions and activity events"
```

---

### Task 9: Project persistence (wizard save + settings)

**Files:**
- Create: `src/features/project/server/project-service.ts`, `src/features/project/server/project-service.test.ts`, `src/features/project/lib/actions.ts`
- Modify: `src/features/project/components/project-wizard.tsx`, `src/features/project/components/project-settings-form.tsx`, `src/app/settings/project/page.tsx`

**Interfaces:**
- Consumes: `projectSettingsSchema` from `@/features/project/lib/schemas`; `can` from `@/features/workspace/lib/permissions`; `uniqueSlug` from `@/features/workspace/lib/slug`; wizard types from `@/features/project/lib/wizard`.
- Produces: `createProjectService(db)` with `{ createProject(input, userId), updateProjectSettings(input, userId), getProjectSettings(projectId, userId) }`; `createProjectAction`, `updateProjectSettingsAction`; `ProjectActionResult` same shape as workspace.

- [ ] **Step 1: Write the failing test**

Create `src/features/project/server/project-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createProjectService } from "./project-service";

function fakeDb() {
  const projects: { id: string; workspaceId: string; name: string; slug: string; description: string; type: string; visibility: string; status: string }[] = [];
  return {
    rows: { projects },
    db: {
      listProjectSlugs: async (workspaceId: string) =>
        projects.filter((p) => p.workspaceId === workspaceId).map((p) => p.slug),
      findWorkspaceMembership: async (workspaceId: string, userId: string) =>
        workspaceId === "ws-1" && userId === "u1" ? { role: "owner" } : null,
      insertProject: async (row: {
        workspaceId: string;
        name: string;
        slug: string;
        description: string;
        type: string;
        visibility: string;
        status: string;
      }) => {
        const id = `p-${projects.length + 1}`;
        projects.push({ id, ...row });
        return { id, slug: row.slug };
      },
      updateProject: async (id: string, patch: Record<string, string>) => {
        const p = projects.find((x) => x.id === id);
        if (!p) throw new Error("not found");
        Object.assign(p, patch);
      },
      findProject: async (id: string) => projects.find((p) => p.id === id) ?? null,
    },
  };
}

describe("createProjectService", () => {
  it("creates a project from wizard values", async () => {
    const { db, rows } = fakeDb();
    const service = createProjectService(db as never);

    const result = await service.createProject(
      {
        workspaceId: "ws-1",
        name: "Website",
        description: "Marketing site",
        type: "web",
        visibility: "private",
        status: "active",
      },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.projects[0]).toMatchObject({
      workspaceId: "ws-1",
      name: "Website",
      slug: "website",
    });
  });

  it("denies creation outside membership", async () => {
    const { db } = fakeDb();
    const service = createProjectService(db as never);

    const result = await service.createProject(
      { workspaceId: "ws-9", name: "X", description: "", type: "web", visibility: "private", status: "active" },
      "u1"
    );

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to do that.",
    });
  });

  it("updates settings with the validated shape", async () => {
    const { db, rows } = fakeDb();
    rows.projects.push({
      id: "p-1", workspaceId: "ws-1", name: "Website", slug: "website",
      description: "", type: "web", visibility: "private", status: "active",
    });
    const service = createProjectService(db as never);

    const result = await service.updateProjectSettings(
      {
        projectId: "p-1",
        name: "Website 2",
        description: "Better",
        type: "web",
        visibility: "workspace",
        status: "paused",
      },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.projects[0]).toMatchObject({ name: "Website 2", status: "paused", visibility: "workspace" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/project/server/project-service.test.ts`
Expected: FAIL — `createProjectService` is not exported.

- [ ] **Step 3: Implement the service**

Create `src/features/project/server/project-service.ts`:

```ts
import "server-only";

import { can } from "@/features/workspace/lib/permissions";
import { uniqueSlug } from "@/features/workspace/lib/slug";

export type ProjectDb = {
  listProjectSlugs(workspaceId: string): Promise<string[]>;
  findWorkspaceMembership(
    workspaceId: string,
    userId: string
  ): Promise<{ role: string } | null>;
  insertProject(row: {
    workspaceId: string;
    name: string;
    slug: string;
    description: string;
    type: string;
    visibility: string;
    status: string;
  }): Promise<{ id: string; slug: string }>;
  updateProject(id: string, patch: Record<string, string>): Promise<void>;
  findProject(id: string): Promise<{ workspaceId: string } | null>;
};

export type ProjectActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

const DENIED = {
  ok: false,
  message: "You do not have permission to do that.",
} as const;

export type CreateProjectInput = {
  workspaceId: string;
  name: string;
  description: string;
  type: string;
  visibility: string;
  status: string;
};

export function createProjectService(db: ProjectDb) {
  async function memberCan(
    workspaceId: string,
    userId: string,
    capability: Parameters<typeof can>[1]
  ): Promise<boolean> {
    const membershipRow = await db.findWorkspaceMembership(workspaceId, userId);
    if (!membershipRow) return false;
    return can(membershipRow.role as never, capability);
  }

  async function createProject(
    input: CreateProjectInput,
    userId: string
  ): Promise<ProjectActionResult<{ id: string; slug: string }>> {
    if (!(await memberCan(input.workspaceId, userId, "project:create"))) {
      return DENIED;
    }

    const taken = new Set(await db.listProjectSlugs(input.workspaceId));
    const slug = uniqueSlug(input.name, taken);

    const project = await db.insertProject({ ...input, slug });
    return { ok: true, data: { id: project.id, slug: project.slug } };
  }

  async function updateProjectSettings(
    input: { projectId: string } & Record<string, string>,
    userId: string
  ): Promise<ProjectActionResult> {
    const project = await db.findProject(input.projectId);
    if (!project) return { ok: false, message: "Project not found." };
    if (!(await memberCan(project.workspaceId, userId, "project:update"))) {
      return DENIED;
    }

    const { projectId: _projectId, ...patch } = input;
    await db.updateProject(input.projectId, patch);
    return { ok: true };
  }

  async function getProjectSettings(
    projectId: string,
    userId: string
  ): Promise<ProjectActionResult<Record<string, string> | null>> {
    const project = await db.findProject(projectId);
    if (!project) return { ok: false, message: "Project not found." };
    if (!(await memberCan(project.workspaceId, userId, "project:read"))) {
      return DENIED;
    }
    return { ok: true, data: null }; // read path extended in Task 11's settings page
  }

  return { createProject, updateProjectSettings, getProjectSettings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/project/server/project-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Drizzle store + actions**

Create `src/lib/server/stores/project-store.ts` mirroring `workspace-store.ts`: implements `ProjectDb` with `db.insert(projects)`, `db.select().from(projects)` (excluding `deletedAt` rows via `isNull`), `db.update`. Export `projectService`.

Create `src/features/project/lib/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/features/auth/server";
import { projectSettingsSchema } from "@/features/project/lib/schemas";
import { projectService } from "@/lib/server/stores/project-store";

async function userIdOrFail(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };
  return { userId: session.user.id };
}

export async function createProjectAction(values: {
  workspaceId: string;
  name: string;
  description: string;
  type: string;
  visibility: string;
  status: string;
}) {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };
  const result = await projectService.createProject(values, who.userId);
  if (result.ok) revalidatePath("/projects");
  return result;
}

export async function updateProjectSettingsAction(values: {
  projectId: string;
  name: string;
  description: string;
  type: string;
  visibility: string;
  status: string;
}) {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };
  const parsed = projectSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  return projectService.updateProjectSettings(
    { projectId: values.projectId, ...parsed.data },
    who.userId
  );
}
```

- [ ] **Step 6: Wire the wizard + settings form**

- `project-wizard.tsx`: the final step's save handler swaps the "cannot be saved" message for `await createProjectAction(values)` (wizard state shape already carries name/description/type/workspaceId; map defaults for `visibility: "private"`, `status: "active"`). On failure surface `result.message`; on success show success state with link to `/projects`.
- `project-settings-form.tsx`: swap for `updateProjectSettingsAction({ projectId, ...values })`.
- `src/app/settings/project/page.tsx`: replace hardcoded placeholder values by reading from a server-side load (`projectService`-backed query) — if no project selected, keep the existing empty state text.

- [ ] **Step 7: Verify gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 8: Update trackers and commit**

`docs/phase.md` 0.4: wizard save ✅, settings ✅ (project resolution partial per page's empty state). Then:

```bash
git add src/features/project/ src/lib/server/ src/app/settings/ docs/phase.md
git commit -m "feat: project persistence for wizard and settings"
```

---

### Task 10: Canvas persistence (save/load codebase scans)

**Files:**
- Create: `src/features/codebase/server/codebase-service.ts`, `src/features/codebase/server/codebase-service.test.ts`, `src/features/codebase/lib/actions.ts`
- Modify: `src/features/codebase/components/import-project.tsx`, `src/app/projects/import/page.tsx`

**Interfaces:**
- Consumes: `ProjectAnalysis` type from `@/features/codebase` (barrel); scan types `IndexedFile`, `SkippedFile` from `@/features/codebase`; wave 2 tables from `@/features/database/schema`.
- Produces: `createCodebaseService(db)` with `{ saveAnalysis(input: { projectId, rootPath, indexed, skipped, errors, analysis: ProjectAnalysis }, userId), loadLatest(projectId, userId) }`; `saveImportAction`, `loadLatestImportAction`; result shape same as workspace.

- [ ] **Step 1: Write the failing test**

Create `src/features/codebase/server/codebase-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCodebaseService } from "./codebase-service";

function fakeDb() {
  const codebases: { id: string; projectId: string; rootPath: string; fileCount: number; totalBytes: number }[] = [];
  const scans: { codebaseId: string; entries: unknown; skipped: unknown; errors: unknown; analysis: unknown }[] = [];
  const technologies: { codebaseId: string; name: string }[] = [];
  return {
    rows: { codebases, scans, technologies },
    db: {
      findCodebase: async (projectId: string) =>
        codebases.find((c) => c.projectId === projectId) ?? null,
      insertCodebase: async (row: { projectId: string; rootPath: string; fileCount: number; totalBytes: number }) => {
        const id = `c-${codebases.length + 1}`;
        codebases.push({ id, ...row });
        return { id };
      },
      insertScan: async (row: { codebaseId: string; entries: unknown; skipped: unknown; errors: unknown; analysis: unknown }) => {
        scans.push(row);
      },
      replaceTechnologies: async (codebaseId: string, rows: { name: string; category: string; confidence: number; evidence: unknown }[]) => {
        technologies.push(...rows.map((r) => ({ codebaseId, name: r.name })));
      },
      findLatestScan: async (projectId: string) => {
        const codebase = codebases.find((c) => c.projectId === projectId);
        if (!codebase) return null;
        return scans.findLast((s) => s.codebaseId === codebase.id) ?? null;
      },
    },
  };
}

const analysis = {
  summary: {}, manifests: [], frameworks: [{ id: "next", name: "Next.js", confidence: 100, evidence: [] }],
  features: [], architecture: {}, languages: {}, runtimes: [], toolchain: {}, dependencies: {}, snapshot: { files: [] },
} as never;

describe("createCodebaseService", () => {
  it("saves a scan, creating the codebase row on first import", async () => {
    const { db, rows } = fakeDb();
    const service = createCodebaseService(db as never);

    const result = await service.saveAnalysis(
      {
        projectId: "p-1",
        rootPath: "/home/site",
        indexed: [{ path: "package.json", size: 100 }],
        skipped: [],
        errors: [],
        analysis,
      },
      "u1"
    );

    expect(result.ok).toBe(true);
    expect(rows.codebases).toHaveLength(1);
    expect(rows.codebases[0]).toMatchObject({ projectId: "p-1", fileCount: 1, totalBytes: 100 });
    expect(rows.scans).toHaveLength(1);
    expect(rows.scans[0].analysis).toBe(analysis);
  });

  it("persists detected technologies from the analysis", async () => {
    const { db, rows } = fakeDb();
    const service = createCodebaseService(db as never);

    await service.saveAnalysis(
      {
        projectId: "p-1", rootPath: "/home/site", indexed: [], skipped: [], errors: [], analysis,
      },
      "u1"
    );

    expect(rows.technologies).toContainEqual({ codebaseId: "c-1", name: "Next.js" });
  });

  it("returns null when no scan has been saved", async () => {
    const { db } = fakeDb();
    const service = createCodebaseService(db as never);
    const result = await service.loadLatest("p-1", "u1");
    expect(result).toEqual({ ok: true, data: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/codebase/server/codebase-service.test.ts`
Expected: FAIL — `createCodebaseService` is not exported.

- [ ] **Step 3: Implement the service**

Create `src/features/codebase/server/codebase-service.ts`:

```ts
import "server-only";

import type { ProjectAnalysis } from "@/features/codebase/lib/analyze";
import type { IndexedFile, SkippedFile, ScanError } from "@/features/codebase/lib/scan";

export type SaveAnalysisInput = {
  projectId: string;
  rootPath: string;
  indexed: IndexedFile[];
  skipped: SkippedFile[];
  errors: ScanError[];
  analysis: ProjectAnalysis;
};

export type CodebaseDb = {
  findCodebase(projectId: string): Promise<{ id: string } | null>;
  insertCodebase(row: {
    projectId: string;
    rootPath: string;
    fileCount: number;
    totalBytes: number;
  }): Promise<{ id: string }>;
  insertScan(row: {
    codebaseId: string;
    entries: unknown;
    skipped: unknown;
    errors: unknown;
    analysis: unknown;
  }): Promise<void>;
  replaceTechnologies(
    codebaseId: string,
    rows: { name: string; category: string; confidence: number; evidence: unknown }[]
  ): Promise<void>;
  replaceFeatures(
    codebaseId: string,
    rows: { name: string; confidence: number; evidence: unknown }[]
  ): Promise<void>;
  findLatestScan(projectId: string): Promise<unknown | null>;
};

export type CodebaseActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };

export function createCodebaseService(db: CodebaseDb) {
  async function saveAnalysis(
    input: SaveAnalysisInput,
    _userId: string
  ): Promise<CodebaseActionResult<{ codebaseId: string }>> {
    const fileCount = input.indexed.length;
    const totalBytes = input.indexed.reduce((sum, file) => sum + file.size, 0);

    let codebase = await db.findCodebase(input.projectId);
    if (!codebase) {
      codebase = await db.insertCodebase({
        projectId: input.projectId,
        rootPath: input.rootPath,
        fileCount,
        totalBytes,
      });
    }

    await db.insertScan({
      codebaseId: codebase.id,
      entries: input.indexed,
      skipped: input.skipped,
      errors: input.errors,
      analysis: input.analysis,
    });

    await db.replaceTechnologies(
      codebase.id,
      input.analysis.frameworks.map((f) => ({
        name: f.name,
        category: "framework",
        confidence: f.confidence,
        evidence: f.evidence ?? [],
      }))
    );
    await db.replaceFeatures(
      codebase.id,
      input.analysis.features.map((f) => ({
        name: f.name,
        confidence: f.confidence,
        evidence: f.evidence ?? [],
      }))
    );

    return { ok: true, data: { codebaseId: codebase.id } };
  }

  async function loadLatest(
    projectId: string,
    _userId: string
  ): Promise<CodebaseActionResult<unknown | null>> {
    return { ok: true, data: await db.findLatestScan(projectId) };
  }

  return { saveAnalysis, loadLatest };
}
```

(Implementer: check the real `Detection` shape in `src/features/codebase/lib/detect.ts` — the test's `{ id, name, confidence, evidence }` fields must match; adjust the mapping to the actual field names.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/codebase/server/codebase-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Drizzle store + actions**

Create `src/lib/server/stores/codebase-store.ts` implementing `CodebaseDb` with `codebases`, `codebaseScans`, `detectedTechnologies`, `detectedFeatures` (delete existing rows for the codebase before inserting replacements). Export `codebaseService`.

Create `src/features/codebase/lib/actions.ts`:

```ts
"use server";

import { getSession } from "@/features/auth/server";
import { codebaseService } from "@/lib/server/stores/codebase-store";
import type { SaveAnalysisInput } from "@/features/codebase/server/codebase-service";

async function userIdOrFail(): Promise<{ userId: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };
  return { userId: session.user.id };
}

export async function saveImportAction(input: SaveAnalysisInput) {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };
  return codebaseService.saveAnalysis(input, who.userId);
}

export async function loadLatestImportAction(projectId: string) {
  const who = await userIdOrFail();
  if ("error" in who) return { ok: false, message: who.error };
  return codebaseService.loadLatest(projectId, who.userId);
}
```

- [ ] **Step 6: Wire the import screen**

In `src/features/codebase/components/import-project.tsx`:
- Add a "Save index" button next to the existing actions (visible when `state.phase === "done"`), calling `saveImportAction({ projectId, rootPath, indexed, skipped, errors, analysis })` from the component's result state.
- Replace the paragraph "The index is not saved yet — connecting the database is what makes an import persist." with a saved-state line: "Index saved." after a successful save, or a failure message.
- `projectId` comes from a new required prop; `src/app/projects/import/page.tsx` passes the current project id from the session's default project selection (if none, render the existing "pick a project first" empty state).

- [ ] **Step 7: Verify gates**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 8: Update trackers and commit**

`docs/phase.md` 1.1: storage ✅ (index persists, rescan writes new snapshot). Then:

```bash
git add src/features/codebase/ src/lib/server/ src/app/projects/ docs/phase.md
git commit -m "feat: canvas persistence — scans, detections, and saved index"
```

---

### Task 11: Trackers, auth flag, final gates

**Files:**
- Modify: `.env.example`, `docs/phase.md`, `docs/06-status.md`, `docs/blocker.md`
- Possibly: `docs/bug.md` (only if defects were found and fixed during tasks 1–10 — log them there)

**Interfaces:**
- Consumes: everything from tasks 1–10.
- Produces: documentation reflecting reality; `NEXT_PUBLIC_AUTH_ENABLED` documented and turned on in `.env.local` for local dev.

- [ ] **Step 1: Update phase tracker**

`docs/phase.md`:
- 0.1.2 Backend: every server action item (signup, login, logout, reset, verify, rate limit wiring, brute force wiring, CSRF) → ✅ with date 2026-08-18 and test counts.
- 0.3 Workspace: A/B/C → ✅; note D (members) and G (billing) still deferred by owner.
- 0.4 Project creation: wizard save → ✅; settings → ✅ with note.
- 1.1 Local project import: storage → ✅.
- Add a "Phase 0.2 Database (step 02)" section in the same shape: scope, items (local stack, drizzle, wave 1, wave 2, RLS, setup script), gate (db:setup + db:tables + full four gates), status ✅.

- [ ] **Step 2: Mirror in status doc**

`docs/06-status.md`: update the "what exists" list — persistence now real (local), auth actions live, canvas saves. Update the "Nothing persists" paragraph (it currently says create/rename/delete cannot save — that is no longer true locally).

- [ ] **Step 3: Update blockers**

`docs/blocker.md`:
- B1 → Resolved (local): local stack running via `supabase` CLI; cloud project still needed before deploy (keep a 🔵 row for "Supabase cloud project").
- B2 → Resolved: Supabase-managed sessions (D1).
- B5 → Resolved: drizzle-orm, drizzle-kit, postgres installed.
- Update "Remaining work" auth/workspace/project/canvas sections to match what now exists.

- [ ] **Step 4: Auth flag**

In `.env.example` add `NEXT_PUBLIC_AUTH_ENABLED=true` with comment: `# Turns on route protection + session validation. Set once auth actions are live.` Set it in `.env.local`.

- [ ] **Step 5: Full gate run**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 6: Manual smoke (dev server)**

Run: `npm run dev`, then in a browser: sign up (local Supabase auto-confirms or sends test email via inbucket at http://127.0.0.1:54324), create a workspace (it should appear in the workspace list after reload), create a project, import a folder and save the index, reload and see the saved index.
Expected: every flow completes without the "cannot be saved" message.

- [ ] **Step 7: Commit**

```bash
git add .env.example docs/
git commit -m "docs: trackers, blockers, and auth flag for local persistence"
```

---

## Self-Review Notes (for the executor)

- Task 3 Step 3 contains a deliberately-wrong relations block followed by the correct one — use only the correct block.
- Task 6 Step 3 contains implementer corrections inline (real import paths from `./rate-limit`, `./brute-force`, `./csrf`, `CSRF_COOKIE`). Follow them; the "reexports" file does not exist.
- Task 8 Step 3 references `workspace_activities` before the table exists — Step 5's implementer note creates it. Do not skip that note.
- Task 8 test's final event assertion references `workspace.renamed` for a delete — the implementer note fixes it to `workspace.deleted` and adds the union member.
- Task 10 Step 3's `Detection` mapping must match the real fields in `src/features/codebase/lib/detect.ts`; verify before writing.

## Review lessons (apply to any remaining task — these defect classes were caught by review and fixed)

- **Discriminating tests only:** a service-level test with a fake db that never filtered rows cannot catch a store-layer filter bug (Task 8 slug reservation). Store-layer regressions need an integration test against the real stack (pattern: `src/lib/server/stores/workspace-store.integration.test.ts` — insert row, soft-delete, assert still listed, clean up).
- **Tautological validation:** never construct a Zod schema from the same value being validated (`deleteWorkspaceSchema(values.confirmation)`). Validate shape client-side; verify against DB state server-side.
- **Soft-delete + unique indexes:** a unique index covers deleted rows, so slug "taken" sets must include soft-deleted rows (or use a partial unique index). Deleted-slug reservation is the chosen trade-off — document it.
- **Existence guards:** every mutation must first check the row exists and is not soft-deleted; return clean messages, never rely on FK-violation 500s.
- **Actions discipline:** try/catch around every service call returning the typed error shape; `revalidatePath` after every successful mutation.
- **Module-scope state:** in-memory stores (rate limit, brute force) must be module-scope singletons — constructing per request makes them inert.

import { relations, sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

export const workspaceActivities = pgTable("workspace_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // ActivityKind values; checked in app layer
  actorName: text("actor_name").notNull(),
  summary: text("summary").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  ...timestamps,
});

export const usersRelations = relations(users, ({ many }) => ({
  workspaceMemberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  activities: many(workspaceActivities),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),
  integrations: many(projectIntegrations),
}));

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

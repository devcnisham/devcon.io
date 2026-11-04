import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/features/database/server";
import { users } from "@/features/database/schema";
import { databaseIsUp } from "./integration-helpers";

/**
 * Discriminating test for BUG-022: GoTrue writes auth.users on signup, and the
 * on_auth_user_created trigger (supabase/migrations/0003_auth_users_sync.sql)
 * must mirror the row into public.users — otherwise the first workspace create
 * fails with an FK violation on workspace_members.user_id. Runs against the
 * real local stack (skipped when it is down). The trigger is the only thing
 * that can create a public.users row for a GoTrue user, so no fake can stand
 * in for it.
 */

const dbUp = await databaseIsUp();
const userId = randomUUID();
const email = `sync-it-${Date.now()}@test.dev`;

describe.skipIf(!dbUp)("auth-users sync trigger (integration)", () => {
  beforeAll(async () => {
    // Simulate a GoTrue signup: insert straight into auth.users (the trigger
    // fires on after-insert, exactly as it would for a real signup).
    await db.execute(sql`
      insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
      values (${userId}, ${email}, 'it-pass', ${JSON.stringify({ name: "Sync IT" })}::jsonb)
    `);
  });

  afterAll(async () => {
    // public.users first — workspace_members cascade from it; auth.users last.
    await db.delete(users).where(sql`${users.id} = ${userId}`);
    await db.execute(sql`delete from auth.users where id = ${userId}`);
  });

  it("mirrors the auth.users row into public.users", async () => {
    const [row] = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(sql`${users.id} = ${userId}`);
    expect(row).toMatchObject({
      id: userId,
      email,
      displayName: "Sync IT", // coalesce(raw_user_meta_data->>'name', email)
    });
  });
});

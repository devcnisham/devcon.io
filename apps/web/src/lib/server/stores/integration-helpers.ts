import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/features/database/server";

/**
 * Shared helpers for store integration tests. The tests run against the real
 * local stack (see 06-status.md); when the stack is down the connection fails
 * with ECONNREFUSED and the suite must skip gracefully rather than fail.
 *
 * Skip mechanism: vitest 4.1 removed `ctx.skip()` from the beforeAll hook
 * context, so the skip decision is made at collection time instead — each
 * test file probes the database once (`await databaseIsUp()`) and wraps its
 * describe in `describe.skipIf(!dbUp)`. Same outcome, no fragile hook API.
 */

export function isConnectionRefused(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "ECONNREFUSED"
  );
}

/** True when the local stack answers. Any error other than ECONNREFUSED is
 * real (wrong URL, auth failure) and propagates — those must fail the suite. */
export async function databaseIsUp(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch (error) {
    if (isConnectionRefused(error)) return false;
    throw error;
  }
}

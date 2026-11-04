import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Next dev hot-reloads modules, which would otherwise build a fresh 10-connection
// pool on every reload and leak the old one. Cache the client on globalThis so
// one pool lives per process.
const globalForDb = globalThis as unknown as { devstepDb?: ReturnType<typeof drizzle> };

export const db = (globalForDb.devstepDb ??= drizzle(
  postgres(env.DATABASE_URL, { max: 10 }),
  { schema }
));

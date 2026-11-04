import "server-only";
import postgres from "postgres";
import { env } from "@/lib/env";
const state = globalThis as unknown as {
  filesDb?: ReturnType<typeof postgres>;
};
export const fileDb = (state.filesDb ??= postgres(env.DATABASE_URL, {
  max: 4,
  transform: { column: { from: postgres.toCamel } },
  connection: { application_name: "devcon-files" },
}));

export function dbJson(value: unknown) {
  return fileDb.json(JSON.parse(JSON.stringify(value)));
}

import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql.begin(async (tx) => {
    await tx.unsafe(
      await readFile(new URL("./files-schema.sql", import.meta.url), "utf8")
    );
  });
  console.log(
    "File workspace tables, read policies, and private bucket are ready."
  );
} finally {
  await sql.end();
}

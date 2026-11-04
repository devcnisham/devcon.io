// Applies Drizzle migrations, then the Supabase RLS SQL migrations.
// Order matters: RLS policies reference tables the Drizzle migrations create.
import { config } from "dotenv";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

// The project keeps real values in `.env.local` (Task 1), which dotenv does
// not load by default — `dotenv/config` only reads `.env`. quiet: true stops
// dotenv's "injected env" stdout noise.
config({ path: ".env.local", quiet: true });

execSync("npx drizzle-kit migrate", { stdio: "inherit" });

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const rlsFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // lexicographic = migration order (0001, 0002, ...)
for (const file of rlsFiles) {
  const rls = readFileSync(new URL(file, migrationsDir), "utf8");
  await sql.unsafe(rls);
  console.log(`applied ${file}`);
}
await sql.end();
console.log("db:setup complete");

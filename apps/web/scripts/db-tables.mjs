// Prints the tables Drizzle created — the "wave 1 exists" gate.
import { config } from "dotenv";
import postgres from "postgres";

// The project keeps real values in `.env.local` (Task 1), which dotenv does
// not load by default — `dotenv/config` only reads `.env`. quiet: true stops
// dotenv's "injected env" stdout noise.
config({ path: ".env.local", quiet: true });

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
const rows = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public'
  order by table_name`;
console.log(rows.map((r) => r.table_name).join("\n"));
await sql.end();

// Connects to the local database and prints one row. Fails loudly when the
// connection or the query fails — this is the "database exists" gate.
// The project keeps real values in `.env.local` (Task 1), which dotenv does
// not load by default — `dotenv/config` only reads `.env`.
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const rows = await sql`select 1 as ok`;
console.log(JSON.stringify(rows));
await sql.end();

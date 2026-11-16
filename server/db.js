import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const here = dirname(fileURLToPath(import.meta.url));

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("supabase")
        ? { rejectUnauthorized: false }
        : undefined,
      max: Number(process.env.PGPOOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  : new Pool({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || process.env.USER,
      database: process.env.PGDATABASE || "brujula_finanzas",
      password: process.env.PGPASSWORD || undefined,
    });

export async function migrate() {
  for (const version of ["001_initial", "002_planning_and_savings"]) {
    const sql = await readFile(join(here, `migrations/${version}.sql`), "utf8");
    await pool.query(sql);
    await pool.query(
      "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
      [version],
    );
  }
}

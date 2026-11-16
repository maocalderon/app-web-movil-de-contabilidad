import pg from "pg";
import { pool as localPool } from "../server/db.js";

const { Pool } = pg;
const destinationUrl = process.env.SUPABASE_DATABASE_URL;

if (!destinationUrl) {
  throw new Error("Define SUPABASE_DATABASE_URL en el entorno antes de ejecutar la migración.");
}

const cloudPool = new Pool({
  connectionString: destinationUrl,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10_000,
});

const tables = [
  "app_users",
  "accounts",
  "categories",
  "credit_cards",
  "debts",
  "movements",
  "budgets",
  "debt_payments",
];

try {
  const destination = await cloudPool.connect();
  try {
    await destination.query("BEGIN");
    await destination.query("LOCK TABLE app_users, accounts, categories, credit_cards, debts, movements, budgets, debt_payments IN SHARE ROW EXCLUSIVE MODE");

    for (const table of tables) {
      const { rows } = await destination.query(`SELECT count(*)::int AS count FROM ${table}`);
      if (rows[0].count !== 0) {
        throw new Error(`Destino no vacío: ${table} ya contiene ${rows[0].count} filas. No se copió ningún dato.`);
      }
    }

    let total = 0;
    for (const table of tables) {
      const { rows } = await localPool.query(`SELECT * FROM ${table}`);
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const insert = `INSERT INTO ${table} (${quotedColumns}) VALUES (${placeholders})`;
      for (const row of rows) {
        await destination.query(insert, columns.map((column) => row[column]));
      }
      total += rows.length;
      console.log(`${table}: ${rows.length} filas`);
    }

    await destination.query("COMMIT");
    console.log(`Migración completada: ${total} filas. Las sesiones se volverán a iniciar en el nuevo dominio.`);
  } catch (error) {
    await destination.query("ROLLBACK");
    throw error;
  } finally {
    destination.release();
  }
} finally {
  await cloudPool.end();
  await localPool.end();
}

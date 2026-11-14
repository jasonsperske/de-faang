import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH ?? path.join(here, "..", "data", "app.db");
const SEED_FILE = process.env.SEED_FILE ?? path.join(here, "..", "data", "seed.json");

/** Opens the database, creating the schema and loading the seed data the first time. */
export function openDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(path.join(here, "schema.sql"), "utf8"));
  if (db.prepare("SELECT COUNT(*) AS n FROM customers").get().n === 0) seed(db);
  return db;
}

function seed(db) {
  const data = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  const insert = (table, cols, rows) => {
    const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`);
    for (const row of rows) stmt.run(...cols.map((c) => row[c]));
  };
  db.exec("BEGIN");
  insert("customers", ["id", "name", "plan", "created_at"], data.customers);
  insert("orders", ["id", "customer_id", "amount_cents", "status", "created_at"], data.orders);
  insert("refunds", ["id", "order_id", "customer_id", "amount_cents", "created_at"], data.refunds);
  db.exec("COMMIT");
}

import fs from "node:fs";
import { DB_PATH, openDb } from "../server/db.js";

for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) fs.rmSync(f, { force: true });
const db = openDb();
const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(`Rebuilt ${DB_PATH}: ${count("customers")} customers, ${count("orders")} orders, ${count("refunds")} refunds.`);

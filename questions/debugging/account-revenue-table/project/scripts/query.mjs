// Runs one SQL statement against the app database and prints the rows as a table.
//   npm run db:query "SELECT * FROM orders WHERE customer_id = 1"
import { openDb } from "../server/db.js";

const sql = process.argv.slice(2).join(" ").trim();
if (!sql) {
  console.error('Usage: npm run db:query "SELECT ..."');
  process.exit(1);
}
const db = openDb();
const stmt = db.prepare(sql);
if (stmt.columns().length === 0) {
  const r = stmt.run();
  console.log(`OK (${r.changes} row(s) changed)`);
} else {
  const rows = stmt.all();
  if (rows.length) console.table(rows.map((r) => ({ ...r })));
  console.log(`${rows.length} row(s)`);
}

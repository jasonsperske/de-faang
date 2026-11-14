// Checks for the "account revenue table" debugging question. Plain Node (22.13+), no dependencies.
//
//   node checks/run.mjs --project <dir> [--suite public|all]
//
// Starts the candidate's API against a seed dataset (the project's own sample data, and for the
// hidden suite a second dataset with edge cases), calls GET /api/accounts, and compares every row
// with totals computed here, independently of the candidate's SQL. Prints one result line:
//   @@DEFAANG_CHECKS@@[{ name, kind, args, expected, output, passed, error }]

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const MARK = "@@DEFAANG_CHECKS@@";
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : process.argv[i + 1];
};
const project = path.resolve(arg("project", "."));
const suite = arg("suite", "all");

// ------------------------------------------------------------------ datasets

const c = (id, name, plan) => ({ id, name, plan, created_at: "2026-01-05T10:00:00Z" });
const o = (id, customer_id, amount_cents, status, day) => ({ id, customer_id, amount_cents, status, created_at: `2026-${day}T12:00:00Z` });
const r = (id, order_id, customer_id, amount_cents) => ({ id, order_id, customer_id, amount_cents, created_at: "2026-10-01T09:00:00Z" });

/** Edge cases the sample data barely covers. Customer names say what each one tests. */
const HIDDEN = {
  customers: [
    c(1, "Many orders many refunds", "business"),
    c(2, "Same amount every month", "team"),
    c(3, "Never ordered", "starter"),
    c(4, "Only voided orders", "team"),
    c(5, "Orders without refunds", "enterprise"),
    c(6, "Refunded in full", "starter"),
    c(7, "Odd cents", "business"),
  ],
  orders: [
    o(10, 1, 10001, "paid", "03-01"), o(11, 1, 20002, "paid", "04-01"), o(12, 1, 30003, "paid", "05-01"), o(13, 1, 40004, "paid", "06-01"),
    o(20, 2, 19995, "paid", "03-02"), o(21, 2, 19995, "paid", "04-02"), o(22, 2, 19995, "paid", "05-02"), o(23, 2, 19995, "void", "06-02"),
    o(40, 4, 4900, "void", "03-04"), o(41, 4, 4900, "void", "04-04"),
    o(50, 5, 124999, "paid", "03-05"), o(51, 5, 124901, "paid", "07-05"),
    o(60, 6, 4900, "paid", "03-06"),
    o(70, 7, 1, "paid", "03-07"), o(71, 7, 99, "paid", "03-08"), o(72, 7, 1050, "paid", "08-09"),
  ],
  refunds: [
    r(100, 10, 1, 1000), r(101, 11, 1, 2002), r(102, 13, 1, 333),
    r(110, 20, 2, 995), r(111, 21, 2, 995),
    r(130, 60, 6, 4900),
    r(140, 72, 7, 49),
  ],
};

/** What the Accounts table should show for each customer, computed in plain JavaScript. */
function expectedRows(data) {
  return data.customers.map((cust) => {
    const paid = data.orders.filter((x) => x.customer_id === cust.id && x.status === "paid");
    const refunds = data.refunds.filter((x) => x.customer_id === cust.id);
    const gross = paid.reduce((a, x) => a + x.amount_cents, 0);
    const refunded = refunds.reduce((a, x) => a + x.amount_cents, 0);
    const last = paid.map((x) => x.created_at).sort().at(-1) ?? null;
    return { id: cust.id, name: cust.name, orders: paid.length, gross: gross / 100, refunded: refunded / 100, net: (gross - refunded) / 100, lastOrderAt: last };
  });
}

// ------------------------------------------------------------------ running the candidate's API

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

async function withApi(seedFile, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "defaang-check-"));
  const port = await freePort();
  let log = "";
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(project, "server", "index.js")], {
    cwd: project,
    env: { ...process.env, API_PORT: String(port), DB_PATH: path.join(tmp, "check.db"), SEED_FILE: seedFile },
  });
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  let exited = false;
  child.on("exit", () => (exited = true));
  const base = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 8000;
    for (;;) {
      if (exited) throw new Error(`The API exited during start-up.\n${log.slice(-2000)}`);
      try {
        if ((await fetch(`${base}/api/health`)).ok) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error(`The API didn't answer /api/health within 8 seconds.\n${log.slice(-2000)}`);
      await new Promise((res) => setTimeout(res, 100));
    }
    return await fn(async (query) => {
      const res = await fetch(`${base}/api/accounts${query}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`GET /api/accounts${query} returned ${res.status}: ${JSON.stringify(body)}\n${log.slice(-1500)}`);
      if (!body || !Array.isArray(body.accounts)) throw new Error(`GET /api/accounts${query} should return { accounts: [...] }, got ${JSON.stringify(body)?.slice(0, 300)}`);
      return body.accounts;
    });
  } finally {
    child.kill("SIGKILL");
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ comparisons

const FIELDS = ["orders", "gross", "refunded", "net", "lastOrderAt"];
const close = (a, b) => (typeof b === "number" ? typeof a === "number" && Math.abs(a - b) < 0.005 : a === b);
const pick = (row) => (row ? Object.fromEntries(["name", ...FIELDS].map((k) => [k, row[k] ?? null])) : null);

function rowCase(kind, name, rows, want) {
  const got = rows.find((x) => x.id === want.id);
  const expected = pick(want);
  const output = pick(got);
  const passed = Boolean(got) && FIELDS.every((k) => close(got[k] ?? null, want[k]));
  return { kind, name, args: `customer "${want.name}"`, expected, output, passed };
}

function allRowsCase(kind, name, rows, wants) {
  const wrong = wants.filter((w) => {
    const got = rows.find((x) => x.id === w.id);
    return !got || !FIELDS.every((k) => close(got[k] ?? null, w[k]));
  });
  return {
    kind,
    name,
    args: `all ${wants.length} customers`,
    expected: `${wants.length} rows matching billing`,
    output: wrong.length ? `${wrong.length} wrong: ${wrong.slice(0, 4).map((w) => w.name).join(", ")}${wrong.length > 4 ? ", …" : ""}` : `${wants.length} rows matching billing`,
    passed: wrong.length === 0 && rows.length === wants.length,
  };
}

async function publicChecks() {
  const seed = path.join(project, "data", "seed.json");
  const data = JSON.parse(fs.readFileSync(seed, "utf8"));
  const wants = expectedRows(data);
  return withApi(seed, async (get) => {
    const rows = await get("?sort=net&dir=desc");
    const acme = wants.find((w) => w.name === "Acme Corp");
    const noRefunds = wants.find((w) => w.name === "Initech");
    return [
      rowCase("public", "Acme Corp matches billing", rows, acme),
      rowCase("public", "A customer without refunds has a net revenue", rows, noRefunds),
      allRowsCase("public", "Every row matches billing (sample data)", rows, wants),
    ];
  });
}

async function hiddenChecks() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "defaang-seed-"));
  const seed = path.join(tmp, "seed.json");
  fs.writeFileSync(seed, JSON.stringify(HIDDEN));
  const wants = expectedRows(HIDDEN);
  const by = (name) => wants.find((w) => w.name === name);
  try {
    return await withApi(seed, async (get) => {
      const rows = await get("?sort=net&dir=desc");
      const out = [
        rowCase("hidden", "Several orders and several refunds", rows, by("Many orders many refunds")),
        rowCase("hidden", "Orders with identical amounts all count", rows, by("Same amount every month")),
        rowCase("hidden", "A customer with no orders shows zeros", rows, by("Never ordered")),
        rowCase("hidden", "Voided orders are not revenue", rows, by("Only voided orders")),
        rowCase("hidden", "Large amounts without refunds", rows, by("Orders without refunds")),
        rowCase("hidden", "A full refund nets to zero", rows, by("Refunded in full")),
        rowCase("hidden", "Cents are preserved", rows, by("Odd cents")),
      ];
      const nets = rows.map((x) => x.net);
      const sorted = nets.every((n, i) => i === 0 || (typeof n === "number" && typeof nets[i - 1] === "number" && nets[i - 1] >= n));
      out.push({ kind: "hidden", name: "Sorted by net revenue, highest first", args: "?sort=net&dir=desc", expected: "non-increasing net values", output: nets, passed: sorted && rows.length === wants.length });
      const asc = (await get("?sort=gross&dir=asc")).map((x) => x.gross);
      out.push({
        kind: "hidden",
        name: "Sorting by another column still works",
        args: "?sort=gross&dir=asc",
        expected: "non-decreasing gross values",
        output: asc,
        passed: asc.length === wants.length && asc.every((n, i) => i === 0 || (typeof n === "number" && asc[i - 1] <= n)),
      });
      const found = await get("?sort=net&dir=desc&q=refund");
      const want = wants.filter((w) => w.name.toLowerCase().includes("refund")).map((w) => w.name).sort();
      out.push({ kind: "hidden", name: "Search still filters by name", args: "?q=refund", expected: want, output: found.map((x) => x.name).sort(), passed: JSON.stringify(found.map((x) => x.name).sort()) === JSON.stringify(want) });
      return out;
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const failAll = (kind, names, err) => names.map((name) => ({ kind, name, args: "", expected: null, output: null, passed: false, error: String(err?.message ?? err) }));

const results = [];
try {
  results.push(...(await publicChecks()));
} catch (e) {
  results.push(...failAll("public", ["Acme Corp matches billing", "A customer without refunds has a net revenue", "Every row matches billing (sample data)"], e));
}
if (suite === "all") {
  try {
    results.push(...(await hiddenChecks()));
  } catch (e) {
    results.push(...failAll("hidden", ["Hidden checks"], e));
  }
}
console.log(MARK + JSON.stringify(results));

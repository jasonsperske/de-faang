import http from "node:http";
import { openDb } from "./db.js";
import { listAccounts } from "./accounts.js";

const db = openDb();
const port = Number(process.env.API_PORT ?? 3001);

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/api/health") return send(res, 200, { ok: true });
    if (req.method === "GET" && url.pathname === "/api/accounts") {
      const accounts = listAccounts(db, {
        sort: url.searchParams.get("sort") ?? undefined,
        dir: url.searchParams.get("dir") ?? undefined,
        search: url.searchParams.get("q") ?? "",
      });
      return send(res, 200, { accounts });
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`[api] listening on http://127.0.0.1:${port}`));

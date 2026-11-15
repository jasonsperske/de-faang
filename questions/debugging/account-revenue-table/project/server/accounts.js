// Revenue summary per customer, used by the Accounts page and the finance export.

const SORTABLE = {
  name: "c.name",
  plan: "c.plan",
  orders: "orders",
  gross: "gross",
  refunded: "refunded",
  net: "net",
  lastOrderAt: "lastOrderAt",
};

export function listAccounts(db, { sort = "net", dir = "desc", search = "" } = {}) {
  const orderBy = SORTABLE[sort] ?? SORTABLE.net;
  const direction = dir === "asc" ? "ASC" : "DESC";
  return db
    .prepare(
      `SELECT
         c.id,
         c.name,
         c.plan,
         COUNT(o.id)                                    AS orders,
         SUM(o.amount_cents) / 100                      AS gross,
         SUM(r.amount_cents) / 100                      AS refunded,
         (SUM(o.amount_cents) - SUM(r.amount_cents)) / 100 AS net,
         MAX(o.created_at)                              AS lastOrderAt
       FROM customers c
       LEFT JOIN orders o  ON o.customer_id = c.id AND o.status = 'paid'
       LEFT JOIN refunds r ON r.customer_id = c.id
       WHERE c.name LIKE '%' || ? || '%'
       GROUP BY c.id
       ORDER BY ${orderBy} ${direction}, c.id`,
    )
    .all(search)
    .map((row) => ({ ...row }));
}

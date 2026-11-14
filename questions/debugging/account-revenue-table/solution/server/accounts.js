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

// Orders and refunds are aggregated separately before the join. Joining both tables to customers
// first multiplies every order by every refund of the same customer (a join fan-out), which inflated
// the counts and sums. Amounts are integer cents: divide by 100.0, not 100, to keep the cents, and
// COALESCE the sums so a customer without orders or refunds gets 0 instead of NULL.
export function listAccounts(db, { sort = "net", dir = "desc", search = "" } = {}) {
  const orderBy = SORTABLE[sort] ?? SORTABLE.net;
  const direction = dir === "asc" ? "ASC" : "DESC";
  return db
    .prepare(
      `WITH paid AS (
         SELECT customer_id, COUNT(*) AS orders, SUM(amount_cents) AS cents, MAX(created_at) AS last_at
         FROM orders
         WHERE status = 'paid'
         GROUP BY customer_id
       ),
       refunded AS (
         SELECT customer_id, SUM(amount_cents) AS cents
         FROM refunds
         GROUP BY customer_id
       )
       SELECT
         c.id,
         c.name,
         c.plan,
         COALESCE(p.orders, 0)                                AS orders,
         COALESCE(p.cents, 0) / 100.0                         AS gross,
         COALESCE(r.cents, 0) / 100.0                         AS refunded,
         (COALESCE(p.cents, 0) - COALESCE(r.cents, 0)) / 100.0 AS net,
         p.last_at                                            AS lastOrderAt
       FROM customers c
       LEFT JOIN paid p     ON p.customer_id = c.id
       LEFT JOIN refunded r ON r.customer_id = c.id
       WHERE c.name LIKE '%' || ? || '%'
       ORDER BY ${orderBy} ${direction}, c.id`,
    )
    .all(search)
    .map((row) => ({ ...row }));
}

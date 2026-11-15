CREATE TABLE IF NOT EXISTS customers (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  plan        TEXT    NOT NULL CHECK (plan IN ('starter', 'team', 'business', 'enterprise')),
  created_at  TEXT    NOT NULL
);

-- One row per invoice. Voided invoices stay in the table for the audit trail.
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY,
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents >= 0),
  status        TEXT    NOT NULL CHECK (status IN ('paid', 'void')),
  created_at    TEXT    NOT NULL
);

-- Partial or full refunds of paid orders.
CREATE TABLE IF NOT EXISTS refunds (
  id            INTEGER PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id),
  customer_id   INTEGER NOT NULL REFERENCES customers(id),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at    TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS refunds_customer ON refunds (customer_id);

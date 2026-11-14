# billing-admin

Internal admin console for the billing team.

```bash
npm run dev                          # web UI and API, with hot reloading
npm run db:reset                     # rebuild data/app.db from data/seed.json
npm run db:query "SELECT * FROM customers LIMIT 5"
```

The database is SQLite (`data/app.db`). It is created and seeded on first start.

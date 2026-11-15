# Wrong Revenue in the Accounts Table

**Type:** Debugging · **Difficulty:** Medium · **Time:** 45 min · **Tags:** `react` `sql` `sqlite` `joins` `aggregation` · **AI-assisted:** available

You've just joined the team that owns **billing-admin**, the internal console the billing and finance teams use every day. This ticket was assigned to you this morning:

Full prompt: [prompt.md](prompt.md).

## The round

You get a bug report ([prompt.md](prompt.md)) and a copy of the app in [`project/`](project/), running with hot reloading (in Docker, or on your machine with the local runner). There's no architecture overview: finding your way around is part of the exercise. The prompt panel has a **Files** tab for browsing and opening the project's files, and the panel under the editor has the app's **Preview**, its **Logs**, and a **Terminal**. Your fix is graded by checks against the sample data and a hidden dataset ([`checks/`](checks/), a spoiler), and by how you investigated.

## How it's graded

Rubric: [`debugging`](../../../rubrics/README.md#debugging) (Debugging interview rubric). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.

| Dimension | Weight | Learn more |
|---|---|---|
| Reproducing & scoping the bug | 15% | [David Agans — Debugging: the 9 indispensable rules](https://debuggingrules.com/)<br>[Julia Evans — A debugging manifesto](https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/) |
| Investigation & navigating unfamiliar code | 20% | [Julia Evans — A debugging manifesto](https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/)<br>[React — React Developer Tools](https://react.dev/learn/react-developer-tools)<br>[SQLite — SELECT (joins, GROUP BY, ORDER BY, common table expressions)](https://www.sqlite.org/lang_select.html) |
| Root-cause analysis | 25% | [SQLite — Built-in aggregate functions (SUM, COUNT, TOTAL and NULLs)](https://www.sqlite.org/lang_aggfunc.html)<br>[SQLite — SQL expressions (operators, integer division, NULL)](https://www.sqlite.org/lang_expr.html)<br>[SQLite — SELECT (joins, GROUP BY, ORDER BY, common table expressions)](https://www.sqlite.org/lang_select.html) |
| Fix correctness & quality | 20% | [SQLite — Built-in aggregate functions (SUM, COUNT, TOTAL and NULLs)](https://www.sqlite.org/lang_aggfunc.html)<br>[SQLite — SELECT (joins, GROUP BY, ORDER BY, common table expressions)](https://www.sqlite.org/lang_select.html) |
| Verification & testing | 10% | [David Agans — Debugging: the 9 indispensable rules](https://debuggingrules.com/) |
| Communication | 10% | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |

## How it's graded in AI-assisted rounds

Rubric: [`ai-coding`](../../../rubrics/README.md#ai-coding) (AI-assisted coding interview rubric). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.

| Dimension | Weight | Learn more |
|---|---|---|
| Problem understanding & framing | 13% | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)<br>[Tech Interview Handbook — Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) |
| Directing the AI | 17% | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |
| Verifying AI output | 22% | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |
| Understanding & ownership | 13% | [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)<br>[NeetCode — Practice roadmap](https://neetcode.io/roadmap) |
| Final correctness & code quality | 13% | [Tech Interview Handbook — Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) |
| Communication | 9% | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |
| Grounding the AI in the real codebase *(question-specific)* | 13% | [Julia Evans — A debugging manifesto](https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/)<br>[SQLite — Built-in aggregate functions (SUM, COUNT, TOTAL and NULLs)](https://www.sqlite.org/lang_aggfunc.html) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

The table component renders whatever GET /api/accounts returns; the bug is in the SQL in server/accounts.js, which has three independent defects. (1) Join fan-out: customers is LEFT JOINed to paid orders AND to refunds in one query, so each customer gets (paid orders × refunds) rows before GROUP BY. COUNT(o.id) and SUM(o.amount_cents) are multiplied by the number of refunds and SUM(r.amount_cents) by the number of orders (Acme: 3 orders × 2 refunds = 6 rows, so 6 orders and double gross). (2) Integer division: amounts are integer cents and `/ 100` is integer division in SQLite, so cents are truncated (59985 / 100 = 599). (3) NULL arithmetic: a customer with no refunds has SUM(r.amount_cents) = NULL, so net = (gross - NULL) = NULL, which the table renders as an empty cell (and the footer total skips); a customer with no orders gets NULL everywhere. A strong fix aggregates orders and refunds separately (CTEs or subqueries grouped by customer_id, or correlated subqueries) and LEFT JOINs the aggregates, divides by 100.0, and wraps the sums in COALESCE(…, 0), keeping the API's shape (dollars) and sorting/search intact. A strong candidate reproduces the Acme numbers first, traces table → src/api.js → server/index.js → server/accounts.js, confirms with `npm run db:query` against the base tables (e.g. SELECT COUNT(*) FROM orders WHERE customer_id = 1 AND status = 'paid'), explains each mechanism, and verifies the whole table and edge cases afterwards.

**Common pitfalls**

- Fixing the symptom in the UI: formatting null as $0.00, or dividing in the component, while the API stays wrong (Finance's export uses the API).
- Using COUNT(DISTINCT o.id) for the count but SUM(DISTINCT o.amount_cents) for the totals, which silently drops orders or refunds with the same amount.
- Fixing only the fan-out and missing the integer division or the NULL net (or the reverse).
- Special-casing Acme or the seed data, or editing data/seed.json or the database instead of the query.
- Dropping the status = 'paid' filter while restructuring the query, so voided invoices count as revenue.
- Changing the API's response shape (e.g. returning cents or strings), which breaks the finance export.
- Breaking sorting or search while rewriting the query (e.g. ORDER BY on a column alias that no longer exists).

</details>

## Follow-up questions

Asked in writing after you submit.

- Explain the root cause of each symptom in the bug report to Priya in two or three sentences she would understand, then explain it to an engineer reviewing your fix.
- Why does joining orders and refunds to customers in the same query inflate the numbers? Name two other correct ways to write the query and the tradeoffs between them.
- What automated test would have caught this bug before it shipped? Describe its data and assertions, and where in the stack it would run.
- Money is stored as integer cents. What are the risks of turning it into floating-point dollars in the API, and how would you design the API's money fields if you could change the contract?
- This bug reached Finance's month-end close. What would you change in the team's process or monitoring so a wrong aggregate is noticed sooner?

## Study resources

- [SQLite — Built-in aggregate functions (SUM, COUNT, TOTAL and NULLs)](https://www.sqlite.org/lang_aggfunc.html)
- [SQLite — SQL expressions (operators, integer division, NULL)](https://www.sqlite.org/lang_expr.html)
- [SQLite — SELECT (joins, GROUP BY, ORDER BY, common table expressions)](https://www.sqlite.org/lang_select.html)
- [Julia Evans — A debugging manifesto](https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/)
- [David Agans — Debugging: the 9 indispensable rules](https://debuggingrules.com/)
- [Node.js — node:sqlite module](https://nodejs.org/api/sqlite.html)
- [React — React Developer Tools](https://react.dev/learn/react-developer-tools)
- [Vite — Features: hot module replacement](https://vite.dev/guide/features#hot-module-replacement)

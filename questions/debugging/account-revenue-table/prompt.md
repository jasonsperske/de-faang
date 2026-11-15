# Wrong Revenue in the Accounts Table

You've just joined the team that owns **billing-admin**, the internal console the billing and finance teams use every day. This ticket was assigned to you this morning:

> **BILL-2417: Accounts page numbers don't match billing**
>
> *Reported by Priya (Finance)*
>
> The revenue numbers on the Accounts page are wrong, and I can't use the page for the month-end close.
>
> - **Acme Corp** shows **6 orders** and **$1,199.00** gross revenue. Our billing system has **3 paid invoices** for them, **$599.85** in total, and two partial refunds of **$24.95** and **$25.00**, so their net revenue should be **$549.90**.
> - The **Net revenue** column is empty for a lot of customers, and the total at the bottom of the page doesn't match my spreadsheet.
> - Every amount on the page seems to be a whole number of dollars, but most of our prices have cents.
>
> Finance also pulls the same numbers from the `/api/accounts` endpoint into its export, so it needs to be right there too, with amounts in dollars like it is now.

**Your task:** find out why the Accounts table is wrong, fix it, and show that it's fixed.

- The app is running in the **Preview** tab under the editor. Edits you make in the editor are saved and the app reloads automatically.
- The **Files** tab (next to this prompt) has the whole project.
- The **Terminal** tab runs commands from the project's root folder, e.g. `npm run db:query "SELECT ..."` or `npm run db:reset`.
- **Run checks** (except in strict mode) runs the sample checks from the bug report against your copy of the project.
- Talk the interviewer through what you're doing and why, as you would with a colleague.

When you're done, explain the root cause and your fix, and submit. Your fix is checked against the sample data and against a second dataset you can't see.

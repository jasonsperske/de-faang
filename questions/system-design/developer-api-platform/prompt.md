# Design a Developer API Platform with Usage-Based Billing

A company with a popular writing-assistance product wants to sell its text-analysis engine to other companies as a **public API**. Design the platform that turns the internal engine into a product developers can sign up for, try, integrate, and pay for.

Scope:

- **In scope:** the developer-facing platform: sign-up and organizations, API keys, an interactive API playground, the API gateway in front of the engine, plans and quotas, usage metering, usage dashboards, and producing accurate monthly bills.
- **Out of scope:** the text-analysis engine itself (treat it as an internal service you call), and card processing (a payment provider charges the invoices you produce).

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Ask about developers, plans, traffic, latency, and billing accuracy. The interviewer has the numbers.
2. **Define the API surface**: how developers authenticate, what a request and error look like, and how quotas show up to clients.
3. **Design the system**: the request path through the gateway, how usage is metered and aggregated, and how a month of usage becomes an invoice.
4. **Go deep** on the hardest parts, such as low-overhead authentication and quota checks, metering that is never double-counted or lost, and keeping the playground from becoming a free API.

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, estimates, and tradeoffs. The interviewer sees both when you send a message.

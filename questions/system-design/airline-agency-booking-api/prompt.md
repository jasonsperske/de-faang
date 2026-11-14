# Design an Airline Booking API for Travel Agencies

An airline sells seats **only through travel agencies**. Design the API and backend that agencies call to create, confirm, change, and cancel flight orders.

Scope:

- **In scope:** the order operations and everything they touch: seat inventory, order state, and making sure that retries, timeouts and concurrent requests never double-book, oversell, or lose an order.
- **Out of scope:** storing customer or passenger personal data, and payment processing. Agencies refer to passengers with their own references and settle with the airline separately.

The main focus is **idempotent transactions that scale**: agencies retry aggressively over unreliable networks, and demand spikes during sales.

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Ask about agencies, order lifecycle, load, retries, and the systems you integrate with. The interviewer has the numbers.
2. **Define the API**: endpoints, request and response shapes, error semantics, and how clients retry safely.
3. **Design the backend**: data model, inventory, and how a multi-step order stays consistent when things fail halfway.
4. **Go deep** on idempotency, concurrency, and scaling.

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, API definitions, and tradeoffs. The interviewer sees both when you send a message.

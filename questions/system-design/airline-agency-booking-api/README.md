# Design an Airline Booking API for Travel Agencies

**Type:** System design · **Difficulty:** Hard · **Time:** 45 min · **Tags:** `system-design` `api-design` `idempotency` `transactions` `sagas`

An airline sells seats **only through travel agencies**. Design the API and backend that agencies call to create, confirm, change, and cancel flight orders.

Full prompt: [prompt.md](prompt.md).

## How it's graded

Rubric: [`system-design`](../../../rubrics/README.md#system-design) (System design interview rubric). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.

| Dimension | Weight | Learn more |
|---|---|---|
| Requirements & scoping | 20% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)<br>[Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |
| High-level design | 25% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Deep dive & technical depth | 25% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) |
| Scalability, reliability & tradeoffs | 20% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[Google SRE Book](https://sre.google/sre-book/table-of-contents/)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Communication & leadership | 10% | [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Strong answers scope tightly: no customer PII and no payment processing, so the API deals in orders that reference agency-supplied passenger references, with commitment recorded against the agency's credit account. API: POST /v1/orders with a required Idempotency-Key header (scoped per agency; the server stores a fingerprint of the request body and rejects reuse with a different body with 422, and returns 409 or waits when the original is still in flight); GET /v1/orders/{id}; POST /v1/orders/{id}/confirm, /cancel, and /changes, each either taking an idempotency key or being idempotent by state transition (confirming an already-confirmed order returns the same result); ETag/If-Match or an order version for concurrent modifications; long-running work such as ticketing returns 202 with a status resource plus signed webhooks with event ids (at-least-once; agencies dedupe on event id). Idempotency storage: a durable table keyed by (agency_id, idempotency_key) written in the SAME database transaction as the order (or the order id derived deterministically from that pair so the order's primary key is the dedupe), holding status, request hash, and the response to replay; retention of days, not minutes, because agencies replay hours later; never a cache alone. Inventory: counters per (flight, date, fare bucket) with an atomic conditional update (UPDATE ... SET held = held + n WHERE capacity - sold - held >= n), never read-then-write; holds expire after 20 minutes via a state-guarded transition (UPDATE ... WHERE status = 'HELD' AND expires_at < now()), so confirm and expiry race safely and exactly one wins. Multi-segment orders span inventory shards, so use a saga, not 2PC: a persisted order state machine reserves each segment with an idempotent reservation keyed by (order_id, segment), compensates (releases) on failure, and recovers from a crash by resuming from the stored state. Confirm: one local transaction moves HELD to CONFIRMED, records an idempotent credit-ledger entry keyed by order_id (credit check against the agency's limit), and writes an outbox row; an outbox worker calls the legacy ticketing system with a client reference derived from the order (e.g. order_id + version), and on timeout looks up by that reference before retrying, so tickets are issued once. Scale: partition orders and idempotency records by agency or order id together; partition inventory by flight-date; hot flights during sales need short transactions, maybe bucket splitting; per-agency rate limits and quotas protect fairness. Multi-region: idempotency records must be globally consistent (a globally consistent database, or a home region per agency for writes and per flight for inventory); discuss what happens to in-flight holds when a region fails.

**Common pitfalls**

- Idempotency keys checked with read-then-insert (race between duplicate requests) instead of a unique constraint or conditional write.
- Recording the idempotency key in a different transaction from the order, so a crash between the two creates a duplicate order or a key pointing at nothing.
- Keeping idempotency records only in a cache, or with a TTL shorter than the agencies' retry window.
- Not storing or comparing a request fingerprint, so a reused key with a different body silently returns the wrong order.
- Overselling via read-modify-write on seat counts, or a global lock on the flight that won't scale during sales.
- Using two-phase commit across inventory shards and the ticketing system, or ignoring partial failure in multi-segment orders.
- Calling the non-idempotent ticketing system synchronously from the API request, and retrying it blindly after a timeout.
- A hold-expiry job and confirm that can both succeed for the same seats because transitions aren't conditioned on the current state.
- Spending the interview on customer profiles or payments, which are explicitly out of scope.

**Likely deep dives**

- Idempotency-key semantics and storage: scope, fingerprinting, in-flight duplicates, retention, and atomicity with the order write
- Inventory concurrency: atomic holds, hold expiry versus confirm, hot flights during flash sales
- Multi-segment orders as a saga: reservations, compensation, crash recovery
- Exactly-once ticket issuance with a transactional outbox and a non-idempotent downstream system
- Partitioning and multi-region consistency for idempotency records and inventory

</details>

## Follow-up questions

Asked in writing after you submit.

- An agency sends a create-order request, your service commits the order, and the response is lost. The agency retries 30 seconds later, and again 6 hours later after an outage on their side. Walk through exactly what your system does each time, including where the idempotency record lives and when it expires.
- Two requests arrive at the same moment with the same idempotency key but different passenger counts. What does each one get back, and how do you guarantee that in your storage layer?
- An order has three segments on flights whose inventory lives on different shards. The second segment's reservation fails. How do you leave the system consistent, and what does the agency see?
- The legacy ticketing system sometimes times out after it has already issued the tickets. How do you make ticket issuance exactly-once from the agency's point of view?
- An agency confirms an order one second before its hold expires, while the expiry job is releasing the same seats. Show how your design makes sure exactly one of those wins and the seats are never both released and ticketed.

## Study resources

- [Stripe — Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)
- [Brandur Leach — Implementing Stripe-like idempotency keys in Postgres](https://brandur.org/idempotency-keys)
- [IETF draft — The Idempotency-Key HTTP header field](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
- [microservices.io — Saga pattern](https://microservices.io/patterns/data/saga.html)
- [microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)
- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)

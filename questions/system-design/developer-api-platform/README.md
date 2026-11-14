# Design a Developer API Platform with Usage-Based Billing

**Type:** System design · **Difficulty:** Hard · **Time:** 45 min · **Tags:** `system-design` `api-design` `metering` `billing` `multi-tenancy`

A company with a popular writing-assistance product wants to sell its text-analysis engine to other companies as a **public API**. Design the platform that turns the internal engine into a product developers can sign up for, try, integrate, and pay for.

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

Strong answers separate the synchronous request path (auth, quota, rate limit, proxy to the engine) from the asynchronous metering and billing path, and treat billing as a correctness problem rather than a counting problem. Requirements: self-serve sign-up with organizations and members; multiple API keys per org (create, label, rotate, revoke); free, pay-as-you-go and enterprise plans; per-key rate limits and per-org monthly quotas; playground; usage dashboards within minutes; monthly invoices that are exact. Estimates: 2B billable calls/month is ~770/s average, ~20k/s peak; usage events at 20k/s x ~200 bytes = 4 MB/s, ~500 GB/month raw; 50k orgs is tiny metadata. Request path: TLS terminates at a regional gateway; API key is a random secret with a public prefix (for display/lookups) and is stored only as a hash; the gateway caches key -> org/plan/limits in memory with a short TTL plus push invalidation for revocations (pub/sub), so auth costs no network hop. Rate limits per key with a token bucket in Redis (Lua script) or local buckets with a global budget split across nodes; monthly quota checked against an approximate running counter (soft limit, with overage policy per plan) rather than the exact billing ledger. Errors: 401/403/429 with Retry-After and rate-limit headers; request ids on every response. Metering: the gateway emits a usage event per request with a unique request id (and the units: characters or suggestion count) to a durable log (Kafka) asynchronously, buffered locally with a write-ahead file so a crash doesn't lose events; consumers deduplicate on request id (idempotent upsert) and aggregate into per-org/per-key per-minute rollups (stream processor) for dashboards; raw events kept in object storage for audits. Billing: at period close, a batch job computes usage per org from the deduplicated store, applies the plan's pricing (tiers, included units, overage, committed spend for enterprise), writes immutable invoice line items, and hands invoices to the payment provider with an idempotency key; late events after close go into the next invoice as adjustments. Playground: runs through the same gateway with a special low-quota key per signed-in user, or anonymous with CAPTCHA, strict per-IP limits, short input caps, and no raw API responses beyond what the UI needs. Multi-region: keys and plans replicated globally; usage written regionally and aggregated centrally. Observability: per-org latency/error dashboards, alerts for partner SLAs.

**Common pitfalls**

- Writing a row to the primary database (or incrementing a SQL counter) synchronously on every API call, which adds latency and becomes the bottleneck at peak.
- Storing API keys in plaintext, or looking them up in the database on every request without caching.
- Billing from the rate limiter's counters, which are approximate, reset, and not auditable.
- Fire-and-forget usage events with no deduplication or durability, so crashes lose revenue and retries double-bill.
- Treating quotas and rate limits as the same thing: per-second burst protection versus monthly plan entitlements.
- Ignoring late-arriving events and period boundaries when closing an invoice.
- No story for key revocation propagation, or one that relies on cache expiry of many minutes.
- Exposing an unlimited playground backed by a shared internal key.

**Likely deep dives**

- Gateway request path: API key hashing and lookup, in-memory caching, and fast revocation
- Rate limits versus monthly quotas: where each is enforced and how accurate each must be
- Exactly-once usage metering: request ids, durable local buffering, a log, and idempotent aggregation
- From usage to invoice: period close, pricing tiers, late events, and idempotent handoff to the payment provider
- Protecting the playground and free tier from abuse

</details>

## Follow-up questions

Asked in writing after you submit.

- Walk through one API request end to end, from the developer's HTTP call to the response, listing every check your gateway makes. What does each one cost in latency, and which ones can be served from memory?
- A gateway node crashes after the engine has processed 10,000 requests but before their usage events were durably recorded. How does your design make sure those requests are billed exactly once?
- An enterprise partner disputes their invoice, claiming they made 20% fewer calls than you billed. What data do you have to settle the dispute, and how long do you keep it?
- A developer's API key is leaked on a public repository and someone starts using it heavily. How is it detected, how is it revoked across every gateway node, and how fast does revocation take effect?
- How do you stop the anonymous playground on your marketing site from being used as a free version of the API?

## Study resources

- [Stripe — Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters)
- [Wikipedia — Token bucket](https://en.wikipedia.org/wiki/Token_bucket)
- [Stripe — Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)
- [Stripe docs — Usage-based billing](https://docs.stripe.com/billing/subscriptions/usage-based)
- [OWASP API Security Project](https://owasp.org/API-Security/)
- [Apache Kafka — Documentation](https://kafka.apache.org/documentation/)
- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)
- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)

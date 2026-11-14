# Design a Distributed Rate Limiter

**Type:** System design · **Difficulty:** Medium · **Time:** 45 min · **Tags:** `system-design` `distributed-systems` `algorithms` `redis`

Design a rate limiter that protects a large public API from abuse and overload. Requests over the limit should be rejected quickly, and the limiter must work correctly when the API runs on many servers.

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

Strong answers: clarify where the limiter lives (client, gateway or middleware, separate service), the limiting key (user, API key, IP), rules (per endpoint, per tier), and accuracy versus latency requirements. Compare algorithms: token bucket allows bursts; sliding window counter is memory-efficient and accurate enough; sliding log is precise but memory-heavy. Distributed state in Redis with atomic operations (Lua script or INCR+EXPIRE), possibly with local in-memory counters plus periodic sync to reduce latency. Rules stored in a config service and cached. Return HTTP 429 with Retry-After and X-RateLimit-* headers. Discuss fail-open vs fail-closed, Redis sharding by key, hot keys, clock skew, and multi-region tradeoffs.

**Common pitfalls**

- Fixed window without acknowledging the boundary burst problem.
- Read-then-write counter updates without atomicity (race conditions).
- Adding a synchronous network hop with no latency budget discussion.
- Ignoring the failure mode of the shared store.

**Likely deep dives**

- Algorithm choice and burst behaviour
- Atomic distributed counters
- Failure modes and fail-open
- Rule configuration and propagation

</details>

## Follow-up questions

Asked in writing after you submit.

- Compare fixed window, sliding window log, sliding window counter, and token bucket. Which did you pick, and why?
- Your rate limiter runs on 50 API gateway nodes. How do they share state, and what happens when the shared store is slow or down? Do you fail open or fail closed?
- How do you avoid race conditions when two requests for the same user hit different nodes at the same instant?
- How would you support different limits per customer tier and per endpoint, changeable without a deploy?
- What does the client see when it is rate limited, and how should well-behaved clients react?

## Study resources

- [Stripe — Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters)
- [Wikipedia — Token bucket](https://en.wikipedia.org/wiki/Token_bucket)
- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [ByteByteGo — System design](https://bytebytego.com/)
- [Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)

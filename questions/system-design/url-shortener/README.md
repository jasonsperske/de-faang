# Design a URL Shortener

**Type:** System design · **Difficulty:** Medium · **Time:** 45 min · **Tags:** `system-design` `storage` `caching` `id-generation`

Design a service like **bit.ly** that takes a long URL and returns a short link. Visiting the short link redirects the user to the original URL.

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

Strong answers: clarify functional (shorten, redirect, optional custom alias, expiry, analytics) and non-functional requirements (low-latency redirects, high availability, read-heavy). Estimate scale. Define APIs (POST /urls, GET /{code} -> 301/302). Data model: code -> long URL, owner, created, expires. ID generation: base62 of a unique counter (distributed via ranges from a coordinator such as ZooKeeper or a DB sequence) or hashing with collision checks; 7 base62 characters ≈ 3.5 trillion codes. Storage: key-value store (DynamoDB/Cassandra) or sharded SQL. Cache hot codes (Redis) in front of the DB plus CDN at the edge. 301 vs 302 tradeoff (cacheability vs analytics). Analytics asynchronous via a queue/log (Kafka) into an OLAP store. Rate limiting and abuse prevention.

**Common pitfalls**

- Jumping into components without clarifying requirements or scale.
- Hashing the URL and truncating without handling collisions.
- A single global counter that becomes a bottleneck or single point of failure.
- Doing analytics writes synchronously on the redirect path.
- Not discussing 301 vs 302.

**Likely deep dives**

- Unique ID generation at scale
- Cache strategy and eviction for hot links
- Database choice and sharding key
- Analytics pipeline

</details>

## Follow-up questions

Asked in writing after you submit.

- How do you generate short codes so that two writers never collide? Compare a hash-based approach with a counter- or range-based approach.
- Your read traffic is 100x your write traffic. Walk me through exactly what happens on a redirect, and where the cache sits.
- How would you support custom aliases and link expiration?
- A single link goes viral and receives 1M requests per second. What breaks first, and how do you handle it?
- How would you add click analytics without slowing down the redirect path?

## Study resources

- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [System Design Primer — Design Pastebin (URL-shortener style)](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md)
- [Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)
- [Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing)
- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)
- [ByteByteGo — System design](https://bytebytego.com/)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)

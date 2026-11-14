# Design r/place with Multiple Canvases

**Type:** System design · **Difficulty:** Hard · **Time:** 45 min · **Tags:** `system-design` `real-time` `websockets` `fan-out` `abuse-prevention`

Design a collaborative pixel canvas in the style of Reddit's r/place. Visitors see a large shared image and can colour one pixel at a time; after placing a pixel, they must wait before placing another. Everyone watching sees changes appear in near real time.

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

Strong answers separate the write path, the real-time read path, and the cold read path. Requirements: anonymous view and place; per-identity cooldown per canvas; many canvases with one very hot one; updates visible in about a second; last-write-wins per pixel is fine; history kept for timelapse and moderation. Estimates: flagship 2000x2000 with 32 colours is 4M pixels; at 5 bits (or 8) per pixel that is 2.5-4 MB raw, much smaller compressed; peak ~50k placements/s globally (~5M active placers on a 5-minute cooldown is ~17k/s; bursts higher); ~5M concurrent viewers needs ~50-100 WebSocket gateway nodes; fan-out of individual events (50k/s x 5M viewers) is impossible, so batch diffs per canvas (or per tile) every 100-250 ms. Write path: API validates an anonymous signed token (issued on first visit, bound to IP/device signals, harder to get under suspicion via proof-of-work or CAPTCHA), checks the cooldown atomically (Redis SET key NX EX 300 per token+canvas, plus coarser per-IP/subnet limits), writes the pixel to the canvas state (Redis BITFIELD per canvas, sharded by canvas id; the flagship can be split into tiles across shards), and appends the event to a durable log (Kafka partitioned by canvas/tile) that feeds history storage (Cassandra or object storage) and the fan-out service. Real-time path: a fan-out service consumes the log, coalesces per-canvas diffs on a short tick, and publishes to gateway nodes subscribed by canvas (pub/sub fan-out tree); clients only receive canvases (or tiles/viewport) they view. Cold read path: a snapshot service periodically renders each active canvas to a compressed image or binary with a sequence number and pushes it to object storage behind a CDN; clients load the snapshot, buffer live diffs from the WebSocket, then apply diffs with seq > snapshot seq. Multi-canvas: a canvas metadata service (size, palette, cooldown, owner, status, shard); quiet canvases share shards and can be evicted from memory and rebuilt from snapshot + log on demand; hot canvases get dedicated shards, tiles, and more gateway capacity. Moderation: per-token bans, region rollback by replaying the event log up to a timestamp or restoring the previous value per pixel, with an audit trail.

**Common pitfalls**

- Storing every pixel as a row in a relational database and reading the whole canvas with a query on every page load.
- Pushing every individual pixel event to every connected viewer: fan-out explodes; updates must be batched and scoped per canvas or tile.
- Non-atomic cooldown checks (read-then-write), letting a user place several pixels at once by racing requests.
- Treating anonymous identity as 'just use the IP address' without discussing NAT, mobile carriers, VPNs and bots, or as 'just use a cookie' without making new cookies costly.
- No snapshot plus sequence-number catch-up, so new viewers either miss updates or see a torn canvas.
- Designing only for the flagship canvas: provisioning dedicated resources for thousands of mostly idle canvases, or ignoring that one hot canvas needs to be partitioned.
- Forgetting the durable event log, which makes history, timelapse and moderation rollback impossible.

**Likely deep dives**

- Real-time fan-out to millions of viewers: batching, gateway tier, subscription by canvas or tile
- Snapshot plus sequence-number catch-up for new viewers
- Anonymous identity, atomic cooldowns, and bot resistance
- Partitioning: many quiet canvases versus one hot canvas (tiling, shard placement, eviction)
- Durable event log for history, timelapse, and moderation rollback

</details>

## Follow-up questions

Asked in writing after you submit.

- Walk through exactly what happens, end to end, from an anonymous user clicking a pixel to that pixel appearing on another viewer's screen. Where is the latency spent, and where can a placement be lost?
- How does a viewer who opens the flagship canvas mid-event get a consistent picture, given that pixels keep changing while the snapshot downloads?
- Anyone can place pixels without an account. How do you enforce the per-user cooldown, and how do you stop one person with a script from acting like thousands of users? What does that cost legitimate users?
- Most canvases are small and quiet, but one has millions of viewers. How does your design handle both without wasting resources on the quiet ones or melting on the hot one?
- A moderator needs to undo a coordinated vandalism attack on part of the flagship canvas from the last 20 minutes. How does your design support that?

## Study resources

- [Reddit — How we built r/place (2017)](https://redditinc.com/news/how-we-built-rplace)
- [Redis — BITFIELD command](https://redis.io/docs/latest/commands/bitfield/)
- [Redis — Pub/Sub](https://redis.io/docs/latest/develop/interact/pubsub/)
- [Wikipedia — Token bucket](https://en.wikipedia.org/wiki/Token_bucket)
- [Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing)
- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)
- [Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)

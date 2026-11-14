# Design Native Ads in an Email Inbox

**Type:** System design · **Difficulty:** Hard · **Time:** 45 min · **Tags:** `system-design` `ads` `low-latency` `stream-processing` `cross-platform`

A large webmail service shows a few **native ads** at the top of the inbox, styled like email rows. Tapping one opens an ad "message" that can include an interactive lead-generation form. The inbox is used on the web and in iOS and Android apps.

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

Strong answers separate the latency-critical serving path from the high-volume, correctness-critical event path, and keep the inbox fast even when ads fail. Requirements: up to 2 ad slots per inbox load; ads must never delay mail rendering (fetched in parallel, rendered when ready, dropped after a timeout); targeting by coarse signals (location, language, declared interests, device) and never by email content; frequency caps per user per campaign per day; dismissals respected on every device; daily budgets and pacing; CPC and CPM pricing; lead forms; advertiser reports within ~15 minutes; exact daily billing with invalid traffic removed. Estimates: 300M DAU x ~10 inbox opens/day = 3B ad requests/day, ~35k/s average, ~100k/s peak; impressions ~4B/day (2 slots, some empty); clicks ~1% (~40M/day); events ~5B/day x ~300 bytes = ~1.5 TB/day raw. Serving: client calls an ad API in parallel with the mail fetch (or the inbox backend fans out with a ~50 ms budget); ad server loads a user profile (interests, caps, dismissals) from a low-latency store keyed by user id (e.g. Bigtable/Cassandra/Redis), retrieves eligible candidates from an in-memory index of active campaigns (targeting criteria -> campaign ids, refreshed from the campaign DB every few seconds), filters by caps, dismissals and budget state, scores with the click-prediction service (pCTR x bid = eCPM), runs a simple auction, and returns ad creatives plus signed tracking tokens. Creatives are pre-rendered into a client-agnostic schema (title, sender, body, form fields) so web, iOS and Android render natively; assets on a CDN. Cross-device: dismissals and impressions written to the user profile store (read-your-writes per user via a single home region or strongly consistent row); short client-side cache of dismissals as a fallback. Events: clients send impression/click/dismiss/form events with a unique event id and the signed token (prevents forged events, carries campaign/price); collected by an edge endpoint into Kafka; a stream processor deduplicates by event id, joins with serving logs, filters invalid traffic (rate per user/IP, bot signatures, click-without-impression), and writes per-campaign per-minute aggregates to an OLAP store for dashboards; a daily batch over the raw log produces the authoritative billing numbers (Lambda or Kappa architecture), with late events and invalid-click adjustments reconciled. Budget pacing: a central budget service tracks spend from the stream (seconds of lag) and hands each ad server a spend allowance or throttle probability; slight overspend is tolerated and not billed. Lead forms: submitted over a separate encrypted path, stored per advertiser with retention limits and user consent, never mixed into analytics logs. Privacy: no email content in targeting, user-level data access controls, data retention limits.

**Common pitfalls**

- Fetching ads serially before rendering the inbox, or with no timeout, so ad problems slow down email.
- Targeting on email content, or logging message data in ad events.
- Querying the campaign database on every ad request instead of using an in-memory index refreshed in the background.
- Counting events from client callbacks without event ids, signatures or deduplication, so retries and fraud inflate bills.
- Billing directly from the real-time dashboard counters without a reconciled batch or invalid-traffic filtering.
- Frequency caps and dismissals stored only on the client, so they don't carry across devices.
- Per-server budgets with no central pacing, causing large overspend when a campaign is popular.
- Treating lead-form submissions (personal data) like ordinary analytics events.

**Likely deep dives**

- The serving path: candidate retrieval from an in-memory index, scoring, auction and the 50 ms budget
- Frequency caps and dismissals consistent across devices
- Event collection: signed tokens, event ids, deduplication and invalid-traffic filtering
- Real-time reporting versus authoritative daily billing (stream plus batch reconciliation, late events)
- Budget pacing across many ad servers and regions

</details>

## Follow-up questions

Asked in writing after you submit.

- Walk through what happens from the moment a user opens the inbox on Android to the moment an ad row is visible. What runs in parallel with loading the mail, and what happens if the ad service is slow?
- A user dismisses an ad on their phone and opens the web inbox 5 seconds later. How does your design keep the ad from reappearing, and what consistency do you actually guarantee?
- An advertiser is billed per click and claims a third of their clicks came from bots. How does your pipeline detect invalid clicks, and how does that interact with numbers the advertiser has already seen in their dashboard?
- A campaign's daily budget is $5,000, but it's served from dozens of ad servers across three regions. How do you avoid overspending by a lot, or underdelivering, near the end of the day?
- A lead-generation form submission contains the user's name and email for the advertiser. How do you handle it differently from impression and click events, and what privacy constraints apply?

## Study resources

- [Hello Interview — Design an Ad Click Aggregator](https://www.hellointerview.com/learn/system-design/problem-breakdowns/ad-click-aggregator)
- [Apache Kafka — Documentation](https://kafka.apache.org/documentation/)
- [Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing)
- [Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)
- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)
- [The System Design Primer](https://github.com/donnemartin/system-design-primer)
- [ByteByteGo — System design](https://bytebytego.com/)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)

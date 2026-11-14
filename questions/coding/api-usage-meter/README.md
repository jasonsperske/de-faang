# API Usage Meter

**Type:** Coding · **Difficulty:** Medium · **Time:** 35 min · **Tags:** `design` `queue` `sliding-window` `hash-map` · **AI-assisted:** available

You run a public developer API. Every API key has a quota of **units** it may use within a sliding time window (a request can cost more than one unit, for example by the size of the text it sends). Implement the meter that decides whether a request is allowed.

Full prompt: [prompt.md](prompt.md).

## How it's graded

Rubric: [`coding`](../../../rubrics/README.md#coding) (Coding interview rubric). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.

| Dimension | Weight | Learn more |
|---|---|---|
| Problem understanding & approach | 25% | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)<br>[Tech Interview Handbook — Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/)<br>[NeetCode — Practice roadmap](https://neetcode.io/roadmap) |
| Algorithms & complexity | 20% | [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)<br>[NeetCode — Practice roadmap](https://neetcode.io/roadmap) |
| Coding & correctness | 25% | [Tech Interview Handbook — Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) |
| Testing & debugging | 15% | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |
| Communication | 15% | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |

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
| Verifying the AI's window and quota semantics *(question-specific)* | 13% | [Tech Interview Handbook — Queue cheatsheet](https://www.techinterviewhandbook.org/algorithms/queue/)<br>[Wikipedia — Token bucket](https://en.wikipedia.org/wiki/Token_bucket)<br>[Stripe — Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Hash map from API key to a FIFO queue of (timestamp, units) plus a running total per key. On each call for a key, pop from the front while the oldest entry's timestamp <= timestamp - windowSeconds, subtracting its units. consume compares total + units with quota; on success append and add. usage just expires and returns the total. Because timestamps never decrease, each event is pushed and popped at most once: amortized O(1) per call, O(events in window) space. Merging events with the same timestamp into one queue entry bounds memory at O(windowSeconds) per key. A circular buffer of per-second buckets is an equally good answer. Strong candidates mention approximate variants (sliding-window counter, token bucket) and the distributed version (Redis Lua script or INCR with expiry) unprompted.

**Common pitfalls**

- Recording a rejected request, so a client that's over quota stays blocked forever.
- Off-by-one at the window edge: counting a request from exactly windowSeconds ago, or dropping one from windowSeconds - 1 ago.
- Summing the whole history (or the whole queue) on every call: O(n) per call.
- A single global queue for all keys, which makes expiry and totals tangled and slow.
- Using the quota from the first call for the key instead of the one passed on each call.
- Comparing usage + units < quota instead of <=, which rejects a request that exactly reaches the quota.

</details>

## Follow-up questions

Asked in writing after you submit.

- What is the time and space complexity of each operation? What is the worst case for memory, and how would you bound it?
- Your meter keeps every request in the window. How would you approximate it with constant memory per key (fixed windows, sliding-window counters, or a token bucket), and what accuracy do you give up?
- The API runs on 50 servers behind a load balancer. How would you enforce one quota per key across all of them, and what happens when the shared store is slow or down?
- Product wants monthly billing based on these units. Why shouldn't the rate-limiting meter also be the billing record, and what would you build instead?
- How would you return useful rate-limit information to developers (headers, error bodies, retry hints) so their clients back off correctly?

## Study resources

- [Tech Interview Handbook — Queue cheatsheet](https://www.techinterviewhandbook.org/algorithms/queue/)
- [Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/)
- [Wikipedia — Token bucket](https://en.wikipedia.org/wiki/Token_bucket)
- [Stripe — Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)

# LRU Cache

**Type:** Coding · **Difficulty:** Medium · **Time:** 35 min · **Tags:** `design` `hash-map` `linked-list` · **AI-assisted:** available

Design a data structure that follows the constraints of a **Least Recently Used (LRU) cache**.

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
| Validating the AI's data-structure design *(question-specific)* | 13% | [Wikipedia — Cache replacement policies (LRU)](https://en.wikipedia.org/wiki/Cache_replacement_policies)<br>[Python docs — collections.OrderedDict](https://docs.python.org/3/library/collections.html#collections.OrderedDict)<br>[Tech Interview Handbook — Linked list cheatsheet](https://www.techinterviewhandbook.org/algorithms/linked-list/) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Hash map from key to node in a doubly linked list ordered by recency (head = most recent). get: look up, move to head. put: update/insert at head, evict tail when over capacity. Both O(1). Languages with insertion-ordered maps (Python OrderedDict/dict, JS Map) allow a compact solution: delete and reinsert to refresh recency, and evict the first key. Accept either, but in strict settings ask whether they could implement it without the built-in ordered map.

**Common pitfalls**

- Forgetting that get() also refreshes recency.
- Updating an existing key without refreshing its recency, or evicting when updating an existing key.
- Evicting the most recent instead of the least recent.
- O(n) list scans (e.g. list.remove) that break the O(1) requirement.

</details>

## Follow-up questions

Asked in writing after you submit.

- Walk me through why each operation is O(1). Which data structure provides which guarantee?
- How would you make this cache safe to use from multiple threads? What would the lock granularity be?
- How would you add per-entry TTL (time-based expiry) on top of LRU eviction?
- If this cache were distributed across several machines, how would you decide which node owns a key, and what happens when a node is added?

## Study resources

- [Wikipedia — Cache replacement policies (LRU)](https://en.wikipedia.org/wiki/Cache_replacement_policies)
- [Python docs — collections.OrderedDict](https://docs.python.org/3/library/collections.html#collections.OrderedDict)
- [Tech Interview Handbook — Linked list cheatsheet](https://www.techinterviewhandbook.org/algorithms/linked-list/)
- [Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/)
- [Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing)

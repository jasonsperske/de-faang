# Top K Frequent Elements

**Type:** Coding · **Difficulty:** Medium · **Time:** 30 min · **Tags:** `hash-map` `heap` `bucket-sort` · **AI-assisted:** available

Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. You may return the answer in **any order**.

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
| Questioning the AI's complexity claims *(question-specific)* | 13% | [Tech Interview Handbook — Heap cheatsheet](https://www.techinterviewhandbook.org/algorithms/heap/)<br>[Python docs — heapq](https://docs.python.org/3/library/heapq.html)<br>[Big-O Cheat Sheet](https://www.bigocheatsheet.com/) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Count with a hash map (O(n)). Then either sort by count O(u log u), keep a min-heap of size k O(u log k), or bucket sort by frequency O(n). Bucket sort is the optimal answer; a heap is a strong answer. Quickselect is O(u) average.

**Common pitfalls**

- Using a max-heap over all elements (O(u log u)) and claiming O(n log k).
- Returning counts instead of elements.
- Off-by-one in bucket sizes (frequency can equal n).

</details>

## Follow-up questions

Asked in writing after you submit.

- Compare the complexity of sorting all counts, using a size-k heap, and bucket sort. When would you choose each?
- How would you compute the top k over a stream of elements that never ends?
- How would you compute an approximate top k across logs spread over thousands of machines?
- How does your solution behave if k equals the number of distinct elements?

## Study resources

- [Tech Interview Handbook — Heap cheatsheet](https://www.techinterviewhandbook.org/algorithms/heap/)
- [Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/)
- [Python docs — heapq](https://docs.python.org/3/library/heapq.html)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)

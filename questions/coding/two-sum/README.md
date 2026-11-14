# Two Sum

**Type:** Coding · **Difficulty:** Easy · **Time:** 20 min · **Tags:** `arrays` `hash-map` · **AI-assisted:** available

Given an array of integers `nums` and an integer `target`, return the **indices** of the two numbers that add up to `target`.

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
| Scrutinising the AI's edge cases *(question-specific)* | 13% | [Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/)<br>[Tech Interview Handbook — Array cheatsheet](https://www.techinterviewhandbook.org/algorithms/array/) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Single pass with a hash map from value to index: for each x, check whether target - x was already seen. O(n) time, O(n) space. Brute force is O(n^2). The sorted variant can use two pointers in O(1) extra space.

**Common pitfalls**

- Using the same element twice (e.g. target 6 with a single 3).
- Inserting into the map before checking the complement, which breaks the duplicate-values case.
- Sorting the array and losing the original indices.

</details>

## Follow-up questions

Asked in writing after you submit.

- What are the time and space complexities of your solution? Could you trade space for time or vice versa?
- How would your approach change if the input array were already sorted?
- How would you return every distinct pair of values that sums to the target instead of just one pair?
- What if the array were too large to fit in memory on one machine?

## Study resources

- [Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/)
- [Tech Interview Handbook — Array cheatsheet](https://www.techinterviewhandbook.org/algorithms/array/)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)

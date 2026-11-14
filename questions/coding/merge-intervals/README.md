# Merge Intervals

**Type:** Coding · **Difficulty:** Medium · **Time:** 30 min · **Tags:** `arrays` `sorting` `intervals` · **AI-assisted:** available

Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals and return an array of the non-overlapping intervals that cover all the intervals in the input.

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
| Checking the AI's assumptions *(question-specific)* | 13% | [Tech Interview Handbook — Interval cheatsheet](https://www.techinterviewhandbook.org/algorithms/interval/)<br>[Tech Interview Handbook — Sorting and searching](https://www.techinterviewhandbook.org/algorithms/sorting-searching/) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Sort by start, then sweep: if the current interval's start <= last merged end, extend last end = max(last end, current end); otherwise append. O(n log n) time, O(n) output space.

**Common pitfalls**

- Setting end = current end instead of max(end, current end) (fails on containment like [1,10],[2,3]).
- Treating touching intervals [1,4],[4,5] as non-overlapping.
- Not sorting, or sorting by end instead of start.
- Mutating the input in a way that affects the result.

</details>

## Follow-up questions

Asked in writing after you submit.

- What is the time complexity, and which step dominates it?
- How would you handle intervals arriving one at a time as a stream, where you must keep the merged set up to date?
- How would you insert a single new interval into an already-merged, sorted list more efficiently than re-merging everything?
- Do touching intervals like [1,4] and [4,5] merge in your solution? Where in the code is that decided, and how would you make it configurable?

## Study resources

- [Tech Interview Handbook — Interval cheatsheet](https://www.techinterviewhandbook.org/algorithms/interval/)
- [Tech Interview Handbook — Sorting and searching](https://www.techinterviewhandbook.org/algorithms/sorting-searching/)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)

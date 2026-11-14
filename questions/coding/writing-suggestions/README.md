# Apply & Rebase Writing Suggestions

**Type:** Coding · **Difficulty:** Medium · **Time:** 45 min · **Tags:** `strings` `intervals` `simulation` `multipart` · **Parts:** 2 · **AI-assisted:** available

A writing assistant shows suggestions on a piece of text: fix a typo, replace a word, delete a repeated word, insert a missing one. This question has **two parts** about applying those suggestions and keeping them valid while the user types.

Full prompt: [prompt.md](prompt.md) (each part's prompt is in `parts/<part-id>/prompt.md`, revealed during the round).

## Parts

| # | Part | Time |
|---|---|---|
| 1 | Accept all suggestions | 25 min |
| 2 | Keep suggestions valid while the user types | 20 min |

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
| Scrutinising the AI's offset and boundary logic *(question-specific)* | 13% | [Tech Interview Handbook — Interval cheatsheet](https://www.techinterviewhandbook.org/algorithms/interval/)<br>[Tech Interview Handbook — String cheatsheet](https://www.techinterviewhandbook.org/algorithms/string/)<br>[Wikipedia — Operational transformation](https://en.wikipedia.org/wiki/Operational_transformation) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Two related problems from a writing assistant. Part 1 is interval conflict resolution plus a single-pass string rebuild; part 2 is offset transformation under sequential edits. Expect part 1 in about 25 minutes. Strong candidates state the half-open overlap rule precisely, handle zero-length ranges deliberately, and test boundaries. In part 2 look for clean case analysis and for noticing that edits are sequential. Candidates with editor or browser-extension experience should connect part 2 to operational transformation and to index-unit mismatches (UTF-16 vs code points).

### Part 1: Accept all suggestions

Two phases. (1) Conflict resolution in priority order: keep a list of accepted spans and accept a suggestion only if no accepted span overlaps it (start < e && s < end) or shares its start index. O(n^2) with a list, which is fine for n <= 1000; O(n log n) with a sorted structure (balanced tree or sorted list with bisect) that checks only the neighbours by start. (2) Sort the accepted suggestions by start and build the result in one left-to-right pass: copy text[pos:start], append the replacement, set pos = end; finally copy the tail. Building with a list/StringBuilder makes the pass O(len(text) + total replacement length). Applying replacements one at a time to a mutable string is a classic bug because later offsets shift; applying them right to left avoids the shift but still costs O(n * len) copies.

**Common pitfalls**

- Applying replacements one by one to the evolving string with the original offsets, so every later suggestion lands in the wrong place.
- Using a closed-interval overlap test (start <= e && s <= end), which wrongly rejects adjacent ranges like [0, 2) and [2, 4).
- Missing the insertion cases: two insertions at the same index, an insertion strictly inside a replacement, or an insertion at a replacement's start (all conflict), versus one at a replacement's end (fine).
- Resolving conflicts by position order instead of priority order, or letting a skipped suggestion block later ones.
- Repeated string concatenation in a loop, which is quadratic in some languages.

### Part 2: Keep suggestions valid while the user types

Simulate: for each edit compute delta = insertedLength - (editEnd - editStart); for each live span, keep it when end <= editStart, shift both ends by delta when start >= editEnd, otherwise mark it [-1, -1]. Check the conditions in that order so an insertion edit at a span's start shifts the span and one at its end keeps it. O(n * m), fine for the constraints. Faster: sort spans by start; each edit affects a contiguous run of spans (binary search), and the shift applies to a suffix, so a lazy offset (Fenwick tree or a running offset when edits arrive in increasing position) brings it to O((n + m) log n). This is the core of operational transformation: a client's suggestions are transformed against concurrent local edits instead of being recomputed.

**Common pitfalls**

- Applying all edits in original-text coordinates instead of sequentially.
- Shifting only the start (or only the end) of a span.
- Getting the boundary cases backwards: an insertion edit at a suggestion's start must shift it, at its end must keep it.
- Relying by accident on [-1, -1] ending before every edit to keep dropped spans in place. It works, but a candidate should skip dropped spans explicitly or be able to say why it's safe.
- Removing dropped suggestions from the output instead of returning [-1, -1] in place, which breaks the one-to-one order.

</details>

## Follow-up questions

Asked in writing after you submit.

- What are the time and space complexities of both parts? How would you make part 1's conflict check O(log n) per suggestion, and part 2 faster than O(spans × edits)?
- Real text is UTF-16 in browsers, UTF-8 on many servers and grapheme clusters on screen. What goes wrong when a suggestion server and a browser extension disagree on what an 'index' is, and how would you avoid it?
- Part 2 drops any suggestion that touches an edit. When could you keep it instead (for example, the user fixed the typo themselves, or typed inside a long sentence-level suggestion), and what would you need to know?
- Suggestions are computed on the server for version N of the document while the client is already at version N + 3. How would you use part 2 to reconcile them, and how does this relate to operational transformation or CRDTs?
- How would you test this so that a bug in offset handling can't ship to millions of users? What properties would you check with randomized tests?

## Study resources

- [Tech Interview Handbook — Interval cheatsheet](https://www.techinterviewhandbook.org/algorithms/interval/)
- [Tech Interview Handbook — String cheatsheet](https://www.techinterviewhandbook.org/algorithms/string/)
- [Tech Interview Handbook — Sorting and searching](https://www.techinterviewhandbook.org/algorithms/sorting-searching/)
- [Wikipedia — Operational transformation](https://en.wikipedia.org/wiki/Operational_transformation)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)

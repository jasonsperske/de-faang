# Anagram Pairs & Compound Words

**Type:** Coding · **Difficulty:** Medium · **Time:** 45 min · **Tags:** `strings` `hash-map` `dynamic-programming` `multipart` · **Parts:** 2 · **AI-assisted:** available

This question has **two parts**. Both take the same input: a list of words. Each word is a non-empty string of lowercase English letters, and the list may contain the same word more than once.

Full prompt: [prompt.md](prompt.md) (each part's prompt is in `parts/<part-id>/prompt.md`, revealed during the round).

## Parts

| # | Part | Time |
|---|---|---|
| 1 | Count anagram pairs | 15 min |
| 2 | Find compound words | 30 min |

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
| Judging AI output across both parts *(question-specific)* | 13% | [Tech Interview Handbook — String cheatsheet](https://www.techinterviewhandbook.org/algorithms/string/)<br>[Tech Interview Handbook — Dynamic programming cheatsheet](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/)<br>[Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Two independent string problems on the same kind of input. Part 1 is a warm-up (canonical keys + combinatorics); expect it done in about 15 minutes so there is real time for part 2, which is the harder word-break DP.

### Part 1: Count anagram pairs

Deduplicate the words, then group them by a canonical key: the sorted letters, or a 26-entry letter-count tuple. A group of k distinct words contributes k*(k-1)/2 pairs. O(n * L log L) with sorted keys, O(n * L) with count keys, O(n * L) space. Brute force compares every pair in O(n^2 * L). The count can exceed 32 bits (n up to 10^5), so it is returned as a 64-bit integer.

**Common pitfalls**

- Counting a repeated word as an anagram of its own copy, or counting the same pair twice through duplicates.
- Counting ordered pairs (a, b) and (b, a) separately.
- Comparing every pair of words: O(n^2) when grouping gives O(n).
- Summing pair counts in a 32-bit integer; C(k, 2) overflows once a group has more than about 65,000 words.
- Building the key from a set of letters, which loses counts ("aab" vs "abb").

### Part 2: Find compound words

Put every word in a hash set. For each distinct word, run word-break DP: can[i] is true when word[:i] splits into dictionary words; can[i] = OR over j < i of can[j] and word[j:i] in the set, excluding the piece that is the whole word so a word isn't a piece of itself. A word is compound when can[len] is true. O(n * L^2) substring checks (O(n * L^3) counting substring hashing), O(n + L) extra space. Memoised DFS is equivalent. Optimisations: process words by increasing length and only look up shorter words, cap j at the longest word length, or walk a trie instead of hashing substrings.

**Common pitfalls**

- Treating the word itself as one valid piece, so every word counts as compound.
- Greedy matching of the longest (or shortest) prefix, which fails on lists like [ab, abc, cd, abcd].
- Plain recursion without memoisation is exponential; a hidden test with words a, aa, ..., a*15 and a*40 + b times it out.
- Removing pieces after using them, although pieces can be reused.
- Returning a duplicated compound word twice.

</details>

## Follow-up questions

Asked in writing after you submit.

- What are the time and space complexities of each part? Which input sizes or word lengths dominate each one?
- For part 1, compare sorting each word's letters with counting them as the anagram key. When would each be faster, and how would your key change for Unicode text or case-insensitive matching?
- For part 2, how would a trie change the algorithm and its complexity compared with a hash set of words?
- How would you change part 2 to return, for each compound word, a split into the fewest possible pieces?
- If the word list were too large for one machine's memory, how would you compute part 1's count?

## Study resources

- [Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/)
- [Tech Interview Handbook — String cheatsheet](https://www.techinterviewhandbook.org/algorithms/string/)
- [Tech Interview Handbook — Dynamic programming cheatsheet](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/)
- [Tech Interview Handbook — Trie cheatsheet](https://www.techinterviewhandbook.org/algorithms/trie/)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)

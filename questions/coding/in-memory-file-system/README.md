# In-Memory File System

**Type:** Coding · **Difficulty:** Hard · **Time:** 50 min · **Tags:** `design` `trie` `hash-map` `pattern-matching` `multipart` · **Parts:** 3 · **AI-assisted:** available

Build a small in-memory file system that stores **blobs of data under file paths**. This question has **three parts**, and each part adds methods to the same `FileSystem` class.

Full prompt: [prompt.md](prompt.md) (each part's prompt is in `parts/<part-id>/prompt.md`, revealed during the round).

## Parts

| # | Part | Time |
|---|---|---|
| 1 | Store, read and remove blobs | 15 min |
| 2 | Wildcard find | 20 min |
| 3 | Directory stats | 15 min |

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
| Checking the AI's invariants, matcher and aggregates *(question-specific)* | 13% | [Tech Interview Handbook — Trie cheatsheet](https://www.techinterviewhandbook.org/algorithms/trie/)<br>[Wikipedia — glob (programming)](https://en.wikipedia.org/wiki/Glob_(programming))<br>[Tech Interview Handbook — Dynamic programming cheatsheet](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

A design-and-implementation question that grows in three steps on one class: path parsing and invariants (part 1), wildcard matching with ** (part 2), and maintaining aggregates for fast queries (part 3). The trie model pays off across all three. Expect part 1 in about 15 minutes. Strong candidates state the invariants (a path is a file or a directory, never both; directories exist only with files below them), choose a structure that makes those invariants cheap, and justify complexity when stats is called far more often than writes.

### Part 1: Store, read and remove blobs

Two reasonable models. (1) A trie of directory nodes: each node has a map of child names to nodes and either is a file (holds data) or a directory (has children). write walks or creates segments, failing if it meets a file before the last segment or if the final node is a directory with children; remove deletes the file node and prunes now-empty directory nodes on the way back up. (2) A flat hash map from path to data plus a map from directory path to the number of files below it, updated for every ancestor on write (new file only) and remove, deleting entries that reach zero. Both are O(depth) per operation (O(path length) counting string work). The trie generalises better to parts 2 and 3; the flat map is shorter. Parse paths once with split('/').

**Common pitfalls**

- Allowing a write onto a path that is currently a directory, or below a path that is a file.
- Prefix checks with startswith on raw strings, so /ab is treated as inside /a.
- Not pruning empty directories on remove, so a later write of a file at that path is wrongly rejected.
- Counting an overwrite as a new file (double-incrementing ancestor counts).
- Treating an empty blob as a missing file in their own logic.

### Part 2: Wildcard find

Match the pattern segment by segment. Within a segment, * and ? are classic wildcard matching (two-pointer greedy with backtrack to the last star, or DP over (pattern index, text index)); ** is the same idea one level up, matching zero or more whole segments. Two implementation choices: walk every file and test the full path (O(files x match cost)), or walk the trie alongside the pattern, descending only into children that match the current segment and branching on ** (either skip it or consume one child and stay on it); collect files and sort the result (or visit children in sorted order). Memoise (node, pattern index) when walking with ** to avoid exponential revisits. Converting to a regex is acceptable if the candidate escapes literals like '.' and maps * to [^/]*, but naive backtracking regexes can blow up on patterns with many stars; ask how they'd bound it.

**Common pitfalls**

- Letting * match across '/' so /*.js matches /src/app.js.
- Requiring ** to match at least one segment, missing /src/app.js for /src/**/app.js.
- Returning directories, or forgetting to sort.
- Building a regex without escaping '.', so /*.md also matches /xmd.
- Exponential backtracking: recursive matching without memoisation on patterns like *a*a*a*...*b.
- Trie walks that stop at a file node before trying ** as zero segments, so a trailing ** (as in /** or /src/**) misses files.

### Part 3: Directory stats

Simple version: find the directory, then traverse its subtree counting files, directories and bytes: O(subtree) per call. Expected improvement once the candidate notices stats is called far more often than writes: keep aggregates on every directory node (file count, directory count, byte total) and update them along the path on write (new file, or byte delta for an overwrite), on remove, and when directories are created or pruned (each ancestor's directory count changes by the number of directories added or removed). Then stats is O(depth) to locate the node and O(1) to answer, and writes stay O(depth). With the flat-map model, the per-directory counters from part 1 extend naturally to bytes and subdirectory counts. Return [-1, -1, -1] for files and missing paths; root is always a directory.

**Common pitfalls**

- Counting the directory itself in its own directory count.
- Overwrites adding the full new size instead of the difference.
- Forgetting to update directory counts on ancestors when a write creates several new directories or a remove prunes several.
- Returning stats for a file path, or [-1, -1, -1] for an empty root.
- String-prefix scans over all files on every call, which is O(files x path length) per stats.

</details>

## Follow-up questions

Asked in writing after you submit.

- What are the time and space complexities of write, remove, find and stats in your final design? Which operation would you optimise next and how?
- How would you add move/rename of a whole directory, and what happens to your aggregates and to any paths cached elsewhere?
- Your find walks the whole tree for '/**/x'. How would you index files to answer common patterns faster, and what does that cost on writes?
- If several threads call write, remove and stats concurrently, what can go wrong with your aggregates, and how would you make it safe without one global lock?
- Blobs are now large (hundreds of MB) and must survive restarts. How would you change the design: where do the bytes live, and what stays in memory?

## Study resources

- [Tech Interview Handbook — Trie cheatsheet](https://www.techinterviewhandbook.org/algorithms/trie/)
- [Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/)
- [Wikipedia — glob (programming)](https://en.wikipedia.org/wiki/Glob_(programming))
- [Tech Interview Handbook — Dynamic programming cheatsheet](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)

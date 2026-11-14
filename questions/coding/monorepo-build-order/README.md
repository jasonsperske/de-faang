# Monorepo Build Order & Affected Packages

**Type:** Coding · **Difficulty:** Medium · **Time:** 45 min · **Tags:** `graphs` `topological-sort` `heap` `multipart` · **Parts:** 2 · **AI-assisted:** available

You maintain the build tooling for a frontend monorepo: a few apps and dozens of shared libraries, all in one repository. This question has **two parts**. Both take the same input:

Full prompt: [prompt.md](prompt.md) (each part's prompt is in `parts/<part-id>/prompt.md`, revealed during the round).

## Parts

| # | Part | Time |
|---|---|---|
| 1 | Deterministic build order | 25 min |
| 2 | Affected packages for a pull request | 20 min |

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
| Checking the AI's edge direction, tie-breaking and cycle handling *(question-specific)* | 13% | [Tech Interview Handbook — Graph cheatsheet](https://www.techinterviewhandbook.org/algorithms/graph/)<br>[Wikipedia — Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting)<br>[Tech Interview Handbook — Heap cheatsheet](https://www.techinterviewhandbook.org/algorithms/heap/) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

A graph problem framed around monorepo tooling (Nx, Turborepo, Bazel). Part 1 is topological sort with deterministic tie-breaking and cycle detection; part 2 is reverse reachability filtered through part 1's order. Expect part 1 in about 25 minutes. Candidates who have run a monorepo should naturally discuss affected-graph computation, caching, and what counts as a change in the follow-ups; probe for that depth.

### Part 1: Deterministic build order

Kahn's algorithm with a min-heap. Build adjacency from dependency to dependents (edge b -> a for [a, b]), deduplicating repeated pairs (or counting them consistently in both the in-degree and the decrement). Push every package with in-degree 0 into a min-heap; repeatedly pop the smallest, append it, and decrement its dependents, pushing any that reach 0. If the output is shorter than the package count there is a cycle: return []. O((V + E) log V) time, O(V + E) space. DFS post-order also finds a valid order and detects cycles (three colours), but doesn't give the lexicographic tie-breaking without extra work, so expect the heap version once the candidate reads the determinism requirement.

**Common pitfalls**

- Reversing the edge direction, which produces dependents before their dependencies.
- Sorting the initially ready packages once and then using a plain queue, so later ties aren't broken alphabetically.
- Counting a duplicated pair twice in the in-degree but decrementing once (or vice versa), so a package never becomes ready.
- Missing cycle detection, or detecting only self-loops, or returning a partial order when a cycle exists.
- Repeatedly scanning all packages for a ready one: O(V^2), which is slow at 10^4 packages.
- Recursive DFS that overflows the stack on a 1,000-package chain in some languages.

### Part 2: Affected packages for a pull request

Run part 1 to get the order (and detect cycles). Start a BFS or iterative DFS from the known changed packages over the dependency -> dependents edges, marking every reachable package. Return the part 1 order filtered to the marked set. O((V + E) log V) for the order plus O(V + E) for the traversal. An alternative is one pass over the topological order propagating an 'affected' flag from dependencies, which is elegant but only works because the order is topological.

**Common pitfalls**

- Walking the edges the wrong way, returning the changed package's dependencies instead of its dependents.
- Returning affected packages in discovery (BFS) order instead of build order.
- Not ignoring unknown changed names, which crashes on a lookup or adds a phantom package.
- Visiting a diamond's top twice and listing it twice.
- Recomputing reachability from scratch for every changed package: O(changed × (V + E)).

</details>

## Follow-up questions

Asked in writing after you submit.

- What are the time and space complexities of each part? What changes if there are 10^6 packages and the graph doesn't fit in memory on the CI runner?
- Your build order is serial. How would you schedule the builds on 8 parallel workers to minimise total build time if you knew each package's build duration?
- When the graph has a cycle, returning an empty list isn't helpful to the developer. How would you report the cycle (or all of them) in a useful way?
- How do you decide which packages a PR 'changed' in the first place? What about changes to a root config file, a lockfile, or a test fixture shared across packages?
- The affected set for a change to a core library is almost the whole repo. How would remote caching, test sharding or a merge queue keep CI fast anyway?

## Study resources

- [Tech Interview Handbook — Graph cheatsheet](https://www.techinterviewhandbook.org/algorithms/graph/)
- [Wikipedia — Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting)
- [Tech Interview Handbook — Heap cheatsheet](https://www.techinterviewhandbook.org/algorithms/heap/)
- [Python docs — heapq](https://docs.python.org/3/library/heapq.html)
- [Bazel — Remote caching](https://bazel.build/remote/caching)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)

# Multiply Without the Multiplication Operator

**Type:** Coding · **Difficulty:** Medium · **Time:** 25 min · **Tags:** `bit-manipulation` `math` `recursion` · **AI-assisted:** available

Given two integers `a` and `b`, return their product `a × b`.

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
| Holding the AI to the constraints and checking signs *(question-specific)* | 13% | [Tech Interview Handbook — Binary cheatsheet](https://www.techinterviewhandbook.org/algorithms/binary/)<br>[Wikipedia — Ancient Egyptian (Russian peasant) multiplication](https://en.wikipedia.org/wiki/Ancient_Egyptian_multiplication) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Shift-and-add (Russian peasant / binary long multiplication). Record the sign as (a < 0) XOR (b < 0) and work on magnitudes. Then, while b > 0: if the lowest bit of b is set, add a to the result; shift a left by one and b right by one. O(log min(|a|, |b|)) iterations if the loop runs over the smaller operand's bits, O(1) space. Equivalent: recursion multiply(a, b) = multiply(a, b >> 1) << 1, plus a when b is odd, giving O(log b) depth; or summing a << i for each set bit i of b. Repeated addition (adding a to itself |b| times) is the brute force: correct but O(|b|), which is up to 6.7 x 10^7 additions here and too slow in Python on the hidden tests; ask for something better if the candidate stops there. Strong candidates handle zero and sign up front, choose the smaller operand to drive the loop, avoid shifting negative numbers, use a 64-bit accumulator, and can extend the idea to division by repeated doubling and subtraction.

**Common pitfalls**

- Repeated addition, which is O(|b|) and times out on large operands.
- Shifting a negative b right until it reaches zero: in Python, Java (>>) and C, -1 >> 1 stays -1, so the loop never ends.
- Getting the sign wrong when exactly one operand is negative, or when both are.
- Accumulating in a 32-bit integer in Java, C, C++ or Go, so products above 2^31 overflow.
- Using a disguised multiplication: Math.imul, **, pow, or repeated doubling with *.
- Forgetting the zero cases, or looping over the larger operand when the smaller one would take fewer steps.

</details>

## Follow-up questions

Asked in writing after you submit.

- What is the time complexity of your solution in terms of the operands' values and their bit lengths? Why does looping over the smaller operand matter?
- Walk through how your code handles negative numbers. What would go wrong if you shifted a negative number right until it reached zero in Python, Java or C?
- How would you implement integer division (truncating toward zero) with the same restrictions? What changes about overflow at the edges of a 32-bit range?
- Real CPUs multiply in a few cycles. How does hardware do it, and where do shift-and-add ideas still show up (big-number libraries, Karatsuba, multiplying by constants in compilers)?
- How would you test this exhaustively enough to be confident, given that you can't compare against the * operator in production code?

## Study resources

- [Tech Interview Handbook — Binary cheatsheet](https://www.techinterviewhandbook.org/algorithms/binary/)
- [Wikipedia — Ancient Egyptian (Russian peasant) multiplication](https://en.wikipedia.org/wiki/Ancient_Egyptian_multiplication)
- [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)
- [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)

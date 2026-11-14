# Rules Expression Evaluator

**Type:** Coding · **Difficulty:** Hard · **Time:** 45 min · **Tags:** `parsing` `stack` `recursion` `strings` · **AI-assisted:** available

An insurance underwriting platform lets analysts write pricing rules as arithmetic expressions over named inputs, for example `base_rate * (100 + risk_pct) / 100 - discount`. Write the function that evaluates one rule.

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
| Checking the AI's grammar and arithmetic semantics *(question-specific)* | 13% | [Wikipedia — Recursive descent parser](https://en.wikipedia.org/wiki/Recursive_descent_parser)<br>[Wikipedia — Shunting yard algorithm](https://en.wikipedia.org/wiki/Shunting_yard_algorithm)<br>[Tech Interview Handbook — Stack cheatsheet](https://www.techinterviewhandbook.org/algorithms/stack/) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Two standard approaches. (1) Recursive descent with one function per precedence level: expr := term (('+'|'-') term)*, term := unary (('*'|'/') unary)*, unary := '-' unary | primary, primary := number | identifier | '(' expr ')'. Tokenize first (numbers, identifiers, single-character operators) or scan on the fly. (2) Shunting-yard / two stacks (values and operators), treating unary minus as a separate high-precedence right-associative operator, detected when '-' appears at the start, after another operator, or after '('. Both are O(n) time and O(n) space (recursion depth or stack size bounded by nesting). Truncating division needs care in Python (int(a / b) has float issues for large values; use abs and sign, or math.trunc on exact integers) and is native in Java, C, C++, Go, Rust and JS with Math.trunc. Strong candidates design the grammar before coding and test unary minus, associativity, and variable names that share prefixes.

**Common pitfalls**

- Right-associative evaluation (recursing on the right operand), so 10 - 4 - 3 gives 9 and 100 / 10 / 5 gives 50.
- Floor division instead of truncation: Python's // and >> give -4 for -7 / 2.
- Treating every '-' as binary, which fails on '-3', '2 * -x' and '--5'.
- Reading variable names one character at a time, or substituting values with string replace so 'lim' corrupts 'limit'.
- Single-stack evaluators that apply operators in the wrong order once precedence and parentheses mix.
- Calling eval or a library, which the prompt rules out.

</details>

## Follow-up questions

Asked in writing after you submit.

- What is the time and space complexity of your evaluator, and where does the space go for deeply nested parentheses?
- Analysts evaluate the same rule millions of times with different inputs. How would you avoid re-parsing it each time? Describe the representation you'd compile it to.
- How would you add comparison operators, `and`/`or`, and a ternary `cond ? a : b` without rewriting everything? Where do they go in the precedence levels?
- Rules are written by non-engineers. How would you report a syntax error or an unknown variable with a useful message and position?
- Rules can be changed by analysts at any time and affect real prices. How would you version, test, and roll out rule changes safely?

## Study resources

- [Wikipedia — Recursive descent parser](https://en.wikipedia.org/wiki/Recursive_descent_parser)
- [Wikipedia — Shunting yard algorithm](https://en.wikipedia.org/wiki/Shunting_yard_algorithm)
- [Tech Interview Handbook — Stack cheatsheet](https://www.techinterviewhandbook.org/algorithms/stack/)
- [Tech Interview Handbook — String cheatsheet](https://www.techinterviewhandbook.org/algorithms/string/)
- [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)

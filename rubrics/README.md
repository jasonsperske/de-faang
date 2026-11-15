# Rubrics

Every round is graded against one of these rubrics. Each rubric is a set of weighted dimensions; the evaluator scores each dimension 1–4, quotes evidence from your session for every score, and the server (not the LLM) computes the weighted average and the hire signal.

## Score scale

| Score | Meaning |
|---|---|
| 1 | Strong concern: significant gaps; would not pass this dimension at the target level. |
| 2 | Below bar: partially demonstrated, needed substantial help, or had notable errors. |
| 3 | At bar: solid, with minor gaps; meets FAANG mid/senior expectations. |
| 4 | Above bar: exceptional, independent, insightful, and polished. |

## Hire signal

The weighted score (dimension weights normalised to sum to 1) maps to a decision in `server/evaluator.ts`:

| Weighted score | Decision |
|---|---|
| ≥ 3.5 | Strong Hire |
| ≥ 3.0 | Hire |
| ≥ 2.5 | Lean Hire |
| ≥ 2.0 | Lean No Hire |
| < 2.0 | No Hire |

AI-assisted rounds add each question's own `ai.dimensions` to the AI rubric, and the weights are normalised together. Rubric resource links can only point at ids in [`resources/resources.json`](../resources/resources.json), so the report can't invent links.

## Background reading

These rubrics follow the shape of the structured interview scorecards used at large tech companies: a few independent competencies, each with behavioural level descriptors, rolled up into a hire signal.

- [Tech Interview Handbook — Coding interview rubrics](https://www.techinterviewhandbook.org/coding-interview-rubrics/): how FAANG interviewers score communication, problem solving, coding, and testing.
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction): what system design interviewers expect at each level.
- [The System Design Primer](https://github.com/donnemartin/system-design-primer): the system design topics behind the design dimensions.

## coding

**Coding interview rubric** · [`coding.json`](coding.json)

| Dimension | Weight | What the evaluator looks for | Learn more |
|---|---|---|---|
| Problem understanding & approach | 25% | Asked clarifying questions about inputs, constraints, and edge cases before coding; stated a brute-force baseline; reasoned toward a better approach; compared alternatives; made deliberate decisions instead of guessing. | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)<br>[Tech Interview Handbook — Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/)<br>[NeetCode — Practice roadmap](https://neetcode.io/roadmap) |
| Algorithms & complexity | 20% | Chose appropriate data structures; reached the optimal or near-optimal complexity; stated time and space complexity correctly and justified it. | [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)<br>[NeetCode — Practice roadmap](https://neetcode.io/roadmap) |
| Coding & correctness | 25% | Code compiles or runs and passes the hidden tests; readable naming and structure; idiomatic use of the language; no needless complexity; handles edge cases in code. | [Tech Interview Handbook — Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) |
| Testing & debugging | 15% | Traced through examples by hand or ran tests deliberately; considered edge cases (empty input, duplicates, negatives, bounds); debugged failures methodically instead of guessing. | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |
| Communication | 15% | Thought out loud; explained the plan before coding; responded well to hints and questions; was concise and structured; follow-up answers were clear and correct. | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |

<details>
<summary>Level descriptors</summary>

**Problem understanding & approach**

- **1:** Started coding without understanding the problem; could not produce a working approach even with hints.
- **2:** Reached an approach only with significant hints; little exploration of alternatives.
- **3:** Clarified the problem, found an efficient approach with at most light nudges, and explained why it works.
- **4:** Quickly identified the core insight, compared multiple approaches with tradeoffs, and anticipated follow-ups.

**Algorithms & complexity**

- **1:** Inefficient solution with incorrect or missing complexity analysis.
- **2:** Working but sub-optimal solution, or optimal but with shaky or incorrect analysis.
- **3:** Optimal or near-optimal solution with a correct complexity analysis.
- **4:** Optimal solution, precise analysis including tradeoffs and lower bounds, and awareness of constant factors.

**Coding & correctness**

- **1:** Code does not run or fails most tests; hard to follow.
- **2:** Partially correct; noticeable bugs, awkward structure, or non-idiomatic code.
- **3:** Correct on nearly all tests; clean and readable with minor issues.
- **4:** Fully correct, clean, idiomatic, and production-quality on the first or second try.

**Testing & debugging**

- **1:** No testing; submitted without verification; random changes when tests failed.
- **2:** Ran the provided samples only; limited edge-case thinking.
- **3:** Tested meaningful edge cases and debugged failures methodically.
- **4:** Proactively designed tests that target risky logic, and caught their own bugs before running.

**Communication**

- **1:** Silent or confusing; ignored interviewer input.
- **2:** Some explanation, but disorganized or reactive; follow-up answers weak.
- **3:** Clear explanations, collaborative, and solid follow-up answers.
- **4:** Exceptionally clear and structured; led the conversation; follow-up answers were insightful.

</details>

## ai-coding

**AI-assisted coding interview rubric** · [`ai-coding.json`](ai-coding.json)

| Dimension | Weight | What the evaluator looks for | Learn more |
|---|---|---|---|
| Problem understanding & framing | 15% | Understood the problem themselves before delegating: clarified inputs, constraints and edge cases with the interviewer; chose (or at least evaluated) the approach rather than adopting whatever the AI proposed; broke the work into pieces suited to delegation. | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/)<br>[Tech Interview Handbook — Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) |
| Directing the AI | 20% | Prompts were specific and gave the needed context (constraints, signature, edge cases, the code in question); asked for what they actually needed; iterated when the answer was off; used the AI for the right tasks (boilerplate, recall, review, test ideas) rather than for thinking they should do themselves; respected the time box. | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |
| Verifying AI output | 25% | Read AI-written code before adopting it; ran tests and added custom inputs that target risky logic; caught AI mistakes (wrong edge cases, wrong complexity, invented APIs, misread requirements); asked follow-up questions when something looked off; never assumed AI output was correct. | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |
| Understanding & ownership | 15% | Could explain every part of the final code, including AI-written parts, and its complexity; adapted AI code deliberately to the problem and their style; answered the interviewer's and the written follow-up questions without leaning on the AI. | [Big-O Cheat Sheet](https://www.bigocheatsheet.com/)<br>[NeetCode — Practice roadmap](https://neetcode.io/roadmap) |
| Final correctness & code quality | 15% | The final code passes the hidden tests, handles edge cases, has the expected complexity, and is clean and readable, regardless of who wrote which line. | [Tech Interview Handbook — Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) |
| Communication | 10% | Kept the interviewer informed about what they were asking the AI and why, and what they concluded from its answers; explained decisions; follow-up answers were clear. | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |

<details>
<summary>Level descriptors</summary>

**Problem understanding & framing**

- **1:** Pasted the problem into the AI and adopted its answer without engaging with the problem.
- **2:** Some understanding, but the AI framed the problem and picked the approach without scrutiny.
- **3:** Clarified the problem, picked or validated a sound approach, and delegated well-scoped pieces.
- **4:** Framed the problem crisply, compared approaches, and steered the AI toward the best one from the start.

**Directing the AI**

- **1:** Vague or copy-paste prompts; repeated the same request; got little useful from the AI or lost a lot of time to it.
- **2:** Usable prompts that often lacked context, needing several round trips; unclear what they wanted from the AI.
- **3:** Clear, context-rich prompts; targeted asks; corrected course efficiently when an answer missed.
- **4:** Precise, well-sequenced prompts that got high-value help on the first try, including asking the AI to critique or test its own output.

**Verifying AI output**

- **1:** Accepted AI output blindly; submitted AI code without running or reading it, or missed obvious AI errors.
- **2:** Ran the sample tests but did little else to check AI output; some AI mistakes slipped through.
- **3:** Reviewed and tested AI output deliberately and caught the mistakes that mattered.
- **4:** Systematically verified every adopted piece with targeted tests and reasoning, and caught subtle AI errors.

**Understanding & ownership**

- **1:** Couldn't explain the code they submitted or its complexity.
- **2:** Explained the gist but was shaky on the details or the complexity of the AI-written parts.
- **3:** Explained the full solution and its complexity confidently, and adapted AI code where needed.
- **4:** Deep command of the solution: improved on the AI's code, and reasoned about alternatives and limits.

**Final correctness & code quality**

- **1:** Fails most tests or doesn't run.
- **2:** Partially correct, or correct but inefficient or messy.
- **3:** Correct on nearly all tests with the expected complexity; clean code.
- **4:** Fully correct, optimal, and production quality.

**Communication**

- **1:** Worked silently with the AI; the interviewer couldn't follow what was happening.
- **2:** Occasional narration; decisions about AI output were mostly unexplained.
- **3:** Narrated the plan and the AI's role clearly, and explained what they accepted or rejected.
- **4:** Exceptionally clear: treated the interviewer as a collaborator, and the reasoning behind every AI decision was visible.

</details>

## debugging

**Debugging interview rubric** · [`debugging.json`](debugging.json)

| Dimension | Weight | What the evaluator looks for | Learn more |
|---|---|---|---|
| Reproducing & scoping the bug | 15% | Read the bug report closely; reproduced the symptom in the running app before changing code; turned the report into concrete expected vs. actual values (e.g. 'Acme should show 3 orders and $599.85'); checked whether the bug affects one row or many, and which columns. | [David Agans — Debugging: the 9 indispensable rules](https://debuggingrules.com/)<br>[Julia Evans — A debugging manifesto](https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/) |
| Investigation & navigating unfamiliar code | 20% | Worked out how the app fits together without a diagram: traced the data from the table component through the API call and route to the query; used the browser, the terminal and the database (queries, logs, API responses) to look at real data at each layer; narrowed down the faulty layer with evidence instead of reading every file or guessing. | [Julia Evans — A debugging manifesto](https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/)<br>[React — React Developer Tools](https://react.dev/learn/react-developer-tools)<br>[SQLite — SELECT (joins, GROUP BY, ORDER BY, common table expressions)](https://www.sqlite.org/lang_select.html) |
| Root-cause analysis | 25% | Formed explicit hypotheses and tested them; explained the mechanism of each defect (why the counts multiply, why the cents disappear, why some values are empty), not just where it is; found every independent cause behind the symptoms; distinguished causes from symptoms. | [SQLite — Built-in aggregate functions (SUM, COUNT, TOTAL and NULLs)](https://www.sqlite.org/lang_aggfunc.html)<br>[SQLite — SQL expressions (operators, integer division, NULL)](https://www.sqlite.org/lang_expr.html)<br>[SQLite — SELECT (joins, GROUP BY, ORDER BY, common table expressions)](https://www.sqlite.org/lang_select.html) |
| Fix correctness & quality | 20% | The fix addresses the cause in the right layer, keeps the API's contract, handles edge cases (customers without orders or refunds, voided orders, duplicate amounts), and keeps sorting and search working. Hidden checks are ground truth. The change is minimal, readable, and explained. | [SQLite — Built-in aggregate functions (SUM, COUNT, TOTAL and NULLs)](https://www.sqlite.org/lang_aggfunc.html)<br>[SQLite — SELECT (joins, GROUP BY, ORDER BY, common table expressions)](https://www.sqlite.org/lang_select.html) |
| Verification & testing | 10% | Confirmed the fix against the values in the bug report and against independent data (e.g. a direct query of the base tables); checked edge cases and that nothing else regressed (other columns, sorting, search); suggested a test that would have caught the bug. | [David Agans — Debugging: the 9 indispensable rules](https://debuggingrules.com/) |
| Communication | 10% | Narrated hypotheses and what each step was meant to show; kept the interviewer oriented while exploring; explained the root cause and the fix clearly, as they would to the person who filed the bug. | [Tech Interview Handbook — Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) |

<details>
<summary>Level descriptors</summary>

**Reproducing & scoping the bug**

- **1:** Started editing code without reproducing the bug or stating what correct looks like.
- **2:** Reproduced the symptom only partially, or never pinned down the expected values.
- **3:** Reproduced the bug, stated expected vs. actual, and scoped which rows and columns are wrong.
- **4:** Quickly built a precise picture of the failure (all the symptoms, which data triggers them) that guided the rest of the round.

**Investigation & navigating unfamiliar code**

- **1:** Wandered through files or changed code at random; never located where the wrong values come from.
- **2:** Found the right area only with significant hints, or by reading code without checking data.
- **3:** Traced the data path layer by layer and used real data (API responses, SQL queries) to find the faulty layer.
- **4:** Bisected the system efficiently (e.g. compared the API response with a direct query of the base tables) and explained the architecture they had discovered.

**Root-cause analysis**

- **1:** Did not find the cause, or 'fixed' a symptom (UI formatting, a special case) without understanding why it happened.
- **2:** Found one cause but missed others, or couldn't explain the mechanism.
- **3:** Found every cause and explained each mechanism correctly.
- **4:** Explained each mechanism precisely with evidence, and generalised it (where else the same mistake could hide, how to spot it in review).

**Fix correctness & quality**

- **1:** No working fix, or a fix that breaks other behaviour.
- **2:** Fixes the reported rows but fails edge cases or changes the API's contract.
- **3:** A correct, minimal fix in the right layer that passes the hidden checks.
- **4:** A clean, well-explained fix that is robust to edge cases, plus sensible notes on follow-up hardening.

**Verification & testing**

- **1:** Declared victory without checking.
- **2:** Checked only the one row from the bug report.
- **3:** Verified the reported values, a couple of edge cases, and the rest of the table.
- **4:** Verified systematically, and proposed a regression test or monitoring that would catch this class of bug.

**Communication**

- **1:** Silent or incoherent; the interviewer could not follow the investigation.
- **2:** Explained some steps, but often went quiet or was hard to follow.
- **3:** Clear narration of hypotheses, findings and the fix.
- **4:** Exceptionally clear: structured, concise, and pitched for both engineers and the bug reporter.

</details>

## system-design

**System design interview rubric** · [`system-design.json`](system-design.json)

| Dimension | Weight | What the evaluator looks for | Learn more |
|---|---|---|---|
| Requirements & scoping | 20% | Clarified functional and non-functional requirements; asked for scale; did back-of-the-envelope estimates (QPS, storage, bandwidth); scoped the problem to what matters. | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)<br>[Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |
| High-level design | 25% | Coherent architecture with clear components and data flow; APIs defined; data model defined; diagram communicates the design. | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Deep dive & technical depth | 25% | Went deep on the hardest components (e.g. ID generation, consistency, caching, partitioning); showed real knowledge of the technologies chosen; handled the follow-up probes. | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) |
| Scalability, reliability & tradeoffs | 20% | Identified bottlenecks and single points of failure; discussed scaling (sharding, replication, caching, queues); explicit tradeoffs (consistency vs availability, latency vs accuracy, cost); failure modes and monitoring. | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[Google SRE Book](https://sre.google/sre-book/table-of-contents/)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Communication & leadership | 10% | Drove the conversation with structure; checked in with the interviewer; responded to pushback; follow-up answers were clear. | [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |

<details>
<summary>Level descriptors</summary>

**Requirements & scoping**

- **1:** No clarification; designed for an unstated problem.
- **2:** Some requirements gathered but missed key non-functional needs or never estimated.
- **3:** Clear functional and non-functional requirements with reasonable estimates that informed the design.
- **4:** Crisp scoping, prioritized requirements, and estimates that directly drove decisions.

**High-level design**

- **1:** Missing or incoherent architecture.
- **2:** Plausible components but unclear data flow, APIs, or data model.
- **3:** Complete and coherent design with APIs, data model, and a clear diagram.
- **4:** Elegant, well-justified design; every component has a clear reason to exist.

**Deep dive & technical depth**

- **1:** Stayed superficial; buzzwords without substance.
- **2:** Some depth, but with technical errors or gaps when probed.
- **3:** Solid depth on key components with correct technical reasoning.
- **4:** Expert depth; anticipated subtle issues and proposed robust solutions.

**Scalability, reliability & tradeoffs**

- **1:** No discussion of scale or failure.
- **2:** Generic scaling remarks not tied to this system's bottlenecks.
- **3:** Found the real bottlenecks and made reasoned tradeoffs.
- **4:** Thorough treatment of failure modes, tradeoffs, and operational concerns, with sound judgment.

**Communication & leadership**

- **1:** Disorganized; the interviewer had to drive.
- **2:** Somewhat structured, but reactive.
- **3:** Structured, collaborative, and responsive.
- **4:** Led confidently with excellent structure and time management.

</details>

## Adding a rubric

Add `rubrics/<id>.json` with `id`, `name`, `scale` and `dimensions` (each with `id`, `name`, `weight`, `signals`, `levels` 1–4, and `resources`), then reference it from a question's `rubric` or `ai.rubric`. `npm run validate` checks the ids.

# de-faang

[![CI](https://github.com/jasonsperske/de-faang/actions/workflows/ci.yml/badge.svg)](https://github.com/jasonsperske/de-faang/actions/workflows/ci.yml)

Take the fear out of FAANG interviews. **de-faang** runs realistic coding and system design rounds on your own machine, with an LLM interviewer (Claude, Codex, Gemini, or Meta's Muse) that talks with you in real time, and a rubric-based evaluation afterward that links to resources for what to study next.

**Contents:** [Features](#features) · [Questions](#questions) · [Rubrics](#rubrics) · [Quick start](#quick-start) · [How a round works](#how-a-round-works) · [Debrief and lessons](#debrief-and-lessons) · [Adding questions](#adding-questions) · [AI-assisted rounds](#ai-assisted-rounds) · [Multipart questions](#multipart-questions) · [Architecture](#architecture) · [Tests](#tests) · [Contributing](#contributing) · [License](#license)

## Features

### The interview room

- **HackerRank-style coding pad.** Monaco editor; Python, JavaScript, TypeScript, Java, C++, C, Go, or Rust; sample tests, your own custom inputs, and hidden tests on submit. Code runs in a network-less Docker sandbox.
- **System design whiteboard.** Excalidraw canvas plus a markdown notes pad. The interviewer "sees" your diagram as a text summary on every turn, and the evaluator gets the PNG.
- **Live interviewer chat.** Think out loud; every message carries a snapshot of your code (or notes and diagram) and recent test runs, so the interviewer reacts to what you're actually doing.

### A configurable interviewer

- **Strict:** the prompt only. No sample tests, no hints, neutral tone. Hidden test details stay hidden until the evaluation.
- **Standard:** sample tests visible, expected output for your custom inputs, and hints only when you ask.
- **Coach:** proactive hints, reactions to every test run, and coaching on interview technique.
- **Verbosity:** terse, normal, or detailed (for both the chat and the report).
- **Your choice of model:** Claude, Codex, Gemini, or Muse, or an offline mock for trying the UI.

### Round formats

- **Multipart questions.** Later parts are revealed only when you hand in the current one, like a real round where the interviewer says "now let's extend this". Your code carries over between parts.
- **AI-assisted rounds.** An AI assistant in the console analyses, explains, reviews or writes code, with a configurable helpfulness level. Every prompt, what you attached, the replies, and what you inserted, copied or pasted is recorded and graded with an AI-specific rubric.
- **Follow-up questions** after you submit, answered in writing.

### Feedback

- **Evaluation packet → rubric scorecard.** Per-dimension 1–4 scores with quoted evidence, a hire/no-hire signal, strengths, improvements, a model answer sketch, and curated resource links.
- **Debrief & lessons.** After the evaluation, talk the round over with a coach that has seen everything, then turn it into a personalised lesson with practice exercises.
- **No hallucinated links.** Study links come only from a curated [resource library](resources/resources.json).

Every round lives in its own folder under `sessions/`, which git ignores, so your repo stays clean.

## Questions

Each question links to its README, which covers the prompt, how the round is graded (rubric dimensions, weights, and study links for each), the reference approach and common pitfalls (hidden behind a spoiler), the written follow-ups, and further reading.

<!-- questions:start -->
| Question | Type | Difficulty | Time | Topics | Rubric | Notes |
|---|---|---|---|---|---|---|
| [Two Sum](questions/coding/two-sum/README.md) | Coding | Easy | 20 min | `arrays` `hash-map` | [coding](rubrics/README.md#coding) + [ai-coding](rubrics/README.md#ai-coding) | AI-assisted option |
| [Merge Intervals](questions/coding/merge-intervals/README.md) | Coding | Medium | 30 min | `arrays` `sorting` `intervals` | [coding](rubrics/README.md#coding) + [ai-coding](rubrics/README.md#ai-coding) | AI-assisted option |
| [Top K Frequent Elements](questions/coding/top-k-frequent/README.md) | Coding | Medium | 30 min | `hash-map` `heap` `bucket-sort` | [coding](rubrics/README.md#coding) + [ai-coding](rubrics/README.md#ai-coding) | AI-assisted option |
| [LRU Cache](questions/coding/lru-cache/README.md) | Coding | Medium | 35 min | `design` `hash-map` `linked-list` | [coding](rubrics/README.md#coding) + [ai-coding](rubrics/README.md#ai-coding) | AI-assisted option |
| [Anagram Pairs & Compound Words](questions/coding/anagram-pairs-and-compound-words/README.md) | Coding | Medium | 45 min | `strings` `hash-map` `dynamic-programming` | [coding](rubrics/README.md#coding) + [ai-coding](rubrics/README.md#ai-coding) | 2-part, AI-assisted option |
| [Design a Distributed Rate Limiter](questions/system-design/rate-limiter/README.md) | System design | Medium | 45 min | `distributed-systems` `algorithms` `redis` | [system-design](rubrics/README.md#system-design) | — |
| [Design a URL Shortener](questions/system-design/url-shortener/README.md) | System design | Medium | 45 min | `storage` `caching` `id-generation` | [system-design](rubrics/README.md#system-design) | — |
| [Design an Airline Booking API for Travel Agencies](questions/system-design/airline-agency-booking-api/README.md) | System design | Hard | 45 min | `api-design` `idempotency` `transactions` `sagas` | [system-design](rubrics/README.md#system-design) | — |
| [Design r/place with Multiple Canvases](questions/system-design/collaborative-canvas/README.md) | System design | Hard | 45 min | `real-time` `websockets` `fan-out` `abuse-prevention` | [system-design](rubrics/README.md#system-design) | — |
<!-- questions:end -->

## Rubrics

Rounds are graded against weighted rubrics: each dimension gets a 1–4 score with quoted evidence, and the server computes the weighted score and hire signal. The [rubric guide](rubrics/README.md) lists every dimension's weight, what the evaluator looks for, the level descriptors, and study links, plus background reading on how FAANG interview scorecards work.

<!-- rubrics:start -->
| Rubric | Used for | Dimensions |
|---|---|---|
| [coding](rubrics/README.md#coding) | Coding rounds | Problem understanding & approach (25%), Algorithms & complexity (20%), Coding & correctness (25%), Testing & debugging (15%), Communication (15%) |
| [ai-coding](rubrics/README.md#ai-coding) | AI-assisted coding rounds | Problem understanding & framing (15%), Directing the AI (20%), Verifying AI output (25%), Understanding & ownership (15%), Final correctness & code quality (15%), Communication (10%), plus each question's own dimension |
| [system-design](rubrics/README.md#system-design) | System design rounds | Requirements & scoping (20%), High-level design (25%), Deep dive & technical depth (25%), Scalability, reliability & tradeoffs (20%), Communication & leadership (10%) |
<!-- rubrics:end -->

## Quick start

```bash
npm run doctor                # check Node, Docker, toolchain images, API keys and ports
npm install
cp .env.example .env          # add at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, META_API_KEY
npm run docker:pull           # pre-fetch every language's toolchain image, ~5 GB (otherwise fetched on first use)
npm run dev                   # API on :4317, UI on http://localhost:5173
```

`npm run doctor` runs without `npm install` and can be re-run any time; it reports each problem with the command that fixes it, and exits non-zero if something is broken. It checks:

- Node version and installed npm packages.
- `.env` and which LLM providers have keys (values are never printed).
- Docker CLI, daemon access, each language's image, and disk space for missing images.
- A sandboxed test container started with the runner's isolation flags (skip with `npm run doctor -- --quick`).
- With `DEFAANG_RUNNER=local`: the host toolchains (`python3`, `node`, `gcc`, `g++`, `go`, `rustc`, `javac`).
- Whether the app's ports are free, or de-faang is already running on them.

Or run a single production server with `npm start`, which builds the UI and serves it at http://localhost:4317.

To click through the UI without API keys or token spend, set `DEFAANG_MOCK_LLM=1`. The interviewer and evaluator then return canned text.

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | | Enables the Claude interviewer. An `ant auth login` profile also works. |
| `OPENAI_API_KEY` | | Enables the Codex interviewer. |
| `GEMINI_API_KEY` | | Enables the Gemini interviewer. |
| `META_API_KEY` | | Enables the Muse interviewer ([Meta Model API](https://dev.meta.ai/docs/overview)). `MODEL_API_KEY` also works. |
| `CLAUDE_MODEL` | `claude-opus-5-5` | |
| `OPENAI_MODEL` | `gpt-5.3-codex` | Any Responses-API model. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | e.g. `gemini-4-argon` if your key has access. |
| `MUSE_MODEL` | `muse-spark-1.3` | `muse-wonder-1.0` is Meta's most capable model (preview); `muse-ember-1.0` is the efficient one. |
| `DEFAANG_RUNNER` | `docker` | `local` runs code with your host's `python3`/`node`/`gcc`/`go`/`rustc`/`javac`, with **no isolation**. |
| `DEFAANG_RUN_TIMEOUT` | `10` | Seconds per run. |
| `DEFAANG_MOCK_LLM` | | `1` = offline canned responses. |

## How a round works

1. **Pick a question** and choose interviewer, strictness, verbosity, and language. Coding questions can also be **AI-assisted** (see below). This creates `sessions/<date>_<time>_<question>_<id>/`.
2. **Interview.** The interviewer opens the round. Think out loud in the chat; each message carries a snapshot of your code (or notes and diagram) plus recent test runs. **Run** executes the sample tests and your custom inputs.
3. **Submit.** Coding runs the public and hidden tests; design exports the whiteboard. Your work freezes into `evidence/`.
4. **Follow-ups.** Answer the question's follow-up prompts. They autosave to `evidence/followups.md`.
5. **Evaluate.** The packet (prompt, interviewer notes, final work, test results, run history, transcript, follow-ups, and the diagram image) is graded against the rubric with structured output. The server computes the weighted score and decision. Results land in `evaluation.json` and `report.md`.

```
sessions/2026-11-14_0341_two-sum_d70a/
├── session.json          config + state
├── prompt.md
├── transcript.jsonl      interviewer chat
├── ai-log.jsonl          AI-assisted rounds: assistant prompts, replies, inserts/copies/pastes
├── workspace/            live autosave (solution.py, design.md, design.excalidraw, design.png)
├── runs/                 run-001.json … submit.json
├── evidence/             submission, test-results.json, run-history.md, transcript.md, followups.md, packet.md
├── evaluation.json
├── report.md
├── debrief.jsonl         post-round coaching chat
└── lessons/              lesson-001.md … + index.json
```

## Debrief and lessons

Once a round is evaluated, the report has a **Debrief & lessons** tab.

- **Debrief chat:** a coach that has the full packet (question, interviewer notes and hint ladder, your code or design, tests, run history, transcript, AI usage, follow-up answers) and the evaluation report. The round is over, so it discusses everything openly. Ask how you could have done better, dig into a specific moment, argue with a score, or ask to be quizzed. Starter questions are offered, and the chat is saved to `debrief.jsonl`.
- **Create lesson:** writes a personalised lesson from the round, its evaluation and the debrief so far. You can give it an optional focus (e.g. "edge cases I missed"). Every lesson has the same sections: why this lesson, the concept, what happened and the stronger move, a worked example (in your language), interview technique, practice exercises with answers, a checklist for next time, and further reading. Links come only from the resource library.
- Lessons are saved as `lessons/lesson-NNN.md` in the session folder. Each one has its own page with **Download .md** and **Practise this question again**, and they're all listed under **Lessons** on the home page.

The debrief and lessons use the same LLM provider as the round.

## Adding questions

Each question is a folder. Run `npm run validate` after editing: it checks the schema and resource ids, and runs `reference.py` against every test.

```
questions/coding/<id>/
  question.json      metadata, signature, follow-ups, private interviewer notes, resource ids
  prompt.md          what the candidate sees
  tests.json         { "public": [...], "hidden": [...] }
  reference.py       reference solution; also produces expected output for custom inputs
  starter/solution.{py,js,ts}   (optional for go/c/cpp/rs/java: generated from the typed signature)

questions/system-design/<id>/
  question.json      includes interviewer.facts (revealed only when asked) and deepDives
  prompt.md
```

Then run `npm run readmes` to generate the question's `README.md` and its row in the [question table](#questions). Re-run it whenever you change a question, rubric, or resource; `npm run readmes -- --check` fails if any generated file is out of date.

- **Function questions:** each test is `{ "args": [arg1, arg2], "expected": ... }`. Entry-point names can differ per language (`two_sum` vs `twoSum`).
- **Class questions** (e.g. LRU cache) use the LeetCode convention: `{ "ops": ["LRUCache", "put", "get"], "args": [[2], [1, 1], [1]], "expected": [null, null, 1] }`.
- **Typed signature (Java, C++, C, Go, Rust):** compiled languages need types. Add `"params": [{ "name": "nums", "type": "int[]" }, { "name": "target", "type": "int" }], "returns": "int[]"` to a function signature, or `"init": [...]` (constructor parameters) and `"methods": { "get": { "params": [...], "returns": "int" } }` to a class signature. Types are `int`, `long`, `double`, `bool`, `string`, any of those with `[]` or `[][]`, and `void`. Starters, entry names and harnesses for every compiled language are generated from this, following LeetCode conventions: `class Solution` in Java/C++, `impl Solution` in Rust, a plain function in Go and C with `(pointer, size)` array parameters and `returnSize` outputs in C, `Constructor` plus capitalised methods for Go classes, and `lRUCacheCreate/Get/Free` functions for C classes. C supports arrays up to `[][]` (`string[]` for strings). A question without types is offered only in Python, JavaScript and TypeScript.
- **Entry names:** only `javascript` is required; Python defaults to its snake_case form and TypeScript to the same name. Without starter files, starters for every language are generated from the typed signature.
- **`signature.compare`:** `exact` (the default; floats compared with a tolerance) or `unordered`, which ignores top-level array order.
- **Multipart questions** replace `signature` with a `parts` list. Copy `questions/templates/multipart-coding/` to start one (see below).
- **Rubrics** live in `rubrics/*.json` (weighted dimensions with 1–4 level descriptors).
- **Resources** live in `resources/resources.json`. The evaluator can link **only** to ids in this library, so links can't be hallucinated.

## AI-assisted rounds

Choose **AI-assisted** in the setup dialog of any coding question. The console under the editor gains an **✦ AI assistant** tab, next to Results and Custom input. It uses the same LLM provider as the interviewer.

- **Asking:** each message can attach the problem statement and/or your current code (both on by default). **New chat** clears the assistant's memory of the conversation.
- **Using replies:** code blocks have **Insert** (at the cursor), **Replace editor**, and **Copy** buttons.
- **What's recorded** (`sessions/<id>/ai-log.jsonl`): every prompt with exactly what was sent to the LLM, every reply, each insert, replace and copy (including copying a selection of a reply), every paste into the editor (flagged when it matches an AI reply), and each new chat.
- **At submit** the log is frozen into `evidence/ai-log.jsonl` and `evidence/ai-usage.md`, with the assistant's system prompt, a timeline, and stats. One stat is how many non-trivial lines of the final code appear verbatim in AI replies.
- **The interviewer** knows the round is AI-assisted and sees your recent AI activity. It may ask you to explain AI-written code or what you checked before trusting it.
- **Grading:** the evaluator scores the round with the question's AI rubric, and the report shows the usage stats.

**Helpfulness presets** live in `ai-policies/*.md`. Each is a short header (`label`, `blurb`, `order`) followed by the policy text that goes into the assistant's system prompt. Edit them, or add your own file to add a preset. The four presets:

| Preset | Behaviour |
|---|---|
| Socratic tutor | Never answers directly or writes code; replies with guiding questions. |
| Guarded helper (default) | Analyses, explains and reviews; snippets of about 10 lines at most; never the full solution. |
| Pair programmer | Writes code for tasks you specify; pushes back on "just solve it". |
| Unrestricted | Does anything asked, including complete solutions; tests judgement and verification. |

You can also edit the instructions for a single round in the setup dialog. The exact text used is saved in `session.json` and the evidence.

**AI rubrics.** AI-assisted rounds are graded with `rubrics/ai-coding.json`: problem framing, directing the AI, verifying AI output, understanding & ownership, final correctness, and communication. Each coding question has an `ai` section in `question.json`:

```json
"ai": {
  "rubric": "ai-coding",
  "dimensions": [{ "id": "edge_case_scrutiny", "name": "Scrutinising the AI's edge cases", "weight": 0.15, "signals": "...", "levels": { "1": "...", "2": "...", "3": "...", "4": "..." }, "resources": [] }],
  "watchFor": ["Known ways AI assistants go wrong on this question"]
}
```

- `rubric` picks the rubric file (add your own under `rubrics/`).
- `dimensions` are question-specific criteria added to it. Weights are normalised together with the rubric's own weights.
- `watchFor` lists known AI failure modes. The interviewer and evaluator check whether you caught them, and they're never shown to you.

Every coding question ships with one proposed dimension and a `watchFor` list. `npm run validate` checks the rubric, the dimension ids and the resource ids.

## Multipart questions

```
questions/coding/<id>/
  question.json      "parts": [{ id, title, durationMinutes, signature, interviewer }, ...]
  prompt.md          shared introduction, visible from the start
  reference.py       every part's function or class
  parts/<part-id>/
    prompt.md        revealed when the candidate reaches this part
    tests.json       this part's public and hidden tests
```

Each part has its own typed signature (required, so every language works), tests, and private interviewer notes (approach, hint ladder, pitfalls). `questions/coding/anagram-pairs-and-compound-words/` is a worked example; `questions/templates/multipart-coding/` is a skeleton that validates as soon as you copy it.

During a round:

- **Run** tests the current part. Custom inputs use the current part's signature.
- **Finish part N** runs the current part's public and hidden tests, saves them (`runs/part-N-submit.json`, `evidence/part-N-*`), reveals the next part, and adds its stub to your code in every language. Java and C++ methods go inside your existing `class Solution`, Rust gets another `impl Solution` block, and other languages get a new function at the end. If your code already defines the entry point (e.g. a later part that extends the same class), it's left alone.
- **Submit** (or **End round** before the last part) grades every part reached against your final code. Unreached parts stay hidden.
- The interviewer knows every part, so it can pace the round, but it won't mention a part before you reach it. The evaluation packet records how far you got and when each part was handed in.

Limitation: Go class questions use LeetCode's `Constructor` name, so two parts that are *different* Go classes would clash. A later part that extends the same class works.

## Architecture

```
web/      React + Vite UI (Monaco, Excalidraw, react-markdown)
server/   Fastify API
  llm/          provider interface → Claude (Anthropic SDK) / Codex + Muse (OpenAI Responses API; Muse via
                Meta's api.meta.ai/v1) / Gemini (@google/genai) / mock. All stream chat and return schema-constrained JSON.
  runner/       harnesses (harness.ts for Python/JS/TS, typed.ts for compiled languages), starters.ts
                (generated starters, multipart stubs), Docker/local executor, result comparison
  interviewer.ts  persona and strictness prompts, workspace snapshots
  assistant.ts    AI assistant: helpfulness policies, request composition, usage analysis
  debrief.ts      post-round debrief chat and lesson generation/storage
  evaluator.ts    packet assembly, rubric scoring, report rendering
  sessions.ts     session-folder storage
shared/   types shared by the server and the UI
```

How the runner works: your code is combined with a small language-specific harness, so error line numbers match the editor. For Python and JavaScript/TypeScript the harness reads test cases on stdin, calls your function or class for each case while capturing stdout, errors, and timing, and prints one JSON result line. For compiled languages the harness is generated with the test inputs as typed literals, compiled next to your file (`Solution.java`, `solution.cpp`, `solution.go`, ...), and prints a marked result per case, so a segfault or time-out in one case still reports the cases before it. Compilation doesn't count toward the time limit. Images: `python:3.12-slim`, `node:22-slim`, `gcc:15` (C/C++), `eclipse-temurin:25-jdk`, `rust:1-slim-bookworm`, and `defaang-go:1`, built locally from `docker/go/` with a pre-compiled standard library so Go builds take about a second instead of fifteen. Missing images download in the background; Python/JS work as soon as theirs are present. The Docker sandbox runs with `--network none`, a read-only filesystem, 512 MB of memory, 1 CPU, a 64-process cap, and an unprivileged user.

Claude requests enable server-side refusal fallbacks (`fallbacks: "default"`), so a safety-classifier false positive doesn't end an interview turn. The interviewer's system prompt is cached across turns.

## Tests

```bash
npm test                                  # runner + multipart tests (local runner) + compiled-language tests (Docker; skipped without it) + generated READMEs up to date
DEFAANG_TEST_RUNNER=docker npm test       # same tests through the Docker sandbox
npm run typecheck
```

## Contributing

Contributions are welcome. `main` is protected, so every change goes through a pull request: fork the repo (or branch, if you have access), make your change, run `npm test`, `npm run typecheck` and `npm run validate`, and open a PR. CI runs the same checks (plus every language through the Docker sandbox) and must pass before merging. If you add or edit a question, rubric or resource, run `npm run readmes` so the generated docs stay in sync.

## License

[MIT](LICENSE) © 2026 Jason Sperske

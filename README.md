# de-faang

Take the fear out of FAANG interviews. **de-faang** runs realistic coding and system design rounds on your own machine, with an LLM interviewer (Claude, Codex, Gemini, or Meta's Muse) that talks with you in real time, and a rubric-based evaluation afterward that links to resources for what to study next.

- **HackerRank-style coding pad.** Monaco editor; Python, JavaScript, TypeScript, Java, C++, C, Go, or Rust; sample tests, your own custom inputs, and hidden tests on submit. Code runs in a network-less Docker sandbox.
- **System design whiteboard.** Excalidraw canvas plus a markdown notes pad. The interviewer "sees" your diagram as a text summary on every turn, and the evaluator gets the PNG.
- **Configurable interviewer**
  - **Strict:** the prompt only. No sample tests, no hints, neutral tone. Hidden test details stay hidden until the evaluation.
  - **Standard:** sample tests visible, expected output for your custom inputs, and hints only when you ask.
  - **Coach:** proactive hints, reactions to every test run, and coaching on interview technique.
  - **Verbosity:** terse, normal, or detailed (for both the chat and the report).
- **Multipart questions.** Later parts are revealed only when you hand in the current one, like a real round where the interviewer says "now let's extend this". Your code carries over between parts.
- **Follow-up questions** after you submit, answered in writing.
- **Evaluation packet → rubric scorecard.** Per-dimension 1–4 scores with quoted evidence, a hire/no-hire signal, strengths, improvements, a model answer sketch, and curated resource links.

Every round lives in its own folder under `sessions/`, which git ignores, so your repo stays clean.

## Quick start

```bash
npm install
cp .env.example .env          # add at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, META_API_KEY
npm run docker:pull           # pre-fetch every language's toolchain image, ~5 GB (otherwise fetched on first use)
npm run dev                   # API on :4317, UI on http://localhost:5173
```

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

1. **Pick a question** and choose interviewer, strictness, verbosity, and language. This creates `sessions/<date>_<time>_<question>_<id>/`.
2. **Interview.** The interviewer opens the round. Think out loud in the chat; each message carries a snapshot of your code (or notes and diagram) plus recent test runs. **Run** executes the sample tests and your custom inputs.
3. **Submit.** Coding runs the public and hidden tests; design exports the whiteboard. Your work freezes into `evidence/`.
4. **Follow-ups.** Answer the question's follow-up prompts. They autosave to `evidence/followups.md`.
5. **Evaluate.** The packet (prompt, interviewer notes, final work, test results, run history, transcript, follow-ups, and the diagram image) is graded against the rubric with structured output. The server computes the weighted score and decision. Results land in `evaluation.json` and `report.md`.

```
sessions/2026-11-14_0341_two-sum_d70a/
├── session.json          config + state
├── prompt.md
├── transcript.jsonl      interviewer chat
├── workspace/            live autosave (solution.py, design.md, design.excalidraw, design.png)
├── runs/                 run-001.json … submit.json
├── evidence/             submission, test-results.json, run-history.md, transcript.md, followups.md, packet.md
├── evaluation.json
└── report.md
```

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

- **Function questions:** each test is `{ "args": [arg1, arg2], "expected": ... }`. Entry-point names can differ per language (`two_sum` vs `twoSum`).
- **Class questions** (e.g. LRU cache) use the LeetCode convention: `{ "ops": ["LRUCache", "put", "get"], "args": [[2], [1, 1], [1]], "expected": [null, null, 1] }`.
- **Typed signature (Java, C++, C, Go, Rust):** compiled languages need types. Add `"params": [{ "name": "nums", "type": "int[]" }, { "name": "target", "type": "int" }], "returns": "int[]"` to a function signature, or `"init": [...]` (constructor parameters) and `"methods": { "get": { "params": [...], "returns": "int" } }` to a class signature. Types are `int`, `long`, `double`, `bool`, `string`, any of those with `[]` or `[][]`, and `void`. Starters, entry names and harnesses for every compiled language are generated from this, following LeetCode conventions: `class Solution` in Java/C++, `impl Solution` in Rust, a plain function in Go and C with `(pointer, size)` array parameters and `returnSize` outputs in C, `Constructor` plus capitalised methods for Go classes, and `lRUCacheCreate/Get/Free` functions for C classes. C supports arrays up to `[][]` (`string[]` for strings). A question without types is offered only in Python, JavaScript and TypeScript.
- **Entry names:** only `javascript` is required; Python defaults to its snake_case form and TypeScript to the same name. Without starter files, starters for every language are generated from the typed signature.
- **`signature.compare`:** `exact` (the default; floats compared with a tolerance) or `unordered`, which ignores top-level array order.
- **Multipart questions** replace `signature` with a `parts` list. Copy `questions/templates/multipart-coding/` to start one (see below).
- **Rubrics** live in `rubrics/*.json` (weighted dimensions with 1–4 level descriptors).
- **Resources** live in `resources/resources.json`. The evaluator can link **only** to ids in this library, so links can't be hallucinated.

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
  evaluator.ts    packet assembly, rubric scoring, report rendering
  sessions.ts     session-folder storage
shared/   types shared by the server and the UI
```

How the runner works: your code is combined with a small language-specific harness, so error line numbers match the editor. For Python and JavaScript/TypeScript the harness reads test cases on stdin, calls your function or class for each case while capturing stdout, errors, and timing, and prints one JSON result line. For compiled languages the harness is generated with the test inputs as typed literals, compiled next to your file (`Solution.java`, `solution.cpp`, `solution.go`, ...), and prints a marked result per case, so a segfault or time-out in one case still reports the cases before it. Compilation doesn't count toward the time limit. Images: `python:3.12-slim`, `node:22-slim`, `gcc:15` (C/C++), `eclipse-temurin:25-jdk`, `rust:1-slim-bookworm`, and `defaang-go:1`, built locally from `docker/go/` with a pre-compiled standard library so Go builds take about a second instead of fifteen. Missing images download in the background; Python/JS work as soon as theirs are present. The Docker sandbox runs with `--network none`, a read-only filesystem, 512 MB of memory, 1 CPU, a 64-process cap, and an unprivileged user.

Claude requests enable server-side refusal fallbacks (`fallbacks: "default"`), so a safety-classifier false positive doesn't end an interview turn. The interviewer's system prompt is cached across turns.

## Tests

```bash
npm test                                  # runner + multipart tests (local runner) + compiled-language tests (Docker; skipped without it)
DEFAANG_TEST_RUNNER=docker npm test       # same tests through the Docker sandbox
npm run typecheck
```

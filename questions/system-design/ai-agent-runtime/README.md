# Design a Runtime for AI Writing Agents

**Type:** System design · **Difficulty:** Hard · **Time:** 45 min · **Tags:** `system-design` `ai-agents` `llm` `streaming` `durable-execution`

A writing-assistance product runs inside browser extensions, a macOS app and a Windows app. It is adding **AI agents**: the user asks for something ("rewrite this email to sound more confident", "summarize this thread and draft a reply"), and an agent runs a multi-step loop of LLM calls and tool calls, streaming its progress and result back into the app the user is typing in.

Full prompt: [prompt.md](prompt.md).

## How it's graded

Rubric: [`system-design`](../../../rubrics/README.md#system-design) (System design interview rubric). Each dimension is scored 1–4 with quoted evidence; see the [rubric guide](../../../rubrics/README.md) for the level descriptors and how the hire signal is computed.

| Dimension | Weight | Learn more |
|---|---|---|
| Requirements & scoping | 20% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Latency numbers every programmer should know](https://gist.github.com/jboner/2841832)<br>[Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |
| High-level design | 25% | [The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Deep dive & technical depth | 25% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[The System Design Primer](https://github.com/donnemartin/system-design-primer)<br>[Wikipedia — Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) |
| Scalability, reliability & tradeoffs | 20% | [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)<br>[Google SRE Book](https://sre.google/sre-book/table-of-contents/)<br>[ByteByteGo — System design](https://bytebytego.com/) |
| Communication & leadership | 10% | [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) |

## Approach

> **Spoiler.** This is what the interviewer is privately told to look for. Try the round first.

<details>
<summary>Show the approach</summary>

Strong answers treat an agent run as a durable, resumable state machine whose steps are mostly waiting on slow external calls, and separate the control plane (run records, agent definitions, limits) from the data plane (step execution, streaming). Requirements: start run with agent id/version and context; stream tokens and step events with first token under ~1.5 s; runs of 5-60 s and up to 10 minutes; resume streaming after disconnect and on another device; cancel; per-user quotas and per-agent budgets; tools (internal document context, search, user-approved actions); multiple LLM providers with failover; versioned agents rolled out by flag with evals; full traces. Estimates: 2,000 runs/s at peak with ~25 s average duration gives ~50,000 concurrent runs; ~6 LLM calls per run gives ~12,000 LLM calls/s; ~3,000 tokens per call is ~36M tokens/s through providers, so provider quota (tokens per minute) is the binding constraint, not CPU; streaming connections ~50k concurrent. API: POST /runs (idempotency key, agent, input, client capabilities) returns run id; GET /runs/{id}/events?after=seq as SSE or WebSocket; POST /runs/{id}/cancel; tool approval callbacks. Execution: run records in a database; steps executed by workers via a durable execution engine or a hand-built equivalent (each step's input/output checkpointed in an event log keyed by run id and step number, so a crashed worker's run is picked up by another and completed steps are replayed from the log instead of re-executed). Workers are async I/O-bound (thousands of runs per process). Streaming: workers append token/step events with sequence numbers to a per-run stream (Redis Streams or Kafka) and a stateless streaming gateway fans out to connected clients; clients reconnect with last seq; final result persisted for later retrieval. LLM gateway: central service that holds provider keys, enforces per-provider token budgets (token buckets on TPM/RPM), priority queues (interactive over background), retries with jitter, hedged requests, circuit breakers, failover to a configured fallback model per agent, prompt caching, and cost accounting per run/user/agent. Tools: registry with schemas, per-tool timeouts and permissions, side-effecting tools require user approval and an idempotency key derived from run id + step so retries don't repeat actions; sandbox for untrusted execution; prompt-injection defences (treat tool output as data, restrict which tools an agent can call). Limits: per-user rate and daily token quotas, per-run step/token caps and wall-clock limits to kill loops, per-agent budgets with alerts. Rollout: immutable agent versions (prompt, model, tools, params), offline evals on a golden set, canary by flag with online metrics (latency, tokens, acceptance rate, thumbs), automatic rollback. Observability: a trace per run with each LLM/tool span, tokens, cost, latency; sampled transcripts with privacy controls. Cross-platform: one runtime API so browser, macOS and Windows clients share behaviour; on-device context gathering stays on the client and is sent as run input.

**Common pitfalls**

- Running each agent loop synchronously inside the client's HTTP request, so a disconnect, deploy or timeout kills the run and nothing can resume.
- One thread or container per run, which wastes resources on runs that are almost always waiting on the network.
- Re-executing completed LLM calls and side-effecting tool calls on retry, doubling cost and actions.
- Calling LLM providers directly from every agent service with their own keys and retry logic, so nothing enforces the shared rate limit or tracks cost.
- Streaming without sequence numbers, so reconnecting clients miss or duplicate tokens.
- No per-run step, token or time caps, so a looping agent runs until a human notices the bill.
- Shipping prompt or model changes without versioning, evals or a canary.
- Ignoring prompt injection through tool outputs or documents.

**Likely deep dives**

- Durable execution: run state machine, step checkpointing, crash recovery and resume
- Streaming tokens to clients with sequence numbers and reconnection across devices
- The LLM gateway: shared token budgets, priorities, retries, failover and cost accounting
- Tool calling: approval, idempotency of side effects, timeouts and prompt-injection defence
- Versioning, evals and safe rollout of agent changes

</details>

## Follow-up questions

Asked in writing after you submit.

- A user starts a 40-second run in the browser extension, closes the laptop lid after 10 seconds, and opens the macOS app 2 minutes later. Walk through what happens to the run and what the user sees.
- The primary LLM provider starts returning 429s and 30-second latencies during peak hours. What does your runtime do, step by step, and how does each agent decide what is an acceptable fallback?
- An agent's tool call sends an email on the user's behalf. The worker crashes right after the tool returns, and the step is retried. How do you avoid sending the email twice?
- A team ships a new version of their agent prompt that doubles its token usage and lowers quality. How would you have caught it before it reached all 40 million users, and how do you roll it back?
- How do you keep one heavy user, or one buggy agent stuck in a loop, from running up a huge LLM bill or starving everyone else of provider capacity?

## Study resources

- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Temporal docs — Workflow execution](https://docs.temporal.io/workflow-execution)
- [Model Context Protocol — Documentation](https://modelcontextprotocol.io/)
- [Wikipedia — Token bucket](https://en.wikipedia.org/wiki/Token_bucket)
- [Apache Kafka — Documentation](https://kafka.apache.org/documentation/)
- [Stripe — Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/)
- [Hello Interview — System design learning](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction)

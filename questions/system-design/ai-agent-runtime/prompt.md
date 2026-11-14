# Design a Runtime for AI Writing Agents

A writing-assistance product runs inside browser extensions, a macOS app and a Windows app. It is adding **AI agents**: the user asks for something ("rewrite this email to sound more confident", "summarize this thread and draft a reply"), and an agent runs a multi-step loop of LLM calls and tool calls, streaming its progress and result back into the app the user is typing in.

Many teams will build agents. Design the shared **agent runtime** they all run on: how a run is started, executed, streamed, resumed, cancelled, limited and observed.

- **In scope:** the run lifecycle and execution, streaming to clients, tool calling, calls to LLM providers, per-user limits and cost control, rolling out new agent versions, and observability.
- **Out of scope:** the prompts and behaviour of any particular agent, and training models.

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Ask about clients, run lengths, tools, scale, LLM providers, and cost. The interviewer has the numbers.
2. **Estimate** concurrent runs, LLM calls and tokens per second, and streaming connections.
3. **Design the system**: APIs, the run state machine, where agent steps execute, and how tokens reach the client.
4. **Go deep** on the hardest parts, such as durable execution and resume, provider rate limits and failover, and safe tool calls.

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, estimates, and tradeoffs. The interviewer sees both when you send a message.

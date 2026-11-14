# Design a Distributed Rate Limiter

Design a rate limiter that protects a large public API from abuse and overload. Requests over the limit should be rejected quickly, and the limiter must work correctly when the API runs on many servers.

You have about **45 minutes**. Drive the conversation:

1. **Clarify requirements.** Who is limited, by what key, at what rates, and how accurate must it be? The interviewer has the numbers.
2. **Choose and justify an algorithm.**
3. **Design the distributed architecture**: where the limiter lives, where state lives, and how it stays consistent.
4. **Discuss failure modes, latency, and operations.**

Use the **Whiteboard** tab to draw, and the **Notes** tab (markdown) for requirements, algorithm details, and tradeoffs. The interviewer sees both when you send a message.

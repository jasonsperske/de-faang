import type { Provider } from "../../shared/types.ts";
import type { ChatRequest, JsonRequest, LLMProvider } from "./provider.ts";

/**
 * Offline stand-in used when DEFAANG_MOCK_LLM=1. It lets you click through the whole flow
 * (and run the end-to-end test) without API keys or token spend. Replies are canned.
 */
export class MockProvider implements LLMProvider {
  readonly model = "mock";
  constructor(readonly id: Provider) {}

  async chat(req: ChatRequest, onDelta: (t: string) => void): Promise<string> {
    const last = req.messages.at(-1);
    const text = typeof last?.content === "string" ? last.content : "";
    const reply = req.system.startsWith("You write personalised study lessons")
      ? "# Mock lesson: hash maps for complement lookups\n\n## Why this lesson\n(mock) Add an API key to get a real lesson.\n\n## The concept\nStore what you've seen so each lookup is O(1).\n\n## What happened, and the stronger move\n- (mock moment)\n\n## Worked example\n```python\ndef two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n```\n\n## Interview technique\nState the brute force first.\n\n## Practice\n1. Three Sum. *Hint: sort first.*\n\n## Answers\n1. Sort, then two pointers per element.\n\n## Checklist for next time\n- Clarify duplicates.\n\n## Further reading\n- [Tech Interview Handbook — Hash table cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/): practice the patterns.\n"
      : req.system.startsWith("You are a senior engineer and interview coach")
        ? "(mock coach) The biggest gain would have come from stating your approach and its complexity before coding. Want me to walk through that moment?"
        : req.system.startsWith("You are an AI coding assistant")
      ? "(mock assistant) Here's a sketch you could start from:\n\n```python\ndef helper(words):\n    seen = set()\n    for w in words:\n        seen.add(w)\n    return seen\n```\n\nCheck the edge cases before using it."
      : text.includes("joined the interview room")
      ? "Hi, thanks for joining! I'm your interviewer today. Take a moment to read the problem, and feel free to ask clarifying questions before you start."
      : /hint/i.test(text)
        ? "(mock) Think about what information you need at each step, and how to look it up quickly."
        : "(mock) Got it. Keep talking me through your thinking.";
    for (const word of reply.split(/(?<= )/)) {
      onDelta(word);
      await new Promise((r) => setTimeout(r, 8));
    }
    return reply;
  }

  async json<T>(req: JsonRequest): Promise<T> {
    return fake(req.schema) as T;
  }
}

/** Produces a minimal value that satisfies the (strict) JSON schema. */
function fake(schema: any, key = ""): unknown {
  if (schema.enum) return key === "score" ? 3 : schema.enum[0];
  switch (schema.type) {
    case "object":
      return Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, fake(v, k)]));
    case "array": {
      // One entry per enum value when items are keyed by an enum id (e.g. rubric dimensions).
      const ids = schema.items?.properties?.id?.enum as unknown[] | undefined;
      if (ids && key === "dimensions") return ids.map((id) => ({ ...(fake(schema.items, key) as object), id }));
      return [fake(schema.items, key)];
    }
    case "integer":
    case "number":
      return 3;
    case "boolean":
      return true;
    default:
      return `(mock ${key || "text"}) Add an API key to get real feedback.`;
  }
}

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
    const reply = text.includes("joined the interview room")
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

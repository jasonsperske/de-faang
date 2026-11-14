import type { Provider } from "../../shared/types.ts";

export type ContentPart = { type: "text"; text: string } | { type: "image"; mediaType: "image/png"; base64: string };

export interface LLMMessage {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

export type Effort = "low" | "medium" | "high";

export interface ChatRequest {
  system: string;
  messages: LLMMessage[];
  effort: Effort;
  maxTokens?: number;
}

export interface JsonRequest {
  system: string;
  messages: LLMMessage[];
  /** JSON schema: every object must set additionalProperties:false and list all properties as required. */
  schema: Record<string, unknown>;
  schemaName: string;
  effort: Effort;
}

export interface LLMProvider {
  id: Provider;
  model: string;
  /** Streams a text reply. Calls onDelta for each chunk and resolves with the full text. */
  chat(req: ChatRequest, onDelta: (text: string) => void, signal?: AbortSignal): Promise<string>;
  /** Returns a JSON object conforming to the schema. */
  json<T>(req: JsonRequest): Promise<T>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public statusCode = 502,
  ) {
    super(message);
  }
}

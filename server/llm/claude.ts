import Anthropic from "@anthropic-ai/sdk";
import type { ChatRequest, ContentPart, JsonRequest, LLMMessage, LLMProvider } from "./provider.ts";
import { LLMError } from "./provider.ts";

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlockParam = Anthropic.Beta.BetaContentBlockParam;

function toBlocks(content: string | ContentPart[]): string | BetaContentBlockParam[] {
  if (typeof content === "string") return content;
  return content.map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } },
  );
}

const toMessages = (msgs: LLMMessage[]): BetaMessageParam[] => msgs.map((m) => ({ role: m.role, content: toBlocks(m.content) }));

function wrap(err: unknown): never {
  if (err instanceof Anthropic.AuthenticationError) throw new LLMError("Claude: invalid or missing ANTHROPIC_API_KEY.", 401);
  if (err instanceof Anthropic.RateLimitError) throw new LLMError("Claude: rate limited. Wait a moment and retry.", 429);
  if (err instanceof Anthropic.APIError) throw new LLMError(`Claude API error ${err.status}: ${err.message}`);
  throw err;
}

export class ClaudeProvider implements LLMProvider {
  readonly id = "claude" as const;
  private client = new Anthropic();
  constructor(readonly model: string) {}

  /**
   * Shared request fields. Server-side refusal fallbacks are enabled ("default" routing) so that a
   * safety-classifier decline is retried transparently instead of ending the interview turn.
   */
  private base(system: string, effort: ChatRequest["effort"], maxTokens: number) {
    return {
      model: this.model,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
      fallbacks: "default" as const,
      // The system prompt (question, rubric, interviewer notes) is stable for the whole session,
      // so cache it; conversation turns are appended after it.
      system: [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }],
      cache_control: { type: "ephemeral" as const },
      output_config: { effort },
    };
  }

  async chat(req: ChatRequest, onDelta: (t: string) => void, signal?: AbortSignal): Promise<string> {
    try {
      const stream = this.client.beta.messages.stream(
        { ...this.base(req.system, req.effort, req.maxTokens ?? 16000), messages: toMessages(req.messages) },
        { signal },
      );
      stream.on("text", (t) => onDelta(t));
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") {
        const note = "\n\n_(The model declined to continue this reply.)_";
        onDelta(note);
      }
      return msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    } catch (err) {
      if (signal?.aborted) return "";
      wrap(err);
    }
  }

  async json<T>(req: JsonRequest): Promise<T> {
    try {
      // Streamed so a long evaluation never hits an HTTP timeout.
      const stream = this.client.beta.messages.stream({
        ...this.base(req.system, req.effort, 32000),
        messages: toMessages(req.messages),
        output_config: { effort: req.effort, format: { type: "json_schema", schema: req.schema } },
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") throw new LLMError("Claude declined to produce the evaluation.");
      if (msg.stop_reason === "max_tokens") throw new LLMError("Claude's evaluation was cut off (max_tokens).");
      const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      return JSON.parse(text) as T;
    } catch (err) {
      wrap(err);
    }
  }
}

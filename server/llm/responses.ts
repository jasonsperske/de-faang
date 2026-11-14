import OpenAI from "openai";
import type { Provider } from "../../shared/types.ts";
import type { ChatRequest, ContentPart, JsonRequest, LLMMessage, LLMProvider } from "./provider.ts";
import { LLMError } from "./provider.ts";

type InputItem = OpenAI.Responses.ResponseInputItem;

export interface ResponsesOptions {
  id: Provider;
  label: string; // used in error messages
  model: string;
  apiKeyEnv: string;
  client: OpenAI;
  /** OpenAI accepts `detail` on input_image; Meta's Model API doesn't document it, so it's omitted there. */
  imageDetail: boolean;
  /** Whether to send `store: false` (don't retain responses server-side). */
  disableStore: boolean;
}

/**
 * Provider for any server that speaks the OpenAI Responses API:
 * OpenAI itself (Codex models) and Meta's Model API (Muse models, base URL https://api.meta.ai/v1).
 */
export class ResponsesProvider implements LLMProvider {
  readonly id: Provider;
  readonly model: string;
  constructor(private opts: ResponsesOptions) {
    this.id = opts.id;
    this.model = opts.model;
  }

  private toInput(msgs: LLMMessage[]): InputItem[] {
    return msgs.map((m): InputItem => {
      if (typeof m.content === "string") return { role: m.role, content: m.content };
      if (m.role === "assistant") {
        return { role: "assistant", content: m.content.map((p) => (p.type === "text" ? p.text : "")).join("\n") };
      }
      return {
        role: "user",
        content: m.content.map((p: ContentPart) =>
          p.type === "text"
            ? { type: "input_text" as const, text: p.text }
            : ({
                type: "input_image" as const,
                image_url: `data:${p.mediaType};base64,${p.base64}`,
                ...(this.opts.imageDetail ? { detail: "auto" as const } : {}),
              } as OpenAI.Responses.ResponseInputImage),
        ),
      };
    });
  }

  private wrap(err: unknown): never {
    const { label, apiKeyEnv } = this.opts;
    if (err instanceof OpenAI.AuthenticationError) throw new LLMError(`${label}: invalid or missing ${apiKeyEnv}.`, 401);
    if (err instanceof OpenAI.RateLimitError) throw new LLMError(`${label}: rate limited. Wait a moment and retry.`, 429);
    if (err instanceof OpenAI.NotFoundError) throw new LLMError(`${label}: model "${this.model}" not found or not available to your key.`, 404);
    if (err instanceof OpenAI.APIError) throw new LLMError(`${label} API error ${err.status}: ${err.message}`);
    throw err;
  }

  private base(system: string, effort: ChatRequest["effort"], maxTokens: number) {
    return {
      model: this.model,
      instructions: system,
      reasoning: { effort },
      max_output_tokens: maxTokens,
      ...(this.opts.disableStore ? { store: false } : {}),
    };
  }

  async chat(req: ChatRequest, onDelta: (t: string) => void, signal?: AbortSignal): Promise<string> {
    try {
      const stream = this.opts.client.responses.stream(
        { ...this.base(req.system, req.effort, req.maxTokens ?? 16000), input: this.toInput(req.messages) },
        { signal },
      );
      let text = "";
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          text += event.delta;
          onDelta(event.delta);
        }
      }
      return text;
    } catch (err) {
      if (signal?.aborted) return "";
      this.wrap(err);
    }
  }

  async json<T>(req: JsonRequest): Promise<T> {
    try {
      const stream = this.opts.client.responses.stream({
        ...this.base(req.system, req.effort, 32000),
        input: this.toInput(req.messages),
        text: { format: { type: "json_schema", name: req.schemaName, schema: req.schema, strict: true } },
      });
      const res = await stream.finalResponse();
      if (res.status === "incomplete") throw new LLMError(`${this.opts.label} evaluation incomplete: ${res.incomplete_details?.reason ?? "unknown"}`);
      return JSON.parse(res.output_text) as T;
    } catch (err) {
      this.wrap(err);
    }
  }
}

export const codexProvider = (model: string) =>
  new ResponsesProvider({ id: "codex", label: "Codex", model, apiKeyEnv: "OPENAI_API_KEY", client: new OpenAI(), imageDetail: true, disableStore: true });

export const metaApiKey = () => process.env.META_API_KEY || process.env.MODEL_API_KEY;

export const museProvider = (model: string) =>
  new ResponsesProvider({
    id: "muse",
    label: "Muse (Meta)",
    model,
    apiKeyEnv: "META_API_KEY",
    client: new OpenAI({ apiKey: metaApiKey(), baseURL: process.env.META_BASE_URL || "https://api.meta.ai/v1" }),
    imageDetail: false,
    disableStore: true,
  });

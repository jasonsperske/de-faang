import { ApiError, GoogleGenAI, ThinkingLevel, type Content, type Part } from "@google/genai";
import type { ChatRequest, JsonRequest, LLMMessage, LLMProvider } from "./provider.ts";
import { LLMError } from "./provider.ts";

const LEVEL: Record<ChatRequest["effort"], ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

function toContents(msgs: LLMMessage[]): Content[] {
  return msgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts:
      typeof m.content === "string"
        ? [{ text: m.content }]
        : m.content.map((p): Part => (p.type === "text" ? { text: p.text } : { inlineData: { mimeType: p.mediaType, data: p.base64 } })),
  }));
}

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini" as const;
  private ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
  constructor(readonly model: string) {}

  private wrap(err: unknown): never {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) throw new LLMError("Gemini: invalid or missing GEMINI_API_KEY.", 401);
      if (err.status === 404) throw new LLMError(`Gemini: model "${this.model}" not found or not available to your key.`, 404);
      if (err.status === 429) throw new LLMError("Gemini: rate limited. Wait a moment and retry.", 429);
      throw new LLMError(`Gemini API error ${err.status}: ${err.message}`);
    }
    throw err;
  }

  async chat(req: ChatRequest, onDelta: (t: string) => void, signal?: AbortSignal): Promise<string> {
    try {
      const stream = await this.ai.models.generateContentStream({
        model: this.model,
        contents: toContents(req.messages),
        config: {
          systemInstruction: req.system,
          maxOutputTokens: req.maxTokens ?? 16000,
          thinkingConfig: { thinkingLevel: LEVEL[req.effort] },
          abortSignal: signal,
        },
      });
      let text = "";
      for await (const chunk of stream) {
        const t = chunk.text;
        if (t) {
          text += t;
          onDelta(t);
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
      const res = await this.ai.models.generateContent({
        model: this.model,
        contents: toContents(req.messages),
        config: {
          systemInstruction: req.system,
          maxOutputTokens: 32000,
          thinkingConfig: { thinkingLevel: LEVEL[req.effort] },
          responseMimeType: "application/json",
          responseJsonSchema: req.schema,
        },
      });
      const reason = res.candidates?.[0]?.finishReason;
      if (reason && reason !== "STOP") throw new LLMError(`Gemini evaluation did not finish (${reason}).`);
      return JSON.parse(res.text ?? "") as T;
    } catch (err) {
      this.wrap(err);
    }
  }
}

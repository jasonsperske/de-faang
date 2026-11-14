import type { AppConfig, Provider } from "../../shared/types.ts";
import { ClaudeProvider } from "./claude.ts";
import { GeminiProvider } from "./gemini.ts";
import { MockProvider } from "./mock.ts";
import type { LLMProvider } from "./provider.ts";
import { LLMError } from "./provider.ts";
import { codexProvider, metaApiKey, museProvider } from "./responses.ts";

interface ProviderDef {
  id: Provider;
  label: string;
  keyEnv: string;
  hasKey: () => boolean;
  model: () => string;
  create: (model: string) => LLMProvider;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "claude",
    label: "Claude (Anthropic)",
    keyEnv: "ANTHROPIC_API_KEY",
    // The SDK can also authenticate via ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile.
    hasKey: () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE),
    model: () => process.env.CLAUDE_MODEL || "claude-opus-5-5",
    create: (m) => new ClaudeProvider(m),
  },
  {
    id: "codex",
    label: "Codex (OpenAI)",
    keyEnv: "OPENAI_API_KEY",
    hasKey: () => Boolean(process.env.OPENAI_API_KEY),
    model: () => process.env.OPENAI_MODEL || "gpt-5.3-codex",
    create: codexProvider,
  },
  {
    id: "gemini",
    label: "Gemini (Google)",
    keyEnv: "GEMINI_API_KEY",
    hasKey: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    model: () => process.env.GEMINI_MODEL || "gemini-3.8-flash",
    create: (m) => new GeminiProvider(m),
  },
  {
    id: "muse",
    label: "Muse (Meta)",
    keyEnv: "META_API_KEY",
    hasKey: () => Boolean(metaApiKey()),
    model: () => process.env.MUSE_MODEL || "muse-spark-1.3",
    create: museProvider,
  },
];

const mock = () => process.env.DEFAANG_MOCK_LLM === "1";

export function providerInfo(): AppConfig["providers"] {
  return PROVIDERS.map((p) =>
    mock()
      ? { id: p.id, label: `${p.label.split(" ")[0]} (mock)`, available: true, model: "mock" }
      : { id: p.id, label: p.label, available: p.hasKey(), model: p.model() },
  );
}

const instances = new Map<Provider, LLMProvider>();

export function getProvider(id: Provider): LLMProvider {
  let p = instances.get(id);
  if (!p) {
    const def = PROVIDERS.find((d) => d.id === id);
    if (!def) throw new LLMError(`Unknown provider ${id}`, 400);
    if (mock()) p = new MockProvider(id);
    else {
      if (!def.hasKey()) throw new LLMError(`${def.keyEnv} is not set. Add it to .env and restart.`, 400);
      p = def.create(def.model());
    }
    instances.set(id, p);
  }
  return p;
}

export type { LLMProvider, LLMMessage, ContentPart } from "./provider.ts";
export { LLMError } from "./provider.ts";

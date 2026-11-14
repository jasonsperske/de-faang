import type {
  AiLogEntry,
  AppConfig,
  ChatEntry,
  Evaluation,
  Language,
  QuestionSummary,
  RunResult,
  SessionConfig,
  SessionListItem,
  SessionView,
  TestCase,
} from "../../../shared/types";

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

export type CodeWorkspace = { language: Language; code: string };
export type DesignWorkspace = { markdown: string; scene?: unknown; diagramSummary: string; png?: string };
export type Workspace = CodeWorkspace | DesignWorkspace;

export const api = {
  config: () => req<AppConfig>("GET", "/api/config"),
  questions: () => req<QuestionSummary[]>("GET", "/api/questions"),
  sessions: () => req<SessionListItem[]>("GET", "/api/sessions"),
  createSession: (questionId: string, config: SessionConfig) => req<SessionView>("POST", "/api/sessions", { questionId, ...config }),
  session: (id: string) => req<SessionView>("GET", `/api/sessions/${id}`),
  saveWorkspace: (id: string, ws: Workspace) => req<{ ok: true }>("PUT", `/api/sessions/${id}/workspace`, ws),
  run: (id: string, body: { language: Language; code: string; includePublic: boolean; custom: TestCase[] }) =>
    req<{ result: RunResult; run: number; summary: string }>("POST", `/api/sessions/${id}/run`, body),
  submit: (id: string, ws: Workspace) => req<SessionView>("POST", `/api/sessions/${id}/submit`, ws),
  aiEvent: (id: string, e: { kind: "insert" | "replace" | "copy"; code: string; source?: "button" | "selection" } | { kind: "paste"; code: string; fromAi: boolean } | { kind: "reset" }) =>
    req<{ entry: AiLogEntry }>("POST", `/api/sessions/${id}/ai-events`, e),
  nextPart: (id: string, ws: CodeWorkspace) => req<SessionView>("POST", `/api/sessions/${id}/next-part`, ws),
  saveFollowUps: (id: string, answers: string[]) => req<{ ok: true }>("POST", `/api/sessions/${id}/followups`, { answers }),
  evaluate: (id: string) => req<{ evaluation: Evaluation; markdown: string }>("POST", `/api/sessions/${id}/evaluate`),
  report: (id: string) => req<{ evaluation: Evaluation; markdown: string; submit?: RunResult }>("GET", `/api/sessions/${id}/report`),
};

export type ChatKind = "message" | "hint" | "open" | "run" | "pending";

/** Reads a server-sent-event stream of JSON messages. */
async function readSse(res: Response, onMessage: (msg: any) => void): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (chunk.startsWith("data: ")) onMessage(JSON.parse(chunk.slice(6)));
    }
  }
}

/** Asks the AI assistant (AI-assisted rounds). Streams the reply; returns the logged prompt and reply. */
export async function streamAssistant(
  id: string,
  body: { text: string; attachProblem: boolean; attachCode: boolean; language: Language; code: string },
  onDelta: (t: string) => void,
): Promise<{ prompt?: AiLogEntry; response?: AiLogEntry; error?: string }> {
  const res = await fetch(`/api/sessions/${id}/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? res.statusText);
  }
  const out: { prompt?: AiLogEntry; response?: AiLogEntry; error?: string } = {};
  await readSse(res, (msg) => {
    if (msg.prompt) out.prompt = msg.prompt;
    if (msg.delta) onDelta(msg.delta);
    if (msg.error) out.error = msg.error;
    if (msg.done) out.response = msg.entry;
  });
  return out;
}

/** Streams an interviewer reply over server-sent events. */
export async function streamChat(
  id: string,
  body: { kind: ChatKind; text?: string; workspace?: Workspace },
  onDelta: (t: string) => void,
  signal?: AbortSignal,
): Promise<ChatEntry | null> {
  const res = await fetch(`/api/sessions/${id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/event-stream")) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    return null; // skipped (e.g. run feedback outside coach mode)
  }
  let entry: ChatEntry | null = null;
  await readSse(res, (msg) => {
    if (msg.delta) onDelta(msg.delta);
    if (msg.error) throw new Error(msg.error);
    if (msg.done) entry = msg.entry ?? null;
  });
  return entry;
}

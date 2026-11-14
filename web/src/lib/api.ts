import type {
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
  nextPart: (id: string, ws: CodeWorkspace) => req<SessionView>("POST", `/api/sessions/${id}/next-part`, ws),
  saveFollowUps: (id: string, answers: string[]) => req<{ ok: true }>("POST", `/api/sessions/${id}/followups`, { answers }),
  evaluate: (id: string) => req<{ evaluation: Evaluation; markdown: string }>("POST", `/api/sessions/${id}/evaluate`),
  report: (id: string) => req<{ evaluation: Evaluation; markdown: string; submit?: RunResult }>("GET", `/api/sessions/${id}/report`),
};

export type ChatKind = "message" | "hint" | "open" | "run" | "pending";

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
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let entry: ChatEntry | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (!chunk.startsWith("data: ")) continue;
      const msg = JSON.parse(chunk.slice(6));
      if (msg.delta) onDelta(msg.delta);
      if (msg.error) throw new Error(msg.error);
      if (msg.done) entry = msg.entry ?? null;
    }
  }
  return entry;
}

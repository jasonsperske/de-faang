import type {
  ActivityEntry,
  AppStatus,
  ProjectFile,
  DebriefEntry,
  LessonMeta,
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
  /** Debugging rounds pass no workspace: their files are saved as they're edited. */
  submit: (id: string, ws?: Workspace) => req<SessionView>("POST", `/api/sessions/${id}/submit`, ws ?? {}),
  files: (id: string) => req<{ files: ProjectFile[] }>("GET", `/api/sessions/${id}/files`),
  readFile: (id: string, path: string, open = false) =>
    req<{ path: string; content: string }>("GET", `/api/sessions/${id}/file?${new URLSearchParams({ path, ...(open ? { open: "1" } : {}) })}`),
  writeFile: (id: string, path: string, content: string, create = false) => req<{ ok: true }>("PUT", `/api/sessions/${id}/file`, { path, content, create }),
  deleteFile: (id: string, path: string) => req<{ ok: true }>("DELETE", `/api/sessions/${id}/file?${new URLSearchParams({ path })}`),
  appStatus: (id: string) => req<AppStatus>("GET", `/api/sessions/${id}/app`),
  app: (id: string, action: "start" | "restart" | "stop") => req<AppStatus>("POST", `/api/sessions/${id}/app`, { action }),
  checks: (id: string) => req<{ result: RunResult; run: number; summary: string }>("POST", `/api/sessions/${id}/checks`),
  aiEvent: (id: string, e: { kind: "insert" | "replace" | "copy"; code: string; source?: "button" | "selection" } | { kind: "paste"; code: string; fromAi: boolean } | { kind: "reset" }) =>
    req<{ entry: AiLogEntry }>("POST", `/api/sessions/${id}/ai-events`, e),
  debrief: (id: string) => req<{ messages: DebriefEntry[]; lessons: LessonMeta[] }>("GET", `/api/sessions/${id}/debrief`),
  lesson: (id: string, lessonId: string) => req<{ lesson: LessonMeta; markdown: string }>("GET", `/api/sessions/${id}/lessons/${lessonId}`),
  lessons: () => req<LessonMeta[]>("GET", "/api/lessons"),
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
  body: { text: string; attachProblem: boolean; attachCode: boolean; language?: Language; code: string; file?: string },
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

/** POSTs and reads a server-sent-event stream; throws on HTTP errors and on an `error` message. */
async function postSse(url: string, body: unknown, onMessage: (msg: any) => void): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? res.statusText);
  }
  let error: string | undefined;
  await readSse(res, (msg) => {
    if (msg.error) error = msg.error;
    else onMessage(msg);
  });
  if (error) throw new Error(error);
}

/** Runs a terminal command (debugging rounds); streams its output. Abort the signal to stop it. */
export async function streamTerminal(id: string, command: string, onOutput: (s: string) => void, signal: AbortSignal): Promise<ActivityEntry | undefined> {
  let entry: ActivityEntry | undefined;
  const res = await fetch(`/api/sessions/${id}/terminal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command }), signal });
  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? res.statusText);
  }
  let error: string | undefined;
  await readSse(res, (msg) => {
    if (msg.out) onOutput(msg.out);
    if (msg.error) error = msg.error;
    if (msg.done) entry = msg.entry;
  });
  if (error) throw new Error(error);
  return entry;
}

/** Sends a debrief message; streams the coach's reply. */
export async function streamDebrief(id: string, text: string, onDelta: (t: string) => void): Promise<{ sent?: DebriefEntry; reply?: DebriefEntry }> {
  const out: { sent?: DebriefEntry; reply?: DebriefEntry } = {};
  await postSse(`/api/sessions/${id}/debrief`, { text }, (msg) => {
    if (msg.delta) onDelta(msg.delta);
    else if (msg.done) out.reply = msg.entry;
    else if (msg.entry) out.sent = msg.entry;
  });
  return out;
}

/** Generates a lesson; streams the markdown as it's written and returns the saved lesson. */
export async function streamLesson(id: string, focus: string, onDelta: (t: string) => void): Promise<LessonMeta | undefined> {
  let lesson: LessonMeta | undefined;
  await postSse(`/api/sessions/${id}/lessons`, { focus }, (msg) => {
    if (msg.delta) onDelta(msg.delta);
    if (msg.done) lesson = msg.lesson;
  });
  return lesson;
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

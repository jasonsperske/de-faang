import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import type { AppConfig, Language, RunResult, SessionView, TestCase } from "../shared/types.ts";
import { LANGUAGES } from "../shared/types.ts";
import { ROOT, SESSIONS_DIR } from "./paths.ts";
import { getQuestion, loadQuestions, questionView, summarize } from "./questions.ts";
import { runCases, type LabeledCase } from "./runner/index.ts";
import { checkRunner, runnerMode } from "./runner/execute.ts";
import { getProvider, LLMError, providerInfo } from "./llm/index.ts";
import { buildChatMessages, interviewerSystemPrompt, summarizeRun, workspaceSnapshot } from "./interviewer.ts";
import { evaluate } from "./evaluator.ts";
import * as S from "./sessions.ts";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "warn" }, bodyLimit: 25 * 1024 * 1024 });

app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
  const status = err instanceof z.ZodError ? 400 : (err.statusCode ?? 500);
  if (status >= 500) app.log.error(err);
  reply.status(status).send({ error: err instanceof z.ZodError ? z.prettifyError(err) : err.message });
});

const Lang = z.enum(["python", "javascript", "typescript"]);
const IdParams = z.object({ id: z.string() });

// ---------------------------------------------------------------- config & library

app.get("/api/config", async (): Promise<AppConfig> => {
  const runner = await checkRunner();
  return { providers: providerInfo(), runner: runnerMode(), runnerReady: runner.ready, runnerMessage: runner.message };
});

app.get("/api/questions", async () => [...loadQuestions().values()].map(summarize));

// ---------------------------------------------------------------- sessions

function view(id: string): SessionView {
  const session = S.loadState(id);
  const q = getQuestion(session.questionId);
  const submitted = session.status !== "in_progress";
  let lastSubmit = submitted ? S.lastSubmit(id) : undefined;
  if (lastSubmit && session.config.strictness === "strict" && session.status !== "evaluated") lastSubmit = redact(lastSubmit);
  return {
    session,
    question: questionView(q, session.config.strictness, submitted),
    transcript: S.readTranscript(id),
    folder: path.relative(ROOT, path.join(SESSIONS_DIR, id)),
    lastSubmit,
  };
}

/** Strict mode: the candidate learns only how many tests passed until the evaluation is done. */
function redact(r: RunResult): RunResult {
  return { ...r, cases: [], stderr: undefined, redacted: true };
}

app.get("/api/sessions", async () => S.listSessions());

app.post("/api/sessions", async (req) => {
  const body = z
    .object({
      questionId: z.string(),
      provider: z.enum(["claude", "codex", "gemini", "muse"]),
      strictness: z.enum(["strict", "standard", "coach"]),
      verbosity: z.enum(["terse", "normal", "detailed"]),
      language: Lang.optional(),
    })
    .parse(req.body);
  getProvider(body.provider); // fail fast if the provider isn't configured
  const { questionId, ...config } = body;
  const state = S.createSession(questionId, config);
  return view(state.id);
});

app.get("/api/sessions/:id", async (req) => view(IdParams.parse(req.params).id));

app.get("/api/sessions/:id/report", async (req, reply) => {
  const { id } = IdParams.parse(req.params);
  const evaluation = S.loadEvaluation(id);
  if (!evaluation) return reply.status(404).send({ error: "Not evaluated yet" });
  return { evaluation, markdown: S.readReport(id), submit: S.lastSubmit(id) };
});

const Workspace = z.union([
  z.object({ language: Lang, code: z.string().max(200_000) }),
  z.object({
    markdown: z.string().max(500_000),
    scene: z.unknown().optional(),
    diagramSummary: z.string().max(100_000).default(""),
    png: z.string().optional(),
  }),
]);
type WorkspaceBody = z.infer<typeof Workspace>;

function applyWorkspace(state: ReturnType<typeof S.loadState>, ws: WorkspaceBody) {
  if (state.status !== "in_progress") return; // workspace is frozen after submit
  if ("code" in ws) S.saveCode(state, ws.language, ws.code);
  else S.saveDesign(state, ws.markdown, ws.scene, ws.diagramSummary, ws.png);
}

app.put("/api/sessions/:id/workspace", async (req) => {
  const state = S.loadState(IdParams.parse(req.params).id);
  applyWorkspace(state, Workspace.parse(req.body));
  return { ok: true };
});

// ---------------------------------------------------------------- run & submit

const CustomCase = z.object({ args: z.array(z.unknown()), ops: z.array(z.string()).optional() });

app.post("/api/sessions/:id/run", async (req) => {
  const { id } = IdParams.parse(req.params);
  const body = z
    .object({ language: Lang, code: z.string().max(200_000), includePublic: z.boolean().default(true), custom: z.array(CustomCase).max(20).default([]) })
    .parse(req.body);
  const state = S.loadState(id);
  const q = getQuestion(state.questionId);
  if (q.meta.type !== "coding") throw Object.assign(new Error("Nothing to run for system design"), { statusCode: 400 });
  if (state.status === "in_progress") S.saveCode(state, body.language, body.code);

  const strict = state.config.strictness === "strict";
  const cases: LabeledCase[] = [];
  if (body.includePublic && !strict) cases.push(...q.tests!.public.map((t) => ({ kind: "public" as const, test: t })));
  cases.push(...body.custom.map((c) => ({ kind: "custom" as const, test: c as TestCase })));
  if (!cases.length) throw Object.assign(new Error(strict ? "Strict mode: add your own test inputs to run." : "No test cases selected."), { statusCode: 400 });

  // In strict mode there are no expected values for custom inputs, just like a real interview.
  const result = await runCases(q, body.language, body.code, cases, { withReference: !strict });
  const rec = S.recordRun(state, body.language, body.code, result);
  return { result, run: rec.n, summary: summarizeRun(rec) };
});

app.post("/api/sessions/:id/submit", async (req) => {
  const { id } = IdParams.parse(req.params);
  const ws = Workspace.parse(req.body);
  const state = S.loadState(id);
  if (state.status !== "in_progress") throw Object.assign(new Error("Already submitted"), { statusCode: 409 });
  const q = getQuestion(state.questionId);
  applyWorkspace(state, ws);

  if (q.meta.type === "coding" && "code" in ws) {
    const cases: LabeledCase[] = [
      ...q.tests!.public.map((t) => ({ kind: "public" as const, test: t })),
      ...q.tests!.hidden.map((t) => ({ kind: "hidden" as const, test: t })),
    ];
    const result = await runCases(q, ws.language, ws.code, cases, { withReference: false });
    S.recordRun(state, ws.language, ws.code, result, true);
    const ext = LANGUAGES.find((l) => l.id === ws.language)!.ext;
    S.writeEvidence(id, `submission.${ext}`, ws.code);
    S.writeEvidence(id, "test-results.json", JSON.stringify(result, null, 2));
    S.writeEvidence(id, "run-history.md", S.listRuns(id).map(summarizeRun).join("\n\n") + "\n");
  } else if ("markdown" in ws) {
    S.writeEvidence(id, "design.md", ws.markdown);
    if (ws.scene) S.writeEvidence(id, "design.excalidraw", JSON.stringify({ type: "excalidraw", version: 2, source: "de-faang", ...(ws.scene as object) }, null, 2));
    if (ws.png) S.writeEvidence(id, "design.png", Buffer.from(ws.png, "base64"));
    S.writeEvidence(id, "diagram-summary.md", ws.diagramSummary);
  }
  state.status = "followups";
  state.submittedAt = new Date().toISOString();
  S.saveState(state);
  S.appendTranscript(id, { role: "event", text: "The candidate submitted their solution. The round now moves to written follow-up questions." });
  S.writeEvidence(id, "transcript.md", S.transcriptMarkdown(S.readTranscript(id)));
  return view(id);
});

app.post("/api/sessions/:id/followups", async (req) => {
  const { id } = IdParams.parse(req.params);
  const { answers } = z.object({ answers: z.array(z.string().max(50_000)) }).parse(req.body);
  const state = S.loadState(id);
  if (state.status !== "followups") throw Object.assign(new Error("Follow-ups are not open"), { statusCode: 409 });
  const q = getQuestion(state.questionId);
  state.followUpAnswers = answers;
  S.saveState(state);
  S.writeEvidence(id, "followups.md", q.meta.followUps.map((fq, i) => `## Q${i + 1}. ${fq}\n\n${answers[i]?.trim() || "_(no answer)_"}\n`).join("\n"));
  return { ok: true };
});

app.post("/api/sessions/:id/evaluate", async (req) => {
  const { id } = IdParams.parse(req.params);
  const state = S.loadState(id);
  if (state.status !== "followups") throw Object.assign(new Error(`Cannot evaluate a session in state ${state.status}`), { statusCode: 409 });
  const q = getQuestion(state.questionId);
  state.status = "evaluating";
  S.saveState(state);
  try {
    S.writeEvidence(id, "transcript.md", S.transcriptMarkdown(S.readTranscript(id)));
    const { evaluation, report } = await evaluate(q, state);
    S.saveEvaluation(id, evaluation, report);
    state.status = "evaluated";
    state.evaluatedAt = new Date().toISOString();
    S.saveState(state);
    return { evaluation, markdown: report };
  } catch (err) {
    state.status = "followups";
    S.saveState(state);
    throw err;
  }
});

// ---------------------------------------------------------------- interviewer chat (SSE)

function sse(reply: FastifyReply) {
  reply.hijack();
  reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  return (data: unknown) => reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

const busy = new Set<string>();

app.post("/api/sessions/:id/chat", async (req, reply) => {
  const { id } = IdParams.parse(req.params);
  const body = z
    .object({ kind: z.enum(["message", "hint", "open", "run"]), text: z.string().max(20_000).optional(), workspace: Workspace.optional() })
    .parse(req.body);
  const state = S.loadState(id);
  const q = getQuestion(state.questionId);
  if (state.status === "evaluating" || state.status === "evaluated") throw Object.assign(new Error("This round is over."), { statusCode: 409 });
  if (busy.has(id)) throw Object.assign(new Error("The interviewer is still replying."), { statusCode: 429 });
  if (body.workspace) applyWorkspace(state, body.workspace);

  let transcript = S.readTranscript(id);
  switch (body.kind) {
    case "open":
      if (transcript.length) return reply.send({ skipped: true });
      S.appendTranscript(id, { role: "event", text: "The candidate joined the interview room. Greet them briefly, set expectations for the round, and invite them to begin." });
      break;
    case "hint":
      state.hintsRequested += 1;
      S.saveState(state);
      S.appendTranscript(id, { role: "candidate", text: body.text?.trim() || "Could I get a hint?" });
      break;
    case "run": {
      // Proactive feedback on test runs is a coach-mode feature.
      if (state.config.strictness !== "coach") return reply.send({ skipped: true });
      const last = S.listRuns(id).filter((r) => !r.submit).at(-1);
      S.appendTranscript(id, { role: "event", text: `The candidate ran their code. ${last ? summarizeRun(last) : ""} React briefly if useful.` });
      break;
    }
    case "message":
      if (!body.text?.trim()) throw Object.assign(new Error("Empty message"), { statusCode: 400 });
      S.appendTranscript(id, { role: "candidate", text: body.text.trim() });
      break;
  }
  transcript = S.readTranscript(id);

  const send = sse(reply);
  const abort = new AbortController();
  reply.raw.on("close", () => abort.abort());
  busy.add(id);
  try {
    const provider = getProvider(state.config.provider);
    const messages = buildChatMessages(transcript, workspaceSnapshot(q, state, S.listRuns(id)));
    const text = await provider.chat(
      { system: interviewerSystemPrompt(q, state), messages, effort: state.config.strictness === "coach" ? "medium" : "low" },
      (delta) => send({ delta }),
      abort.signal,
    );
    if (text.trim()) {
      const entry = S.appendTranscript(id, { role: "interviewer", text });
      send({ done: true, entry });
    } else send({ done: true });
  } catch (err) {
    const msg = err instanceof LLMError ? err.message : `Interviewer error: ${(err as Error).message}`;
    app.log.error(err);
    send({ error: msg });
  } finally {
    busy.delete(id);
    reply.raw.end();
  }
});

// ---------------------------------------------------------------- static UI (production)

const webDist = path.join(ROOT, "dist", "web");
if (fs.existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  app.setNotFoundHandler((req, reply) => (req.url.startsWith("/api/") ? reply.status(404).send({ error: "Not found" }) : reply.sendFile("index.html")));
}

const port = Number(process.env.PORT ?? 4317);
loadQuestions(); // validate the library at startup
fs.mkdirSync(SESSIONS_DIR, { recursive: true });
checkRunner().then((r) => r.message && console.log(`[runner] ${r.message}`));
await app.listen({ port, host: "127.0.0.1" });
const ui = process.env.NODE_ENV === "production" ? `http://localhost:${port}` : "http://localhost:5173";
console.log(`de-faang API on http://localhost:${port} · open ${ui}`);
const p = providerInfo();
console.log(`Providers: ${p.map((x) => `${x.id}=${x.available ? x.model : "no key"}`).join(", ")} · runner=${runnerMode()}`);

export type { Language };

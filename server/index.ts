import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Fastify, { type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import type { AppConfig, Language, RunResult, SessionView, TestCase } from "../shared/types.ts";
import { LANGUAGES, LANGUAGE_IDS } from "../shared/types.ts";
import { ROOT, SESSIONS_DIR } from "./paths.ts";
import { getQuestion, loadQuestions, questionView, summarize, type Question } from "./questions.ts";
import { addPartStub } from "./runner/starters.ts";
import { mergeResults, runCases, type LabeledCase } from "./runner/index.ts";
import { checkRunner, runnerMode } from "./runner/execute.ts";
import { getProvider, LLMError, providerInfo } from "./llm/index.ts";
import { buildChatMessages, interviewerSystemPrompt, summarizeRun, workspaceSnapshot } from "./interviewer.ts";
import { evaluate } from "./evaluator.ts";
import * as S from "./sessions.ts";
import { allLessons, appendDebrief, debriefMessages, debriefSystemPrompt, lessonSystemPrompt, listLessons, readDebrief, readLesson, saveLesson } from "./debrief.ts";
import { aiTimeline, aiUsage, assistantMessages, assistantSystemPrompt, composePrompt, DEFAULT_POLICY, loadPolicies, usageLine } from "./assistant.ts";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "warn" }, bodyLimit: 25 * 1024 * 1024 });

app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
  const status = err instanceof z.ZodError ? 400 : (err.statusCode ?? 500);
  if (status >= 500) app.log.error(err);
  reply.status(status).send({ error: err instanceof z.ZodError ? z.prettifyError(err) : err.message });
});

const Lang = z.enum(LANGUAGE_IDS);
const IdParams = z.object({ id: z.string() });

// ---------------------------------------------------------------- config & library

app.get("/api/config", async (): Promise<AppConfig> => {
  const runner = await checkRunner();
  return { providers: providerInfo(), runner: runnerMode(), runnerReady: runner.ready, runnerMessage: runner.message, pendingLanguages: runner.pending, aiPolicies: loadPolicies() };
});

app.get("/api/questions", async () => [...loadQuestions().values()].map(summarize));

// ---------------------------------------------------------------- sessions

function view(id: string): SessionView {
  const session = S.loadState(id);
  const q = getQuestion(session.questionId);
  const submitted = session.status !== "in_progress";
  const hide = session.config.strictness === "strict" && session.status !== "evaluated";
  let lastSubmit = submitted ? S.lastSubmit(id) : undefined;
  if (lastSubmit && hide) lastSubmit = redact(lastSubmit);
  const part = session.part ?? 0;
  let lastPartResult = !submitted && part > 0 ? S.partSubmit(id, part - 1) : undefined;
  if (lastPartResult && hide) lastPartResult = redact(lastPartResult);
  return {
    session,
    question: questionView(q, session.config.strictness, submitted, part),
    transcript: S.readTranscript(id),
    folder: path.relative(ROOT, path.join(SESSIONS_DIR, id)),
    lastSubmit,
    lastPartResult,
    ai: session.config.format === "ai" ? S.readAiLog(id) : undefined,
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
      format: z.enum(["classic", "ai"]).default("classic"),
      aiPolicy: z.string().optional(),
      aiSystemPrompt: z.string().max(20_000).optional(),
    })
    .parse(req.body);
  getProvider(body.provider); // fail fast if the provider isn't configured
  const { questionId, ...config } = body;
  if (config.format === "ai") {
    if (getQuestion(questionId).meta.type !== "coding") throw Object.assign(new Error("AI-assisted rounds are for coding questions."), { statusCode: 400 });
    const policies = loadPolicies();
    const policy = policies.find((p) => p.id === (config.aiPolicy ?? DEFAULT_POLICY)) ?? policies[0];
    if (!policy && !config.aiSystemPrompt?.trim()) throw Object.assign(new Error("No AI policies found in ai-policies/."), { statusCode: 500 });
    config.aiPolicy = config.aiSystemPrompt?.trim() && config.aiSystemPrompt.trim() !== policy?.prompt ? `${policy?.id ?? "custom"} (edited)` : policy!.id;
    config.aiSystemPrompt = config.aiSystemPrompt?.trim() || policy!.prompt;
  } else {
    delete config.aiPolicy;
    delete config.aiSystemPrompt;
  }
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
  const part = state.part ?? 0;
  const cases: LabeledCase[] = [];
  if (body.includePublic && !strict) cases.push(...q.parts[part].tests.public.map((t) => ({ kind: "public" as const, test: t })));
  cases.push(...body.custom.map((c) => ({ kind: "custom" as const, test: c as TestCase })));
  if (!cases.length) throw Object.assign(new Error(strict ? "Strict mode: add your own test inputs to run." : "No test cases selected."), { statusCode: 400 });

  // In strict mode there are no expected values for custom inputs, just like a real interview.
  const result = await runCases(q, body.language, body.code, cases, { withReference: !strict, part });
  const rec = S.recordRun(state, body.language, body.code, result, false, { part: q.multipart ? part : undefined });
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
    // Multipart: every part reached so far is graded against the final code.
    const reached = q.parts.slice(0, (state.part ?? 0) + 1);
    const result = mergeResults(await Promise.all(reached.map((p) => runCases(q, ws.language, ws.code, allTests(p), { withReference: false, part: p.index }))));
    S.recordRun(state, ws.language, ws.code, result, true);
    const ext = LANGUAGES.find((l) => l.id === ws.language)!.ext;
    S.writeEvidence(id, `submission.${ext}`, ws.code);
    S.writeEvidence(id, "test-results.json", JSON.stringify(result, null, 2));
    S.writeEvidence(id, "run-history.md", S.listRuns(id).map(summarizeRun).join("\n\n") + "\n");
    if (state.config.format === "ai") writeAiEvidence(state, ws.code);
  } else if ("markdown" in ws) {
    S.writeEvidence(id, "design.md", ws.markdown);
    if (ws.scene) S.writeEvidence(id, "design.excalidraw", JSON.stringify({ type: "excalidraw", version: 2, source: "de-faang", ...(ws.scene as object) }, null, 2));
    if (ws.png) S.writeEvidence(id, "design.png", Buffer.from(ws.png, "base64"));
    S.writeEvidence(id, "diagram-summary.md", ws.diagramSummary);
  }
  state.status = "followups";
  state.submittedAt = new Date().toISOString();
  S.saveState(state);
  const unreached = q.multipart ? q.parts.length - 1 - (state.part ?? 0) : 0;
  S.appendTranscript(id, {
    role: "event",
    text: `The candidate submitted their solution${unreached ? ` without reaching the last ${unreached === 1 ? "part" : `${unreached} parts`}` : ""}. The round now moves to written follow-up questions.`,
  });
  S.writeEvidence(id, "transcript.md", S.transcriptMarkdown(S.readTranscript(id)));
  return view(id);
});

/** AI-assisted rounds: the assistant's instructions, the full log, and usage stats, frozen at submit. */
function writeAiEvidence(state: ReturnType<typeof S.loadState>, finalCode: string) {
  const log = S.readAiLog(state.id);
  const usage = aiUsage(log, finalCode);
  S.writeEvidence(state.id, "ai-log.jsonl", log.map((e) => JSON.stringify(e)).join("\n") + (log.length ? "\n" : ""));
  S.writeEvidence(
    state.id,
    "ai-usage.md",
    `# AI assistant usage\n\nHelpfulness policy: ${state.config.aiPolicy}\n\n${usageLine(usage)}\n\n## System prompt\n\n\`\`\`\n${assistantSystemPrompt(state.config.aiSystemPrompt ?? "")}\n\`\`\`\n\n## Timeline\n\n${aiTimeline(state, log, 100_000) || "_The candidate didn't use the assistant._"}\n`,
  );
}

const allTests = (p: Question["parts"][number]): LabeledCase[] => [
  ...p.tests.public.map((t) => ({ kind: "public" as const, test: t })),
  ...p.tests.hidden.map((t) => ({ kind: "hidden" as const, test: t })),
];

/**
 * Multipart: hands in the current part. Its public and hidden tests run, the result is saved, the
 * next part is revealed, and its stub is added to the candidate's code in every language.
 */
app.post("/api/sessions/:id/next-part", async (req) => {
  const { id } = IdParams.parse(req.params);
  const ws = z.object({ language: Lang, code: z.string().max(200_000) }).parse(req.body);
  const state = S.loadState(id);
  const q = getQuestion(state.questionId);
  const part = state.part ?? 0;
  if (state.status !== "in_progress") throw Object.assign(new Error("Already submitted"), { statusCode: 409 });
  if (!q.multipart || part >= q.parts.length - 1) throw Object.assign(new Error("This is the last part. Submit instead."), { statusCode: 400 });
  S.saveCode(state, ws.language, ws.code);

  const result = await runCases(q, ws.language, ws.code, allTests(q.parts[part]), { withReference: false, part });
  S.recordRun(state, ws.language, ws.code, result, false, { part, partSubmit: true });
  const next = q.parts[part + 1];
  state.partResults = [...(state.partResults ?? []), { part, at: new Date().toISOString(), passed: result.passed, total: result.total }];
  state.part = part + 1;
  for (const [l, code] of Object.entries(state.code ?? {}) as [Language, string][]) {
    if (next.signature.entry[l]) state.code![l] = addPartStub(l, code, next.signature, next.signature.entry[l]!);
  }
  S.saveCode(state, ws.language, state.code![ws.language]!); // also saves state
  const ext = LANGUAGES.find((l) => l.id === ws.language)!.ext;
  S.writeEvidence(id, `part-${part + 1}-submission.${ext}`, ws.code);
  S.writeEvidence(id, `part-${part + 1}-test-results.json`, JSON.stringify(result, null, 2));
  const outcome = result.ok ? `${result.passed}/${result.total} of its tests passed` : "the code did not compile or run";
  S.appendTranscript(id, {
    role: "event",
    text: `The candidate finished part ${part + 1} ("${q.parts[part].title}"); ${outcome}. Part ${part + 2} of ${q.parts.length} ("${next.title}") is now on their screen. Introduce it briefly and let them start.`,
  });
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

// ---------------------------------------------------------------- AI assistant (AI-assisted rounds)

const assistantBusy = new Set<string>();

function aiSession(id: string) {
  const state = S.loadState(id);
  if (state.config.format !== "ai") throw Object.assign(new Error("This round doesn't have an AI assistant."), { statusCode: 400 });
  if (state.status !== "in_progress") throw Object.assign(new Error("The round is over; the assistant is closed."), { statusCode: 409 });
  return state;
}

app.post("/api/sessions/:id/assistant", async (req, reply) => {
  const { id } = IdParams.parse(req.params);
  const body = z
    .object({
      text: z.string().min(1).max(20_000),
      attachProblem: z.boolean(),
      attachCode: z.boolean(),
      language: Lang,
      code: z.string().max(200_000),
    })
    .parse(req.body);
  const state = aiSession(id);
  const q = getQuestion(state.questionId);
  if (assistantBusy.has(id)) throw Object.assign(new Error("The assistant is still replying."), { statusCode: 429 });
  if (!body.text.trim()) throw Object.assign(new Error("Empty message"), { statusCode: 400 });
  S.saveCode(state, body.language, body.code);

  const sent = composePrompt(q, state, body);
  const messages = assistantMessages(S.readAiLog(id), sent);
  const prompt = S.appendAiLog(id, { kind: "prompt", at: new Date().toISOString(), text: body.text, attachProblem: body.attachProblem, attachCode: body.attachCode, language: body.language, sent });

  const send = sse(reply);
  const abort = new AbortController();
  reply.raw.on("close", () => abort.abort());
  assistantBusy.add(id);
  try {
    send({ prompt });
    const provider = getProvider(state.config.provider);
    const text = await provider.chat({ system: assistantSystemPrompt(state.config.aiSystemPrompt ?? ""), messages, effort: "medium" }, (delta) => send({ delta }), abort.signal);
    const entry = S.appendAiLog(id, { kind: "response", at: new Date().toISOString(), text });
    send({ done: true, entry });
  } catch (err) {
    const msg = err instanceof LLMError ? err.message : `Assistant error: ${(err as Error).message}`;
    app.log.error(err);
    S.appendAiLog(id, { kind: "response", at: new Date().toISOString(), text: "", error: msg });
    send({ error: msg });
  } finally {
    assistantBusy.delete(id);
    reply.raw.end();
  }
});

/** What the candidate did with the assistant's output: insert, replace, copy, paste, or a new chat. */
app.post("/api/sessions/:id/ai-events", async (req) => {
  const { id } = IdParams.parse(req.params);
  const e = z
    .discriminatedUnion("kind", [
      z.object({ kind: z.enum(["insert", "replace", "copy"]), code: z.string().max(200_000), source: z.enum(["button", "selection"]).default("button") }),
      z.object({ kind: z.literal("paste"), code: z.string().max(200_000), fromAi: z.boolean() }),
      z.object({ kind: z.literal("reset") }),
    ])
    .parse(req.body);
  aiSession(id);
  const at = new Date().toISOString();
  const lines = "code" in e ? e.code.split("\n").length : 0;
  const entry = S.appendAiLog(id, e.kind === "reset" ? { kind: "reset", at } : e.kind === "paste" ? { ...e, at, lines } : { ...e, at, lines });
  return { entry };
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
    .object({ kind: z.enum(["message", "hint", "open", "run", "pending"]), text: z.string().max(20_000).optional(), workspace: Workspace.optional() })
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
    case "pending":
      // An event (e.g. moving to the next part) is waiting at the end of the transcript; the interviewer responds to it.
      if (transcript.at(-1)?.role !== "event") return reply.send({ skipped: true });
      break;
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
    const messages = buildChatMessages(transcript, workspaceSnapshot(q, state, S.listRuns(id), state.config.format === "ai" ? S.readAiLog(id) : undefined));
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

// ---------------------------------------------------------------- debrief & lessons (after evaluation)

const debriefBusy = new Set<string>();

function evaluatedSession(id: string) {
  const state = S.loadState(id);
  if (state.status !== "evaluated") throw Object.assign(new Error("The debrief opens once the round has been evaluated."), { statusCode: 409 });
  if (debriefBusy.has(id)) throw Object.assign(new Error("The coach is still replying."), { statusCode: 429 });
  return state;
}

app.get("/api/sessions/:id/debrief", async (req) => {
  const { id } = IdParams.parse(req.params);
  S.loadState(id);
  return { messages: readDebrief(id), lessons: listLessons(id) };
});

app.post("/api/sessions/:id/debrief", async (req, reply) => {
  const { id } = IdParams.parse(req.params);
  const { text } = z.object({ text: z.string().trim().min(1).max(20_000) }).parse(req.body);
  const state = evaluatedSession(id);
  const q = getQuestion(state.questionId);
  const entry = appendDebrief(id, { role: "candidate", text });
  const send = sse(reply);
  const abort = new AbortController();
  reply.raw.on("close", () => abort.abort());
  debriefBusy.add(id);
  try {
    send({ entry });
    const provider = getProvider(state.config.provider);
    const out = await provider.chat({ system: debriefSystemPrompt(q, state), messages: debriefMessages(readDebrief(id)), effort: "medium" }, (delta) => send({ delta }), abort.signal);
    send({ done: true, entry: appendDebrief(id, { role: "coach", text: out }) });
  } catch (err) {
    app.log.error(err);
    send({ error: err instanceof LLMError ? err.message : `Coach error: ${(err as Error).message}` });
  } finally {
    debriefBusy.delete(id);
    reply.raw.end();
  }
});

/** Writes a lesson from the round, its evaluation and the debrief so far (streamed as it's written). */
app.post("/api/sessions/:id/lessons", async (req, reply) => {
  const { id } = IdParams.parse(req.params);
  const { focus } = z.object({ focus: z.string().max(2_000).optional() }).parse(req.body ?? {});
  const state = evaluatedSession(id);
  const q = getQuestion(state.questionId);
  const send = sse(reply);
  const abort = new AbortController();
  reply.raw.on("close", () => abort.abort());
  debriefBusy.add(id);
  try {
    const provider = getProvider(state.config.provider);
    const markdown = await provider.chat(
      {
        system: lessonSystemPrompt(q, state, readDebrief(id), focus),
        messages: [{ role: "user", content: focus?.trim() ? `Write the lesson, focused on: ${focus.trim()}` : "Write the lesson." }],
        effort: "high",
      },
      (delta) => send({ delta }),
      abort.signal,
    );
    if (!markdown.trim()) throw new LLMError("The lesson came back empty. Try again.");
    send({ done: true, lesson: saveLesson(state, q, markdown, { focus, provider: provider.id, model: provider.model }) });
  } catch (err) {
    app.log.error(err);
    send({ error: err instanceof LLMError ? err.message : `Lesson error: ${(err as Error).message}` });
  } finally {
    debriefBusy.delete(id);
    reply.raw.end();
  }
});

const LessonParams = z.object({ id: z.string(), lessonId: z.string() });

app.get("/api/sessions/:id/lessons/:lessonId", async (req) => {
  const { id, lessonId } = LessonParams.parse(req.params);
  return readLesson(id, lessonId);
});

app.get("/api/sessions/:id/lessons/:lessonId/download", async (req, reply) => {
  const { id, lessonId } = LessonParams.parse(req.params);
  const { lesson, markdown } = readLesson(id, lessonId);
  const name = `${lesson.questionId}-${lesson.id}.md`;
  return reply.header("Content-Type", "text/markdown; charset=utf-8").header("Content-Disposition", `attachment; filename="${name}"`).send(markdown);
});

app.get("/api/lessons", async () => allLessons());

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

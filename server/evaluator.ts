import fs from "node:fs";
import path from "node:path";
import type { Evaluation, HireDecision, SessionState } from "../shared/types.ts";
import { LANGUAGES } from "../shared/types.ts";
import { getProvider, type ContentPart } from "./llm/index.ts";
import { ROOT } from "./paths.ts";
import type { Question } from "./questions.ts";
import { elapsedMinutes, summarizeRun } from "./interviewer.ts";
import { designPng, lastSubmit, listRuns, readTranscript, transcriptMarkdown, writeEvidence } from "./sessions.ts";

interface Rubric {
  id: string;
  name: string;
  scale: Record<string, string>;
  dimensions: { id: string; name: string; weight: number; signals: string; levels: Record<string, string>; resources: string[] }[];
}
interface Resource {
  id: string;
  title: string;
  url: string;
  topics: string[];
}

export const loadRubric = (id: string): Rubric => JSON.parse(fs.readFileSync(path.join(ROOT, "rubrics", `${id}.json`), "utf8"));
export const loadResources = (): Resource[] => JSON.parse(fs.readFileSync(path.join(ROOT, "resources", "resources.json"), "utf8"));

interface RawEvaluation {
  summary: string;
  dimensions: { id: string; score: number; evidence: string[]; feedback: string }[];
  strengths: string[];
  improvements: string[];
  followUpFeedback: { question: string; assessment: string }[];
  modelAnswerSketch: string;
  studyTopics: string[];
  resources: { id: string; why: string }[];
}

function schema(rubric: Rubric, resources: Resource[]) {
  const str = { type: "string" };
  const strArr = { type: "array", items: str };
  const obj = (properties: Record<string, unknown>) => ({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
  return obj({
    summary: str,
    dimensions: {
      type: "array",
      items: obj({
        id: { type: "string", enum: rubric.dimensions.map((d) => d.id) },
        score: { type: "integer", enum: [1, 2, 3, 4] },
        evidence: strArr,
        feedback: str,
      }),
    },
    strengths: strArr,
    improvements: strArr,
    followUpFeedback: { type: "array", items: obj({ question: str, assessment: str }) },
    modelAnswerSketch: str,
    studyTopics: strArr,
    resources: { type: "array", items: obj({ id: { type: "string", enum: resources.map((r) => r.id) }, why: str }) },
  });
}

const LENGTH = {
  terse: "Be concise: 1–2 evidence quotes per dimension, feedback of 1–2 sentences, at most 3 strengths and 3 improvements, and a short model-answer sketch.",
  normal: "Be specific: 2–3 evidence quotes per dimension, feedback of 2–4 sentences, 3–5 strengths and improvements, and a model-answer sketch of moderate length.",
  detailed: "Be thorough: 2–4 evidence quotes per dimension, detailed and actionable feedback, up to 6 strengths and improvements, and a complete model-answer sketch (for coding, include clean reference code with complexity; for design, include the key components, data model, and tradeoffs).",
};

export function decisionFor(score: number): HireDecision {
  if (score >= 3.5) return "strong_hire";
  if (score >= 3.0) return "hire";
  if (score >= 2.5) return "lean_hire";
  if (score >= 2.0) return "lean_no_hire";
  return "no_hire";
}

export const DECISION_LABEL: Record<HireDecision, string> = {
  strong_hire: "Strong Hire",
  hire: "Hire",
  lean_hire: "Lean Hire",
  lean_no_hire: "Lean No Hire",
  no_hire: "No Hire",
};

/** Assembles the evaluation packet as a markdown document, and writes a copy into evidence/. */
export function buildPacket(q: Question, state: SessionState): string {
  const transcript = readTranscript(state.id);
  const runs = listRuns(state.id);
  const submit = lastSubmit(state.id);
  const s: string[] = [];
  s.push(`# Interview packet: ${q.meta.title} (${q.meta.type}, ${q.meta.difficulty})`);
  s.push(
    `## Session\n- Mode: ${state.config.strictness} · Verbosity: ${state.config.verbosity}\n- Suggested duration: ${q.meta.durationMinutes} min · Time to submit: ${
      state.submittedAt ? Math.round((Date.parse(state.submittedAt) - Date.parse(state.createdAt)) / 60000) : elapsedMinutes(state)
    } min\n- Hints requested: ${state.hintsRequested} · Test runs before submit: ${state.runs}`,
  );
  if (q.multipart) {
    const reached = (state.part ?? 0) + 1;
    s.push(
      `## Progress\nMultipart question: the candidate reached part ${reached} of ${q.parts.length}.\n${q.parts
        .map((p) => {
          const r = state.partResults?.find((x) => x.part === p.index);
          const min = r ? Math.round((Date.parse(r.at) - Date.parse(state.createdAt)) / 60000) : undefined;
          const status = r ? `handed in at minute ${min} with ${r.passed}/${r.total} tests passing` : p.index < reached ? "worked on until the final submission" : "not reached";
          return `- Part ${p.index + 1} (${p.title}${p.durationMinutes ? `, ~${p.durationMinutes} min` : ""}): ${status}`;
        })
        .join("\n")}\nGrade what was attempted; not reaching later parts is itself evidence about speed and problem solving.`,
    );
    s.push(`## Question as presented\n${q.prompt}\n\n${q.parts.map((p) => `### Part ${p.index + 1}: ${p.title}${p.index < reached ? "" : " (not reached)"}\n${p.prompt}`).join("\n\n")}`);
    s.push(
      `## Interviewer reference notes\n${q.parts
        .map((p) => `### Part ${p.index + 1}\nExpected approach: ${p.interviewer.approach}\n\nPitfalls:\n${p.interviewer.pitfalls.map((x) => `- ${x}`).join("\n")}`)
        .join("\n\n")}${q.meta.interviewer.approach ? `\n\n### Whole round\n${q.meta.interviewer.approach}` : ""}`,
    );
  } else {
    s.push(`## Question as presented\n${q.prompt}`);
    s.push(
      `## Interviewer reference notes\nExpected approach: ${q.meta.interviewer.approach}\n\nPitfalls:\n${q.meta.interviewer.pitfalls.map((p) => `- ${p}`).join("\n")}${
        q.meta.interviewer.facts.length ? `\n\nFacts available on request:\n${q.meta.interviewer.facts.map((f) => `- ${f}`).join("\n")}` : ""
      }`,
    );
  }
  if (q.meta.type === "coding") {
    const lang = state.config.language ?? "python";
    s.push(`## Final submission (${LANGUAGES.find((l) => l.id === lang)!.label})\n\`\`\`${lang}\n${state.code?.[lang] ?? ""}\n\`\`\``);
    if (submit) {
      const lines = submit.cases.map(
        (c) =>
          `- [${c.passed ? "PASS" : "FAIL"}] ${c.part !== undefined ? `part ${c.part + 1} ` : ""}${c.kind} ${c.name ?? c.index}: args=${JSON.stringify(c.args).slice(0, 300)}${
            c.passed ? "" : c.error ? ` → error: ${c.error.split("\n")[0]}` : ` → got ${JSON.stringify(c.output)?.slice(0, 200)}, expected ${JSON.stringify(c.expected)?.slice(0, 200)}`
          }`,
      );
      s.push(
        `## Submission test results: ${submit.passed}/${submit.total} passed (public + hidden${q.multipart ? ", every part reached, run on the final code" : ""})\n${submit.ok ? lines.join("\n") : `Did not run: ${submit.compileError}`}`,
      );
    }
    const history = runs.filter((r) => !r.submit);
    s.push(`## Run history (${history.filter((r) => !r.partSubmit).length} runs${q.multipart ? ", plus part hand-ins" : ""})\n${history.map(summarizeRun).join("\n") || "The candidate never ran their code before submitting."}`);
  } else {
    s.push(`## Candidate design notes\n${state.design?.markdown ?? "(empty)"}`);
    s.push(`## Whiteboard (extracted shapes/arrows; image attached separately when available)\n${state.design?.diagramSummary || "(empty)"}`);
  }
  s.push(`## Interview transcript\n${transcriptMarkdown(transcript) || "(no conversation)"}`);
  const answers = state.followUpAnswers ?? [];
  s.push(`## Written follow-up answers\n${q.meta.followUps.map((fq, i) => `### Q${i + 1}. ${fq}\n${answers[i]?.trim() || "_(no answer)_"}`).join("\n\n")}`);
  const packet = s.join("\n\n");
  writeEvidence(state.id, "packet.md", packet);
  return packet;
}

export async function evaluate(q: Question, state: SessionState): Promise<{ evaluation: Evaluation; report: string }> {
  const rubric = loadRubric(q.meta.rubric);
  const resources = loadResources();
  const provider = getProvider(state.config.provider);
  const packet = buildPacket(q, state);

  const system = `You are a calibrated hiring-committee reviewer at a top technology company. You evaluate one ${q.meta.type} interview packet against a rubric and write feedback that helps the candidate improve.

Principles:
- Grade against the real FAANG bar regardless of practice mode. In coach or standard mode, hints and help are expected, but heavy reliance on hints lowers the problem-solving score. Say so kindly.
- Every score must be justified with evidence: short quotes or concrete observations from the packet (code lines, transcript, test results, follow-up answers). Never invent evidence.
- Hidden test results are ground truth for correctness.
- Be direct and kind. The goal is to take the fear out of these interviews: name what went well, then give specific, actionable improvements.
- Score each rubric dimension on the 1–4 scale, using every dimension exactly once.
- For followUpFeedback, assess each written follow-up answer (including unanswered ones).
- Recommend 3–6 resources ONLY from the provided library (by id), each with a one-sentence reason tied to a gap you observed. studyTopics lists concepts to study (free text).
- ${LENGTH[state.config.verbosity]}

RUBRIC (${rubric.name}):
Scale: ${Object.entries(rubric.scale).map(([k, v]) => `${k} = ${v}`).join(" | ")}
${rubric.dimensions
  .map(
    (d) => `- ${d.id} — ${d.name} (weight ${d.weight})\n  Signals: ${d.signals}\n  Levels: ${Object.entries(d.levels).map(([k, v]) => `${k}: ${v}`).join(" / ")}`,
  )
  .join("\n")}

RESOURCE LIBRARY (id — title — topics):
${resources.map((r) => `- ${r.id} — ${r.title} — ${r.topics.join(", ")}`).join("\n")}`;

  const content: ContentPart[] = [];
  const png = q.meta.type === "system-design" ? designPng(state.id) : undefined;
  if (png) content.push({ type: "image", mediaType: "image/png", base64: png });
  content.push({ type: "text", text: `${png ? "The image above is the candidate's whiteboard diagram.\n\n" : ""}${packet}\n\nEvaluate this packet now.` });

  const raw = await provider.json<RawEvaluation>({
    system,
    messages: [{ role: "user", content }],
    schema: schema(rubric, resources),
    schemaName: "interview_evaluation",
    effort: "high",
  });

  const dims = rubric.dimensions.map((d) => {
    const r = raw.dimensions.find((x) => x.id === d.id);
    return {
      id: d.id,
      name: d.name,
      weight: d.weight,
      score: Math.min(4, Math.max(1, Math.round(r?.score ?? 1))),
      evidence: r?.evidence ?? [],
      feedback: r?.feedback ?? "Not assessed.",
    };
  });
  const totalWeight = dims.reduce((a, d) => a + d.weight, 0);
  const weightedScore = Math.round((dims.reduce((a, d) => a + d.score * d.weight, 0) / totalWeight) * 100) / 100;
  const byId = new Map(resources.map((r) => [r.id, r]));
  const evaluation: Evaluation = {
    summary: raw.summary,
    decision: decisionFor(weightedScore),
    weightedScore,
    dimensions: dims,
    strengths: raw.strengths,
    improvements: raw.improvements,
    followUpFeedback: raw.followUpFeedback,
    modelAnswerSketch: raw.modelAnswerSketch,
    studyTopics: raw.studyTopics,
    resources: raw.resources.flatMap((r) => {
      const res = byId.get(r.id);
      return res ? [{ id: res.id, title: res.title, url: res.url, why: r.why }] : [];
    }),
    provider: provider.id,
    model: provider.model,
  };
  return { evaluation, report: renderReport(q, state, evaluation) };
}

export function renderReport(q: Question, state: SessionState, e: Evaluation): string {
  const bar = (n: number) => "●".repeat(n) + "○".repeat(4 - n);
  return `# ${q.meta.title}: interview feedback

**Result: ${DECISION_LABEL[e.decision]}** (weighted score ${e.weightedScore.toFixed(2)} / 4)
Mode: ${state.config.strictness} · ${q.meta.type}${state.config.language && q.meta.type === "coding" ? ` · ${state.config.language}` : ""} · evaluated by ${e.provider} (${e.model}) on ${new Date().toISOString().slice(0, 10)}

${e.summary}

## Scorecard

| Dimension | Score | Weight |
|---|---|---|
${e.dimensions.map((d) => `| ${d.name} | ${bar(d.score)} ${d.score}/4 | ${Math.round(d.weight * 100)}% |`).join("\n")}

${e.dimensions
  .map((d) => `### ${d.name}: ${d.score}/4\n${d.feedback}\n\n${d.evidence.map((x) => `> ${x.replace(/\n/g, " ")}`).join("\n>\n")}`)
  .join("\n\n")}

## What went well
${e.strengths.map((s) => `- ${s}`).join("\n")}

## What to work on
${e.improvements.map((s) => `- ${s}`).join("\n")}

## Follow-up answers
${e.followUpFeedback.map((f) => `**${f.question}**\n\n${f.assessment}`).join("\n\n")}

## Model answer sketch
${e.modelAnswerSketch}

## Study next
${e.studyTopics.map((t) => `- ${t}`).join("\n")}

### Resources
${e.resources.map((r) => `- [${r.title}](${r.url}): ${r.why}`).join("\n")}
`;
}

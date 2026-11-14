// Types shared between the server and the web UI.

export type QuestionType = "coding" | "system-design";
export type Difficulty = "easy" | "medium" | "hard";
export type Language = "python" | "javascript" | "typescript";
export const LANGUAGES: { id: Language; label: string; ext: string; monaco: string }[] = [
  { id: "python", label: "Python 3", ext: "py", monaco: "python" },
  { id: "javascript", label: "JavaScript (Node)", ext: "js", monaco: "javascript" },
  { id: "typescript", label: "TypeScript (Node)", ext: "ts", monaco: "typescript" },
];

export type Provider = "claude" | "codex" | "gemini" | "muse";

/**
 * strict   – real-interview conditions: prompt only, no sample tests, no hints, neutral interviewer.
 * standard – sample tests visible, interviewer answers clarifications and gives a hint only when asked.
 * coach    – learning mode: interviewer proactively nudges, reacts to test runs and gives in-round feedback.
 */
export type Strictness = "strict" | "standard" | "coach";
export type Verbosity = "terse" | "normal" | "detailed";

export interface SessionConfig {
  provider: Provider;
  strictness: Strictness;
  verbosity: Verbosity;
  language?: Language;
}

export interface QuestionSummary {
  id: string;
  title: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  durationMinutes: number;
}

export type TestArgs = unknown[];

/** A test case. For `function` questions `args` are positional arguments.
 *  For `class` questions `ops`/`args` follow the LeetCode convention: ops[0] is the constructor. */
export interface TestCase {
  name?: string;
  args: TestArgs | TestArgs[];
  ops?: string[];
  expected?: unknown;
}

export interface CaseResult {
  index: number;
  name?: string;
  kind: "public" | "hidden" | "custom";
  args: unknown;
  ops?: string[];
  output?: unknown;
  expected?: unknown;
  passed?: boolean; // undefined when there is no expected value to compare against
  error?: string;
  stdout?: string;
  ms?: number;
}

export interface RunResult {
  ok: boolean; // harness executed (no compile/infrastructure failure)
  compileError?: string;
  stderr?: string;
  cases: CaseResult[];
  passed: number;
  total: number; // cases that had an expected value
  durationMs: number;
  /** In strict mode hidden details are withheld until evaluation. */
  redacted?: boolean;
}

export type ChatRole = "candidate" | "interviewer" | "event";
export interface ChatEntry {
  role: ChatRole;
  text: string;
  at: string;
}

export type SessionStatus = "in_progress" | "followups" | "evaluating" | "evaluated";

export interface DesignWorkspace {
  markdown: string;
  scene?: unknown; // excalidraw elements/appState
  diagramSummary?: string;
}

export interface SessionState {
  id: string;
  questionId: string;
  config: SessionConfig;
  status: SessionStatus;
  createdAt: string;
  submittedAt?: string;
  evaluatedAt?: string;
  hintsRequested: number;
  runs: number;
  code?: Partial<Record<Language, string>>;
  design?: DesignWorkspace;
  followUpAnswers?: string[];
}

export interface QuestionView extends QuestionSummary {
  prompt: string;
  starter?: Partial<Record<Language, string>>;
  publicTests?: TestCase[]; // omitted in strict mode
  signature?: { kind: "function" | "class"; entry: Record<Language, string> };
  followUps?: string[]; // only once the candidate has submitted
}

export interface SessionView {
  session: SessionState;
  question: QuestionView;
  transcript: ChatEntry[];
  folder: string;
  lastSubmit?: RunResult;
}

export type HireDecision = "strong_hire" | "hire" | "lean_hire" | "lean_no_hire" | "no_hire";

export interface Evaluation {
  summary: string;
  decision: HireDecision;
  weightedScore: number;
  dimensions: {
    id: string;
    name: string;
    weight: number;
    score: number; // 1-4
    evidence: string[];
    feedback: string;
  }[];
  strengths: string[];
  improvements: string[];
  followUpFeedback: { question: string; assessment: string }[];
  modelAnswerSketch: string;
  studyTopics: string[];
  resources: { id: string; title: string; url: string; why: string }[];
  provider: Provider;
  model: string;
}

export interface SessionListItem {
  id: string;
  questionId: string;
  title: string;
  status: SessionStatus;
  createdAt: string;
  config: SessionConfig;
  decision?: HireDecision;
}

export interface AppConfig {
  providers: { id: Provider; label: string; available: boolean; model: string }[];
  runner: "docker" | "local";
  runnerReady: boolean;
  runnerMessage?: string;
}

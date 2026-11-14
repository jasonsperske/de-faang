// Types shared between the server and the web UI.

export type QuestionType = "coding" | "system-design";
export type Difficulty = "easy" | "medium" | "hard";
export type Language = "python" | "javascript" | "typescript" | "go" | "c" | "cpp" | "rust" | "java";
export const LANGUAGES: { id: Language; label: string; ext: string; monaco: string; tabSize: number; insertSpaces: boolean }[] = [
  { id: "python", label: "Python 3", ext: "py", monaco: "python", tabSize: 4, insertSpaces: true },
  { id: "javascript", label: "JavaScript (Node)", ext: "js", monaco: "javascript", tabSize: 2, insertSpaces: true },
  { id: "typescript", label: "TypeScript (Node)", ext: "ts", monaco: "typescript", tabSize: 2, insertSpaces: true },
  { id: "java", label: "Java 25", ext: "java", monaco: "java", tabSize: 4, insertSpaces: true },
  { id: "cpp", label: "C++20 (GCC)", ext: "cpp", monaco: "cpp", tabSize: 4, insertSpaces: true },
  { id: "c", label: "C17 (GCC)", ext: "c", monaco: "c", tabSize: 4, insertSpaces: true },
  { id: "go", label: "Go 1.25", ext: "go", monaco: "go", tabSize: 4, insertSpaces: false },
  { id: "rust", label: "Rust (stable)", ext: "rs", monaco: "rust", tabSize: 4, insertSpaces: true },
];
export const LANGUAGE_IDS = LANGUAGES.map((l) => l.id) as [Language, ...Language[]];

export type Provider = "claude" | "codex" | "gemini" | "muse";

/**
 * strict   – real-interview conditions: prompt only, no sample tests, no hints, neutral interviewer.
 * standard – sample tests visible, interviewer answers clarifications and gives a hint only when asked.
 * coach    – learning mode: interviewer proactively nudges, reacts to test runs and gives in-round feedback.
 */
export type Strictness = "strict" | "standard" | "coach";
export type Verbosity = "terse" | "normal" | "detailed";

/** classic: a normal coding round. ai: the candidate also has an AI assistant (coding questions only). */
export type InterviewFormat = "classic" | "ai";

export interface SessionConfig {
  provider: Provider;
  strictness: Strictness;
  verbosity: Verbosity;
  language?: Language;
  format?: InterviewFormat;
  /** AI-assisted rounds: the helpfulness preset and the exact system prompt the assistant used. */
  aiPolicy?: string;
  aiSystemPrompt?: string;
}

/** A helpfulness preset for the AI assistant (ai-policies/<id>.md). */
export interface AiPolicy {
  id: string;
  label: string;
  blurb: string;
  prompt: string;
}

/**
 * One entry in an AI-assisted round's log (sessions/<id>/ai-log.jsonl): what the candidate asked the
 * assistant, exactly what was sent, what came back, and what they did with it.
 */
export type AiLogEntry =
  | { kind: "prompt"; at: string; text: string; attachProblem: boolean; attachCode: boolean; language?: Language; sent: string }
  | { kind: "response"; at: string; text: string; error?: string }
  | { kind: "insert" | "replace" | "copy"; at: string; code: string; lines: number; source: "button" | "selection" }
  | { kind: "paste"; at: string; code: string; lines: number; fromAi: boolean }
  | { kind: "reset"; at: string };

export interface AiUsage {
  prompts: number;
  promptsWithProblem: number;
  promptsWithCode: number;
  codeBlocksOffered: number;
  inserts: number;
  replaces: number;
  copies: number;
  pastes: number;
  pastesFromAi: number;
  /** Non-trivial lines of the final code, and how many of them appear verbatim in an AI reply. */
  finalLines: number;
  aiLinesInFinal: number;
  aiShare: number;
}

export interface QuestionSummary {
  id: string;
  title: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  durationMinutes: number;
  /** Languages the question can be solved in (coding questions only). */
  languages?: Language[];
  /** Number of parts for multipart questions (absent for single-part questions). */
  parts?: number;
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
  /** 0-based part index, for multipart questions. */
  part?: number;
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
  /** Multipart questions: index of the part the candidate is working on (0-based). */
  part?: number;
  /** Multipart questions: when each finished part was handed in and how its tests went. */
  partResults?: { part: number; at: string; passed: number; total: number }[];
  design?: DesignWorkspace;
  followUpAnswers?: string[];
}

export interface PartView {
  index: number;
  id: string;
  title: string;
  prompt: string;
}

export interface QuestionView extends QuestionSummary {
  /** For multipart questions, the shared introduction; each part's prompt is in `partViews`. */
  prompt: string;
  /** Multipart: the parts revealed so far (later parts stay hidden until reached). */
  partViews?: PartView[];
  /** Multipart: index of the current part. Tests and signature below belong to it. */
  part?: number;
  starter?: Partial<Record<Language, string>>;
  publicTests?: TestCase[]; // omitted in strict mode
  signature?: { kind: "function" | "class"; entry: Partial<Record<Language, string>> };
  followUps?: string[]; // only once the candidate has submitted
}

export interface SessionView {
  session: SessionState;
  question: QuestionView;
  transcript: ChatEntry[];
  folder: string;
  lastSubmit?: RunResult;
  /** Multipart: test results of the part the candidate just finished. */
  lastPartResult?: RunResult;
  /** AI-assisted rounds: the assistant log. */
  ai?: AiLogEntry[];
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
  /** AI-assisted rounds: how the candidate used the assistant. */
  aiUsage?: AiUsage;
  rubric?: string;
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
  /** Languages whose toolchain is still downloading (first use of the Docker runner). */
  pendingLanguages: Language[];
  /** Helpfulness presets for the AI assistant in AI-assisted rounds. */
  aiPolicies: AiPolicy[];
}

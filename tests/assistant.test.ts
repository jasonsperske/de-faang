// AI-assisted rounds: policies, what is sent to the LLM, conversation threading, usage analysis,
// and the AI rubric (base rubric + question-specific dimensions).
import { beforeAll, describe, expect, it } from "vitest";
import { aiTimeline, aiUsage, assistantMessages, assistantSystemPrompt, codeBlocks, composePrompt, loadPolicies } from "../server/assistant.ts";
import { rubricFor } from "../server/evaluator.ts";
import { getQuestion, loadQuestions } from "../server/questions.ts";
import type { AiLogEntry, SessionState } from "../shared/types.ts";

beforeAll(() => {
  loadQuestions(true);
});

const state = (over: Partial<SessionState> = {}): SessionState => ({
  id: "test",
  questionId: "two-sum",
  config: { provider: "claude", strictness: "standard", verbosity: "normal", language: "python", format: "ai", aiPolicy: "guarded", aiSystemPrompt: "POLICY" },
  status: "in_progress",
  createdAt: "2026-11-14T10:00:00.000Z",
  hintsRequested: 0,
  runs: 0,
  ...over,
});

const at = (s: number) => new Date(Date.parse("2026-11-14T10:00:00.000Z") + s * 1000).toISOString();

describe("AI assistant", () => {
  it("loads the helpfulness presets in order, with prompts", () => {
    const ps = loadPolicies();
    expect(ps.map((p) => p.id)).toEqual(["socratic", "guarded", "pair", "full"]);
    for (const p of ps) {
      expect(p.label).toBeTruthy();
      expect(p.prompt).toMatch(/^HELPFULNESS POLICY/);
    }
    expect(assistantSystemPrompt(ps[0].prompt)).toContain("SOCRATIC TUTOR");
  });

  it("sends only the attachments the candidate chose", () => {
    const q = getQuestion("two-sum");
    const both = composePrompt(q, state(), { text: "Is a hash map right here?", attachProblem: true, attachCode: true, language: "python", code: "def two_sum(): pass" });
    expect(both).toMatch(/^Is a hash map right here\?/);
    expect(both).toContain("[Attached: problem statement]");
    expect(both).toContain("```python\ndef two_sum(): pass\n```");
    const none = composePrompt(q, state(), { text: "hi", attachProblem: false, attachCode: false, language: "python", code: "x" });
    expect(none).toBe("hi");
  });

  it("attaches only the multipart parts reached so far", () => {
    const q = getQuestion("anagram-pairs-and-compound-words");
    const text = (part: number) => composePrompt(q, state({ part }), { text: "?", attachProblem: true, attachCode: false });
    expect(text(0)).toContain("Part 1: Count anagram pairs");
    expect(text(0)).not.toContain("Part 2");
    expect(text(1)).toContain("Part 2: Find compound words");
  });

  it("threads the conversation since the last New chat and skips failed replies", () => {
    const log: AiLogEntry[] = [
      { kind: "prompt", at: at(1), text: "a", attachProblem: false, attachCode: false, sent: "A" },
      { kind: "response", at: at(2), text: "ra" },
      { kind: "reset", at: at(3) },
      { kind: "prompt", at: at(4), text: "b", attachProblem: false, attachCode: false, sent: "B" },
      { kind: "response", at: at(5), text: "", error: "rate limited" },
      { kind: "prompt", at: at(6), text: "c", attachProblem: false, attachCode: false, sent: "C" },
      { kind: "response", at: at(7), text: "rc" },
    ];
    expect(assistantMessages(log, "D")).toEqual([
      { role: "user", content: "C" },
      { role: "assistant", content: "rc" },
      { role: "user", content: "D" },
    ]);
  });

  it("measures how much of the final code came from AI replies", () => {
    const reply = "Try this:\n\n```python\ndef two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n```";
    expect(codeBlocks(reply)).toHaveLength(1);
    const log: AiLogEntry[] = [
      { kind: "prompt", at: at(10), text: "write it", attachProblem: true, attachCode: true, sent: "…" },
      { kind: "response", at: at(20), text: reply },
      { kind: "insert", at: at(30), code: "…", lines: 6, source: "button" },
      { kind: "paste", at: at(40), code: "x", lines: 1, fromAi: false },
    ];
    // Three of the five non-trivial final lines are verbatim from the reply (indentation ignored).
    const final = "def two_sum(nums, target):\n  seen = {}\n  for i, x in enumerate(nums):\n    lookup = target - x\n    if lookup in seen: return [seen[lookup], i]\n}";
    const u = aiUsage(log, final);
    expect(u).toMatchObject({ prompts: 1, promptsWithProblem: 1, promptsWithCode: 1, codeBlocksOffered: 1, inserts: 1, pastes: 1, pastesFromAi: 0, finalLines: 5, aiLinesInFinal: 3, aiShare: 0.6 });
    const timeline = aiTimeline(state(), log);
    expect(timeline).toContain("[0:10] **Candidate → AI** (attached: problem, code)");
    expect(timeline).toContain("[0:30] _Candidate inserted an AI code block at the cursor (6 lines)._");
    expect(timeline).toContain("(not from an AI reply)");
  });

  it("grades AI rounds with the AI rubric plus the question's own AI dimension", () => {
    const q = getQuestion("two-sum");
    const classic = rubricFor(q, state({ config: { ...state().config, format: "classic" } }));
    expect(classic.id).toBe("coding");
    const r = rubricFor(q, state());
    expect(r.id).toBe("ai-coding");
    expect(r.dimensions.map((d) => d.id)).toEqual(["problem_framing", "prompting", "verification", "ownership", "correctness", "communication", "edge_case_scrutiny"]);
    expect(r.dimensions.reduce((a, d) => a + d.weight, 0)).toBeCloseTo(1, 2);
  });

  it("gives every coding question AI rubric criteria and AI pitfalls", () => {
    for (const q of loadQuestions().values()) {
      if (q.meta.type !== "coding") continue;
      expect(q.meta.ai.dimensions.length, q.meta.id).toBeGreaterThan(0);
      expect(q.meta.ai.watchFor.length, q.meta.id).toBeGreaterThan(0);
    }
  });
});

// Post-interview debrief and lessons: conversation threading, prompts, and lesson storage.
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allLessons, appendDebrief, debriefMessages, debriefSystemPrompt, lessonSystemPrompt, listLessons, readDebrief, readLesson, saveLesson } from "../server/debrief.ts";
import { SESSIONS_DIR } from "../server/paths.ts";
import { getQuestion, loadQuestions } from "../server/questions.ts";
import * as S from "../server/sessions.ts";
import type { SessionState } from "../shared/types.ts";

let state: SessionState;

beforeAll(() => {
  loadQuestions(true);
  state = S.createSession("two-sum", { provider: "claude", strictness: "standard", verbosity: "normal", language: "python" });
  state.status = "evaluated";
  S.saveState(state);
  S.writeEvidence(state.id, "packet.md", "# Interview packet: Two Sum\nPACKET-MARKER");
  fs.writeFileSync(path.join(SESSIONS_DIR, state.id, "report.md"), "# Two Sum: interview feedback\nREPORT-MARKER");
});

afterAll(() => {
  if (state?.id) fs.rmSync(path.join(SESSIONS_DIR, state.id), { recursive: true, force: true });
});

describe("debrief", () => {
  it("stores the conversation and threads it as alternating turns", () => {
    appendDebrief(state.id, { role: "candidate", text: "How could I have done better?" });
    appendDebrief(state.id, { role: "coach", text: "State your approach first." });
    appendDebrief(state.id, { role: "candidate", text: "Why?" });
    appendDebrief(state.id, { role: "candidate", text: "And what about duplicates?" });
    expect(readDebrief(state.id)).toHaveLength(4);
    expect(debriefMessages(readDebrief(state.id))).toEqual([
      { role: "user", content: "How could I have done better?" },
      { role: "assistant", content: "State your approach first." },
      { role: "user", content: "Why?\n\nAnd what about duplicates?" },
    ]);
  });

  it("gives the coach the packet, the hint ladder and the report", () => {
    const sys = debriefSystemPrompt(getQuestion("two-sum"), state);
    expect(sys).toMatch(/^You are a senior engineer and interview coach/);
    expect(sys).toContain("PACKET-MARKER");
    expect(sys).toContain("REPORT-MARKER");
    expect(sys).toContain(getQuestion("two-sum").meta.interviewer.hints[0]);
  });

  it("builds the lesson prompt from the round, the debrief, a focus, and the resource library only", () => {
    const sys = lessonSystemPrompt(getQuestion("two-sum"), state, readDebrief(state.id), "edge cases I missed");
    expect(sys).toContain('"edge cases I missed"');
    expect(sys).toContain("Candidate: And what about duplicates?");
    expect(sys).toContain("https://www.techinterviewhandbook.org/algorithms/hash-table/");
    expect(sys).toContain("## Checklist for next time");
  });
});

describe("lessons", () => {
  it("saves lessons with a title from the first heading and lists them", () => {
    const q = getQuestion("two-sum");
    const a = saveLesson(state, q, "# Complement lookups\n\nbody", { focus: "hash maps", provider: "claude", model: "m" });
    const b = saveLesson(state, q, "no heading here", { provider: "claude", model: "m" });
    expect(a).toMatchObject({ id: "lesson-001", title: "Complement lookups", focus: "hash maps", questionId: "two-sum", sessionId: state.id });
    expect(b).toMatchObject({ id: "lesson-002", title: "Lesson from Two Sum" });
    expect(listLessons(state.id).map((l) => l.id)).toEqual(["lesson-001", "lesson-002"]);
    expect(readLesson(state.id, "lesson-001").markdown).toBe("# Complement lookups\n\nbody\n");
    expect(allLessons().filter((l) => l.sessionId === state.id)).toHaveLength(2);
  });

  it("rejects lesson ids that aren't lesson files", () => {
    expect(() => readLesson(state.id, "../session")).toThrow(/No lesson/);
    expect(() => readLesson(state.id, "lesson-999")).toThrow(/No lesson/);
  });
});

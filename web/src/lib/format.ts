import type { HireDecision, Strictness, Verbosity } from "../../../shared/types";

export const DECISION_LABEL: Record<HireDecision, string> = {
  strong_hire: "Strong Hire",
  hire: "Hire",
  lean_hire: "Lean Hire",
  lean_no_hire: "Lean No Hire",
  no_hire: "No Hire",
};

export const STRICTNESS: Record<Strictness, { label: string; blurb: string }> = {
  strict: { label: "Strict", blurb: "Real-interview conditions: you get the prompt only, with no sample tests, no hints, and a neutral interviewer. Hidden test details stay hidden until the evaluation." },
  standard: { label: "Standard", blurb: "Sample tests are visible, and you can check expected output for your own inputs. The interviewer gives a hint only when you ask." },
  coach: { label: "Coach", blurb: "Learning mode. The interviewer offers hints, reacts to your test runs, and coaches your interview technique as you go." },
};

export const VERBOSITY: Record<Verbosity, string> = {
  terse: "Terse",
  normal: "Normal",
  detailed: "Detailed",
};

export const fmtJson = (v: unknown) => {
  const s = JSON.stringify(v);
  return s === undefined ? "undefined" : s;
};

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

interface Props {
  sessionId: string;
  questions: string[];
  initial?: string[];
  onEvaluated: () => void;
}

export function FollowUps({ sessionId, questions, initial, onEvaluated }: Props) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map((_, i) => initial?.[i] ?? ""));
  const [phase, setPhase] = useState<"answering" | "evaluating">("answering");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // Autosave answers into the evidence folder as they type.
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void api.saveFollowUps(sessionId, answers).catch(() => {}), 1200);
    return () => clearTimeout(timer.current);
  }, [answers, sessionId]);

  const finish = async () => {
    setError(null);
    setPhase("evaluating");
    try {
      await api.saveFollowUps(sessionId, answers);
      await api.evaluate(sessionId);
      onEvaluated();
    } catch (e) {
      setError((e as Error).message);
      setPhase("answering");
    }
  };

  const answered = answers.filter((a) => a.trim()).length;
  return (
    <div className="followups">
      <p className="muted small">
        Your solution is submitted. Answer the follow-up questions in writing, as you would say them out loud. You can keep talking to the interviewer
        in the chat. Answers are saved to your evidence folder as you type.
      </p>
      {questions.map((q, i) => (
        <div key={i} className="fu">
          <label>
            <span className="fu-n">Q{i + 1}</span> {q}
          </label>
          <textarea
            value={answers[i]}
            disabled={phase === "evaluating"}
            onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder="Your answer…"
          />
        </div>
      ))}
      {error && <div className="banner error small">{error}</div>}
      <div className="fu-actions">
        <span className="muted small">
          {answered}/{questions.length} answered
        </span>
        <button className="primary" disabled={phase === "evaluating"} onClick={finish}>
          {phase === "evaluating" ? "Evaluating your round… (this can take a minute)" : "Finish & get feedback"}
        </button>
      </div>
    </div>
  );
}

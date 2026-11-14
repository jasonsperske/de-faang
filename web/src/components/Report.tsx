import { useEffect, useState } from "react";
import type { Evaluation, RunResult } from "../../../shared/types";
import { api } from "../lib/api";
import { DECISION_LABEL } from "../lib/format";
import { Markdown } from "./Markdown";
import { Results } from "./CodeWorkspace";

export function Report({ sessionId, folder, onShowWorkspace }: { sessionId: string; folder: string; onShowWorkspace: () => void }) {
  const [data, setData] = useState<{ evaluation: Evaluation; submit?: RunResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.report(sessionId).then(setData, (e) => setError(e.message));
  }, [sessionId]);

  if (error) return <div className="banner error">{error}</div>;
  if (!data) return <div className="center muted">Loading report…</div>;
  const e = data.evaluation;

  return (
    <div className="report">
      <div className="report-hero">
        <div>
          <div className={`decision big ${e.decision}`}>{DECISION_LABEL[e.decision]}</div>
          <div className="muted small">
            Weighted score {e.weightedScore.toFixed(2)} / 4 · evaluated by {e.provider} ({e.model})
          </div>
        </div>
        <div className="report-actions">
          <button className="ghost" onClick={onShowWorkspace}>
            View my workspace
          </button>
          <a className="button secondary" href="#/">
            Back to library
          </a>
        </div>
      </div>
      <Markdown className="summary">{e.summary}</Markdown>

      <h2>Scorecard</h2>
      <div className="dims">
        {e.dimensions.map((d) => (
          <div key={d.id} className="dim">
            <div className="dim-head">
              <strong>{d.name}</strong>
              <span className="muted small">{Math.round(d.weight * 100)}%</span>
            </div>
            <div className="meter" aria-label={`${d.score} of 4`}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className={n <= d.score ? `on s${d.score}` : ""} />
              ))}
              <b>{d.score}/4</b>
            </div>
            <Markdown>{d.feedback}</Markdown>
            {d.evidence.length > 0 && (
              <details>
                <summary className="small">Evidence ({d.evidence.length})</summary>
                <ul className="evidence">
                  {d.evidence.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <div className="two-col">
        <div>
          <h2>What went well</h2>
          <ul>
            {e.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>What to work on</h2>
          <ul>
            {e.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {e.followUpFeedback.length > 0 && (
        <>
          <h2>Follow-up answers</h2>
          {e.followUpFeedback.map((f, i) => (
            <div key={i} className="fu-feedback">
              <strong>{f.question}</strong>
              <Markdown>{f.assessment}</Markdown>
            </div>
          ))}
        </>
      )}

      {data.submit && (
        <>
          <h2>Submission tests (public + hidden)</h2>
          <div className="report-results">
            <Results result={data.submit} />
          </div>
        </>
      )}

      <h2>Model answer sketch</h2>
      <Markdown className="model-answer">{e.modelAnswerSketch}</Markdown>

      <h2>Study next</h2>
      <div className="tags">
        {e.studyTopics.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <ul className="resources">
        {e.resources.map((r) => (
          <li key={r.id}>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.title}
            </a>
            <div className="muted small">{r.why}</div>
          </li>
        ))}
      </ul>

      <p className="muted small">
        The full packet, evidence, and <code>report.md</code> are saved in <code>{folder}/</code>.
      </p>
    </div>
  );
}

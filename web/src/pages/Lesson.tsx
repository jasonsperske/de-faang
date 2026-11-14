import { useEffect, useState } from "react";
import type { LessonMeta } from "../../../shared/types";
import { api } from "../lib/api";
import { Markdown } from "../components/Markdown";

/** A lesson generated from a completed round. */
export function Lesson({ sessionId, lessonId }: { sessionId: string; lessonId: string }) {
  const [data, setData] = useState<{ lesson: LessonMeta; markdown: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.lesson(sessionId, lessonId).then(setData, (e) => setError(e.message));
  }, [sessionId, lessonId]);

  return (
    <div className="room-report">
      <header className="room-header">
        <a href="#/" className="logo">
          de-faang
        </a>
        <div className="room-title">
          <strong>Lesson</strong>
          {data && <span className="muted small">from {data.lesson.questionTitle}</span>}
        </div>
        <div className="spacer" />
        {data && (
          <>
            <a className="button ghost small" href={`#/session/${sessionId}/debrief`}>
              Back to the debrief
            </a>
            <a className="button ghost small" href={`/api/sessions/${sessionId}/lessons/${lessonId}/download`}>
              Download .md
            </a>
            <a className="button primary small" href={`#/?start=${data.lesson.questionId}`} title="Start a new round of the same question">
              Practise this question again
            </a>
          </>
        )}
      </header>
      <div className="report lesson">
        {error && <div className="banner error">{error}</div>}
        {!data && !error && <p className="muted">Loading…</p>}
        {data && (
          <>
            <p className="muted small">
              {new Date(data.lesson.createdAt).toLocaleString()} · written by {data.lesson.provider} ({data.lesson.model})
              {data.lesson.focus ? ` · focus: ${data.lesson.focus}` : ""} · saved as <code>sessions/{sessionId}/lessons/{lessonId}.md</code>
            </p>
            <Markdown>{data.markdown}</Markdown>
          </>
        )}
      </div>
    </div>
  );
}

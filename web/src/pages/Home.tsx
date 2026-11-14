import { useEffect, useMemo, useState } from "react";
import type { AppConfig, InterviewFormat, Language, Provider, QuestionSummary, SessionListItem, Strictness, Verbosity } from "../../../shared/types";
import { LANGUAGES } from "../../../shared/types";
import { api } from "../lib/api";
import { DECISION_LABEL, STRICTNESS, VERBOSITY } from "../lib/format";

type Filter = "all" | "coding" | "system-design";

export function Home() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [picked, setPicked] = useState<QuestionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.config(), api.questions(), api.sessions()])
      .then(([c, q, s]) => {
        setConfig(c);
        setQuestions(q);
        setSessions(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => questions.filter((q) => filter === "all" || q.type === filter), [questions, filter]);
  const noProvider = config && !config.providers.some((p) => p.available);

  return (
    <div className="home">
      <header className="home-header">
        <div>
          <h1>
            de-faang
          </h1>
          <p className="tagline">Practice FAANG-style coding and system design rounds locally, with an AI interviewer and rubric-based feedback.</p>
        </div>
      </header>

      {error && <div className="banner error">{error}</div>}
      {noProvider && (
        <div className="banner warn">
          No LLM provider is configured. Copy <code>.env.example</code> to <code>.env</code> and set <code>ANTHROPIC_API_KEY</code> and/or{" "}
          <code>OPENAI_API_KEY</code>, then restart. (Or set <code>DEFAANG_MOCK_LLM=1</code> to try the UI offline.)
        </div>
      )}
      {config && !config.runnerReady && <div className="banner warn">{config.runnerMessage}</div>}

      <section>
        <div className="section-head">
          <h2>Question library</h2>
          <div className="seg">
            {(["all", "coding", "system-design"] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "coding" ? "Coding" : "System design"}
              </button>
            ))}
          </div>
        </div>
        <div className="cards">
          {shown.map((q) => (
            <button key={q.id} className="card" onClick={() => setPicked(q)} disabled={!!noProvider}>
              <div className="card-top">
                <span className={`pill ${q.type}`}>{q.type === "coding" ? "Coding" : "System design"}</span>
                <span className={`diff ${q.difficulty}`}>{q.difficulty}</span>
              </div>
              <h3>{q.title}</h3>
              <div className="tags">
                {q.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
              <div className="muted small">
                ~{q.durationMinutes} min{q.parts ? ` · ${q.parts} parts` : ""}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Past rounds</h2>
        {sessions.length === 0 ? (
          <p className="muted">No rounds yet. Each round is saved to its own folder under <code>sessions/</code>, which git ignores.</p>
        ) : (
          <table className="sessions">
            <thead>
              <tr>
                <th>Question</th>
                <th>Started</th>
                <th>Mode</th>
                <th>Interviewer</th>
                <th>Status</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} onClick={() => (location.hash = `#/session/${s.id}`)}>
                  <td>{s.title}</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>
                    {STRICTNESS[s.config.strictness].label}
                    {s.config.format === "ai" ? " · ✦ AI" : ""}
                  </td>
                  <td>{s.config.provider}</td>
                  <td>
                    <span className={`status ${s.status}`}>{s.status.replace("_", " ")}</span>
                  </td>
                  <td>{s.decision ? <span className={`decision ${s.decision}`}>{DECISION_LABEL[s.decision]}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {picked && config && <SetupDialog q={picked} config={config} onClose={() => setPicked(null)} />}
    </div>
  );
}

function SetupDialog({ q, config, onClose }: { q: QuestionSummary; config: AppConfig; onClose: () => void }) {
  const firstAvailable = config.providers.find((p) => p.available)?.id ?? "claude";
  const [provider, setProvider] = useState<Provider>(firstAvailable);
  const [strictness, setStrictness] = useState<Strictness>("standard");
  const [verbosity, setVerbosity] = useState<Verbosity>("normal");
  const languages = LANGUAGES.filter((l) => q.languages?.includes(l.id));
  const [language, setLanguage] = useState<Language>(() => {
    const last = lastLanguage();
    return last && q.languages?.includes(last) ? last : "python";
  });
  const [format, setFormat] = useState<InterviewFormat>("classic");
  const policies = config.aiPolicies;
  const [policyId, setPolicyId] = useState(policies.find((p) => p.id === "guarded")?.id ?? policies[0]?.id ?? "");
  const policy = policies.find((p) => p.id === policyId);
  const [prompt, setPrompt] = useState(policy?.prompt ?? "");
  const edited = policy !== undefined && prompt.trim() !== policy.prompt.trim();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ai = q.type === "coding" && format === "ai";

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await api.createSession(q.id, {
        provider,
        strictness,
        verbosity,
        language: q.type === "coding" ? language : undefined,
        format: q.type === "coding" ? format : undefined,
        aiPolicy: ai ? policyId : undefined,
        aiSystemPrompt: ai ? prompt : undefined,
      });
      if (q.type === "coding") rememberLanguage(language);
      location.hash = `#/session/${v.session.id}`;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{q.title}</h2>
        <p className="muted">
          {q.type === "coding" ? "Coding" : "System design"} · {q.difficulty} · about {q.durationMinutes} minutes{q.parts ? ` · ${q.parts} parts, revealed one at a time` : ""}
        </p>

        {q.type === "coding" && (
          <>
            <label className="field-label">Format</label>
            <div className="options">
              <label className={`option ${format === "classic" ? "on" : ""}`}>
                <input type="radio" name="format" checked={format === "classic"} onChange={() => setFormat("classic")} />
                <div>
                  <strong>Classic</strong>
                  <div className="muted small">Just you, the editor, and the interviewer.</div>
                </div>
              </label>
              <label className={`option ${format === "ai" ? "on" : ""}`}>
                <input type="radio" name="format" checked={format === "ai"} onChange={() => setFormat("ai")} />
                <div>
                  <strong>✦ AI-assisted</strong>
                  <div className="muted small">You get an AI assistant. Graded on how you direct it and check its work.</div>
                </div>
              </label>
            </div>
            {ai && (
              <>
                <label className="field-label">AI helpfulness</label>
                <div className="options">
                  {policies.map((p) => (
                    <label key={p.id} className={`option ${policyId === p.id ? "on" : ""}`}>
                      <input
                        type="radio"
                        name="policy"
                        checked={policyId === p.id}
                        onChange={() => {
                          setPolicyId(p.id);
                          setPrompt(p.prompt);
                        }}
                      />
                      <div>
                        <strong>{p.label}</strong>
                        <div className="muted small">{p.blurb}</div>
                      </div>
                    </label>
                  ))}
                </div>
                <details className="ai-prompt">
                  <summary className="small">
                    Edit the assistant's instructions{edited ? " (edited)" : ""}
                  </summary>
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} spellCheck={false} />
                  <div className="row gap small muted">
                    Saved with this round only. Edit <code>ai-policies/{policyId}.md</code> to change the preset.
                    {edited && (
                      <button className="ghost small" onClick={() => setPrompt(policy!.prompt)}>
                        Reset
                      </button>
                    )}
                  </div>
                </details>
              </>
            )}
          </>
        )}

        <label className="field-label">Interviewer</label>
        <div className="options">
          {config.providers.map((p) => (
            <label key={p.id} className={`option ${provider === p.id ? "on" : ""} ${p.available ? "" : "disabled"}`}>
              <input type="radio" name="provider" disabled={!p.available} checked={provider === p.id} onChange={() => setProvider(p.id)} />
              <div>
                <strong>{p.label}</strong>
                <div className="muted small">{p.available ? p.model : "API key not set"}</div>
              </div>
            </label>
          ))}
        </div>

        <label className="field-label">Strictness</label>
        <div className="options three">
          {(Object.keys(STRICTNESS) as Strictness[]).map((s) => (
            <label key={s} className={`option ${strictness === s ? "on" : ""}`}>
              <input type="radio" name="strict" checked={strictness === s} onChange={() => setStrictness(s)} />
              <div>
                <strong>{STRICTNESS[s].label}</strong>
                <div className="muted small">{STRICTNESS[s].blurb}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="row gap">
          <div>
            <label className="field-label">Interviewer verbosity</label>
            <div className="seg">
              {(Object.keys(VERBOSITY) as Verbosity[]).map((v) => (
                <button key={v} className={verbosity === v ? "on" : ""} onClick={() => setVerbosity(v)}>
                  {VERBOSITY[v]}
                </button>
              ))}
            </div>
          </div>
          {q.type === "coding" && (
            <div>
              <label className="field-label">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                    {config.pendingLanguages.includes(l.id) ? " (downloading…)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <div className="banner error">{error}</div>}
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={start} disabled={busy}>
            {busy ? "Starting…" : "Start interview"}
          </button>
        </div>
      </div>
    </div>
  );
}

const LANGUAGE_KEY = "defaang:last-language";
function lastLanguage(): Language | undefined {
  try {
    return (localStorage.getItem(LANGUAGE_KEY) as Language | null) ?? undefined;
  } catch {
    return undefined;
  }
}
function rememberLanguage(l: Language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, l);
  } catch {
    /* not persisted */
  }
}

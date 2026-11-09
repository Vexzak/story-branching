import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';

const BASE = '/admin/records';

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function timeAgo(d) {
  if (!d) return 'Never';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(d).toLocaleDateString();
}

const STATUS = {
  in_progress: ['In progress', 'info'],
  completed: ['Completed', 'ok'],
  abandoned: ['Abandoned', 'warn'],
};

function Badge({ kind, children }) {
  return <span className={`rec-badge rec-${kind}`}>{children}</span>;
}

function StatusBadge({ status }) {
  const [label, kind] = STATUS[status] ?? [status, 'info'];
  return <Badge kind={kind}>{label}</Badge>;
}

function Tile({ label, value, tone, text }) {
  return (
    <div className={`rec-tile ${tone ? `rec-tile-${tone}` : ''}`}>
      <div className={text ? 'rec-tile-value rec-tile-text' : 'rec-tile-value'}>{value}</div>
      <div className="rec-tile-label">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parent: simple view switcher
// ---------------------------------------------------------------------------
const DASH_ICONS = {
  answers: ['M5 21V11', 'M12 21V4', 'M19 21v-7'],
  plays: ['M8 5v14l11-7z'],
  done: ['M9 12l2 2 4-4', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'],
};
const STORY_COLORS = ['#60a5fa', '#2f6fed', '#1e3a8a', '#8b5cf6', '#06b6d4', '#f59e0b'];

function DashIcon({ name, tone = 'blue' }) {
  return (
    <span className={`sd-icon sd-icon-${tone}`}>
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {DASH_ICONS[name].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

export default function StudentRecords() {
  const [view, setView] = useState({ type: 'list' });
  const [listState, setListState] = useState({ search: '', page: 1 });

  if (view.type === 'student') {
    return (
      <StudentDetail
        studentId={view.studentId}
        onBack={() => setView({ type: 'list' })}
        onOpenSession={(sessionId) =>
          setView({ type: 'session', sessionId, studentId: view.studentId, from: 'student' })
        }
        onOpenStory={(storyId) => setView({ type: 'performance', studentId: view.studentId, storyId })}
      />
    );
  }

  if (view.type === 'performance') {
    return (
      <StoryPerformance
        studentId={view.studentId}
        storyId={view.storyId}
        onBack={() => setView({ type: 'student', studentId: view.studentId })}
        onOpenSession={(sessionId) =>
          setView({
            type: 'session',
            sessionId,
            studentId: view.studentId,
            storyId: view.storyId,
            from: 'performance',
          })
        }
      />
    );
  }

  if (view.type === 'session') {
    return (
      <SessionDetail
        sessionId={view.sessionId}
        onBack={() =>
          view.from === 'performance'
            ? setView({ type: 'performance', studentId: view.studentId, storyId: view.storyId })
            : setView({ type: 'student', studentId: view.studentId })
        }
      />
    );
  }

  return (
    <div className="stack">
      <PasswordResetRequests />
      <StudentList
        listState={listState}
        setListState={setListState}
        onOpen={(studentId) => setView({ type: 'student', studentId })}
      />
    </div>
  );
}

function PasswordResetRequests() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await apiFetch('/admin/password-resets');
      setRequests(result.requests || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load password reset requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function review(id, decision) {
    setReviewing(id);
    setError('');
    try {
      await apiFetch(`/admin/password-resets/${id}/review`, {
        method: 'POST',
        body: { decision },
      });
      await load();
      window.dispatchEvent(new Event('password-reset-requests-updated'));
    } catch (err) {
      setError(err.message || 'Could not review this request.');
    } finally {
      setReviewing('');
    }
  }

  return (
    <section className="panel stack">
      <div className="page-heading">
        <div>
          <h2>Password reset requests</h2>
          <p className="muted">Approve or reject student requests. Approved students receive a reset link at their registered email.</p>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading ? <p className="muted">Loading requests…</p> : requests.length === 0 ? (
        <p className="muted">No requests are awaiting review.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Student</th><th>Requested</th><th>Actions</th></tr></thead>
            <tbody>{requests.map((request) => (
              <tr key={request.id}>
                <td>{request.student?.display_name || request.student?.username || 'Student'} <span className="muted">({request.student?.username})</span></td>
                <td>{new Date(request.requested_at).toLocaleString()}</td>
                <td className="table-actions">
                  <button type="button" className="btn btn-primary" disabled={Boolean(reviewing)} onClick={() => review(request.id, 'approved')}>
                    {reviewing === request.id ? 'Saving…' : 'Approve'}
                  </button>
                  <button type="button" className="btn" disabled={Boolean(reviewing)} onClick={() => review(request.id, 'rejected')}>Reject</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Student list
// ---------------------------------------------------------------------------
function StudentList({ listState, setListState, onOpen }) {
  const { search, page } = listState;
  const [input, setInput] = useState(search);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiFetch(`${BASE}/students?${new URLSearchParams({ search, page, pageSize: 15 })}`)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [search, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const runSearch = () => setListState({ search: input.trim(), page: 1 });

  return (
    <div className="stack">
      <div className="rec-head">
        <div>
          <h1 className="rec-title">Students</h1>
          <p className="rec-sub">
            {data ? `${plural(data.total, 'student')}${search ? ` matching “${search}”` : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      <div className="rec-card">
        <div className="rec-toolbar">
          <input
            type="text"
            className="rec-search"
            value={input}
            placeholder="Search by username or display name"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          <button type="button" className="btn btn-primary" onClick={runSearch}>
            Search
          </button>
          {search && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setInput('');
                setListState({ search: '', page: 1 });
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {data && (
        <div className="rec-card rec-flush">
          {data.students.length === 0 ? (
            <p className="rec-empty">No students found.</p>
          ) : (
            <div className="rec-wrap">
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Registered</th>
                    <th>Sessions</th>
                    <th>Completed</th>
                    <th>Last active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="rec-user">
                          <div className="rec-avatar">{initial(s.username)}</div>
                          <div>
                            <strong>{s.username}</strong>
                            <div className="rec-muted">{s.display_name}</div>
                          </div>
                        </div>
                      </td>
                      <td>{s.email ?? '—'}</td>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                      <td>{s.total_sessions}</td>
                      <td>
                        <Badge kind={s.completed_sessions > 0 ? 'ok' : 'info'}>
                          {s.completed_sessions}/{s.total_sessions}
                        </Badge>
                      </td>
                      <td title={fmt(s.last_activity)}>{timeAgo(s.last_activity)}</td>
                      <td>
                        <button type="button" className="btn" onClick={() => onOpen(s.id)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rec-pager">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page <= 1 || loading}
              onClick={() => setListState({ search, page: page - 1 })}
            >
              ← Previous
            </button>
            <span className="rec-muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page >= totalPages || loading}
              onClick={() => setListState({ search, page: page + 1 })}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student detail
// ---------------------------------------------------------------------------
function StudentDetail({ studentId, onBack, onOpenSession, onOpenStory }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch(`${BASE}/students/${studentId}`)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [studentId]);

  async function deleteStudent() {
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`${BASE}/students/${studentId}`, {
        method: 'DELETE',
        body: { confirmUsername: typed },
      });
      onBack();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="stack">
        <div className="alert alert-error">{error}</div>
        <div>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            ← Back to students
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <p>Loading student…</p>;

  const { student, stats, sessions } = data;
  const canDelete = typed.trim().toLowerCase() === student.username.toLowerCase();

  const byStory = new Map();
  for (const s of sessions) {
    const row = byStory.get(s.story_id) ?? {
      id: s.story_id,
      title: s.story_title,
      sessions: 0,
      completed: 0,
      correct: 0,
      incorrect: 0,
    };
    row.sessions += 1;
    if (s.status === 'completed') row.completed += 1;
    row.correct += s.correct_selections;
    row.incorrect += s.incorrect_selections;
    byStory.set(s.story_id, row);
  }

  const storyRows = [...byStory.values()]
    .map((r) => ({ ...r, total: r.correct + r.incorrect }))
    .filter((r) => r.total > 0);

  return (
    <div className="stack">
      <div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Back to students
        </button>
      </div>

      <div className="rec-card">
        <div className="rec-head">
          <div className="rec-user">
            <div className="rec-avatar rec-avatar-lg">{initial(student.username)}</div>
            <div>
              <h1 className="rec-title">{student.username}</h1>
              <p className="rec-sub">
                {student.display_name} · {student.email ?? 'no email'}
              </p>
              <p className="rec-sub">
                Registered {new Date(student.created_at).toLocaleDateString()} · last active{' '}
                {timeAgo(stats.last_activity)}
              </p>
            </div>
          </div>
          {!confirming && (
            <button
              type="button"
              className="rec-btn-danger-outline"
              onClick={() => {
                setConfirming(true);
                setTyped('');
                setDeleteError('');
              }}
            >
              Delete account
            </button>
          )}
        </div>

        {confirming && (
          <div className="rec-danger">
            <strong>Delete this student permanently?</strong>
            <p className="rec-muted">
              This removes the account, the sign-in, and all of this student&apos;s game sessions and
              choice history. It cannot be undone.
            </p>
            <div className="rec-row">
              <input
                type="text"
                className="rec-input"
                value={typed}
                placeholder={`Type "${student.username}" to confirm`}
                onChange={(e) => setTyped(e.target.value)}
              />
              <button
                type="button"
                className="rec-btn-danger"
                disabled={!canDelete || deleting}
                onClick={deleteStudent}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button type="button" className="btn btn-ghost" disabled={deleting} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
            {deleteError && <div className="alert alert-error">{deleteError}</div>}
          </div>
        )}
      </div>

      <div className="sd-grid">
        <div className="sd-card">
          <div className="sd-head">
            <DashIcon name="answers" tone="blue" />
            <div>
              <h2>Answers</h2>
              <p className="sd-sub">Choice selections across all stories</p>
            </div>
          </div>

          <div className="sd-bar" role="img" aria-label="Share of selections by story">
            {storyRows.map((r, i) => (
              <span
                key={r.id}
                className="sd-seg"
                style={{ flex: r.total, background: STORY_COLORS[i % STORY_COLORS.length] }}
              />
            ))}
          </div>

          <div className="sd-rows">
            {storyRows.length === 0 && <p className="sd-sub">No answers yet.</p>}
            {storyRows.map((r, i) => (
              <div key={r.id} className="sd-row">
                <span className="sd-dot" style={{ background: STORY_COLORS[i % STORY_COLORS.length] }} />
                <span className="sd-row-label">{r.title}</span>
                <strong className="sd-row-value">{r.total}</strong>
                <span className="sd-pill">{pct(r.total, stats.total_selections)}%</span>
              </div>
            ))}
          </div>

          <div className="sd-boxes">
            <div className="sd-box sd-box-ok">
              <span className="sd-box-tag">Correct</span>
              <strong>{stats.correct_selections}</strong>
              <small>{pct(stats.correct_selections, stats.total_selections)}% accuracy</small>
            </div>
            <div className="sd-box sd-box-bad">
              <span className="sd-box-tag">Incorrect</span>
              <strong>{stats.incorrect_selections}</strong>
              <small>wrong answers</small>
            </div>
            <div className="sd-box sd-box-total">
              <span className="sd-box-tag">Total selections</span>
              <strong>{stats.total_selections}</strong>
              <small>{plural(stats.total_sessions, 'playthrough')}</small>
            </div>
          </div>
        </div>

        <div className="sd-col">
          <div className="sd-card sd-stat">
            <div className="sd-head">
              <DashIcon name="plays" tone="blue" />
              <div>
                <h2>Playthroughs</h2>
                <p className="sd-sub">Times this student played</p>
              </div>
            </div>
            <span className="sd-big">{stats.total_sessions}</span>
          </div>

          <div className="sd-card">
            <div className="sd-head">
              <DashIcon name="done" tone="green" />
              <div>
                <h2>Progress</h2>
                <p className="sd-sub">How the playthroughs are going</p>
              </div>
            </div>
            <div className="sd-tint sd-tint-ok">
              <div>
                <strong>Completed</strong>
                <small>Finished the story</small>
              </div>
              <div className="sd-tint-value">
                {stats.completed_sessions}
                <small>{pct(stats.completed_sessions, stats.total_sessions)}%</small>
              </div>
            </div>
            <div className="sd-tint sd-tint-info">
              <div>
                <strong>In progress</strong>
                <small>Still playing</small>
              </div>
              <div className="sd-tint-value">
                {stats.in_progress_sessions}
                <small>{pct(stats.in_progress_sessions, stats.total_sessions)}%</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rec-card">
        <h2>Stories played</h2>
        {byStory.size === 0 ? (
          <p className="rec-muted">This student has not played any stories yet.</p>
        ) : (
          <div className="rec-story-grid">
            {[...byStory.values()].map((r) => (
              <div key={r.id} className="rec-story">
                <h3>{r.title}</h3>
                <div className="rec-row">
                  <Badge kind="info">{plural(r.sessions, 'playthrough')}</Badge>
                  <Badge kind={r.completed > 0 ? 'ok' : 'warn'}>{r.completed} completed</Badge>
                </div>
                <div className="rec-row">
                  <span className="rec-ok-text">{r.correct} correct</span>
                  <span className="rec-bad-text">{r.incorrect} incorrect</span>
                </div>
                <div className="rec-bar" title="Share of correct selections">
                  <span style={{ width: `${pct(r.correct, r.correct + r.incorrect)}%` }} />
                </div>
                <button type="button" className="btn btn-primary" onClick={() => onOpenStory(r.id)}>
                  Scene-by-scene breakdown →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rec-card rec-flush">
        <h2 className="rec-pad">Session history</h2>
        {sessions.length === 0 ? (
          <p className="rec-empty">No sessions yet.</p>
        ) : (
          <div className="rec-wrap">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Story</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Last active</th>
                  <th>Selections</th>
                  <th>Correct</th>
                  <th>Incorrect</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.story_title}</strong>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>{fmt(s.started_at)}</td>
                    <td title={fmt(s.last_activity_at)}>{timeAgo(s.last_activity_at)}</td>
                    <td>{s.total_selections}</td>
                    <td className="rec-ok-text">{s.correct_selections}</td>
                    <td className="rec-bad-text">{s.incorrect_selections}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => onOpenSession(s.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene-by-scene breakdown for one student and one story
// ---------------------------------------------------------------------------
function Cell({ c }) {
  if (!c) return <span className="rec-muted">—</span>;
  if (c.resolved && c.fails === 0) return <Badge kind="ok">✓ first try</Badge>;
  if (c.resolved) return <Badge kind="warn">✓ after {plural(c.fails, 'fail')}</Badge>;
  return <Badge kind="bad">{plural(c.fails, 'fail')} · not solved</Badge>;
}

function StoryPerformance({ studentId, storyId, onBack, onOpenSession }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch(`${BASE}/students/${studentId}/stories/${storyId}/performance`)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [studentId, storyId]);

  if (error) {
    return (
      <div className="stack">
        <div className="alert alert-error">{error}</div>
        <div>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            ← Back to student
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <p>Loading breakdown…</p>;

  const { student, story_title: storyTitle, sessions, decisions, totals } = data;
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const hardest = decisions.reduce(
    (best, d) => (d.total_fails > (best?.total_fails ?? 0) ? d : best),
    null
  );

  return (
    <div className="stack">
      <div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Back to {student.username}
        </button>
      </div>

      <div className="rec-head">
        <div>
          <h1 className="rec-title">{storyTitle}</h1>
          <p className="rec-sub">Scene-by-scene breakdown for {student.username}</p>
        </div>
      </div>

      <div className="rec-tiles">
        <Tile tone="info" value={sessions.length} label="Playthroughs" />
        <Tile tone="ok" value={completed} label="Completed playthroughs" />
        <Tile value={totals.selections} label="Choice selections (total)" />
        <Tile tone="bad" value={totals.fails} label="Total fails (incorrect selections)" />
        <Tile
          tone="warn"
          text
          value={hardest ? `${hardest.scene_title} (${plural(hardest.total_fails, 'fail')})` : 'No fails yet'}
          label="Most-failed decision"
        />
      </div>

      <div className="rec-card rec-flush">
        <h2 className="rec-pad">Decision by decision</h2>
        <p className="rec-muted rec-pad">
          Every Eksena of the story is listed in story order. Each Run column is one playthrough. A fail is a wrong
          answer picked before the right one, so &quot;✓ after 2 fails&quot; means two wrong tries, then the right answer.
        </p>
        {decisions.length === 0 ? (
          <p className="rec-empty">No decisions have been answered yet.</p>
        ) : (
          <div className="rec-wrap">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Eksena</th>
                  <th>Total selections</th>
                  <th>Wrong tries (fails)</th>
                  <th>Solved in</th>
                  <th>Avg tries to solve</th>
                  {sessions.map((s) => (
                    <th key={s.id}>Run {s.number}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.scene_id}>
                    <td>
                      <strong>{d.scene_title}</strong>
                    </td>
                    <td>{d.total_attempts}</td>
                    <td className={d.total_fails > 0 ? 'rec-failnum' : ''}>{d.total_fails}</td>
                    <td>
                      {d.sessions_reached === 0 ? (
                        <Badge kind="info">Not reached yet</Badge>
                      ) : (
                        `${d.sessions_resolved}/${d.sessions_reached} runs`
                      )}
                    </td>
                    <td>{d.avg_attempts_to_solve ?? '—'}</td>
                    {d.per_session.map((c, i) => (
                      <td key={sessions[i].id}>
                        <Cell c={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rec-card rec-flush">
        <h2 className="rec-pad">Playthroughs</h2>
        <div className="rec-wrap">
          <table className="rec-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Started</th>
                <th>Selections</th>
                <th>Fails</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>Run {s.number}</strong>
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>{fmt(s.started_at)}</td>
                  <td>{s.selections}</td>
                  <td className={s.fails > 0 ? 'rec-failnum' : ''}>{s.fails}</td>
                  <td>
                    <button type="button" className="btn" onClick={() => onOpenSession(s.id)}>
                      Open log
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One playthrough: attempts per decision + chronological log
// ---------------------------------------------------------------------------
function SessionDetail({ sessionId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch(`${BASE}/sessions/${sessionId}`)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [sessionId]);

  if (error) {
    return (
      <div className="stack">
        <div className="alert alert-error">{error}</div>
        <div>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <p>Loading session…</p>;

  const { session, student, story_title: storyTitle, decisions, entries } = data;

  return (
    <div className="stack">
      <div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className="rec-card">
        <div className="rec-head">
          <div>
            <h1 className="rec-title">{storyTitle}</h1>
            <p className="rec-sub">
              {student?.username ?? 'Unknown student'} · started {fmt(session.started_at)}
              {session.completed_at ? ` · completed ${fmt(session.completed_at)}` : ''}
            </p>
          </div>
          <StatusBadge status={session.status} />
        </div>
      </div>

      <div className="rec-card rec-flush">
        <h2 className="rec-pad">Attempts per decision</h2>
        {decisions.length === 0 ? (
          <p className="rec-empty">No decisions were answered in this session.</p>
        ) : (
          <div className="rec-wrap">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Decision</th>
                  <th>Selections (attempts)</th>
                  <th>Incorrect</th>
                  <th>Resolved</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.scene_id}>
                    <td>
                      <strong>{d.scene_title}</strong>
                    </td>
                    <td>{d.attempts}</td>
                    <td className={d.incorrect > 0 ? 'rec-failnum' : ''}>{d.incorrect}</td>
                    <td>
                      <Badge kind={d.resolved ? 'ok' : 'warn'}>{d.resolved ? 'Yes' : 'No'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rec-card rec-flush">
        <h2 className="rec-pad">Chronological activity</h2>
        <p className="rec-muted rec-pad">Only decision choices are logged. Story-continue clicks are not.</p>
        {entries.length === 0 ? (
          <p className="rec-empty">No choices were recorded.</p>
        ) : (
          <div className="rec-wrap">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Scene</th>
                  <th>Choice selected</th>
                  <th>Result</th>
                  <th>Attempt</th>
                  <th>Resulting scene</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.step}</td>
                    <td>{fmt(e.selected_at)}</td>
                    <td>
                      <strong>{e.scene_title}</strong>
                      <div className="rec-muted">{e.scene_id?.slice(0, 8)}</div>
                    </td>
                    <td>{e.choice_text}</td>
                    <td>
                      <Badge kind={e.is_correct ? 'ok' : 'bad'}>{e.is_correct ? 'Correct' : 'Incorrect'}</Badge>
                    </td>
                    <td>{e.attempt_number}</td>
                    <td>
                      {e.resulting_scene_title ?? '—'}
                      {e.failure_text && <div className="rec-muted">Failure: {e.failure_text}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

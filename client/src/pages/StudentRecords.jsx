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
  in_progress: ['Kasalukuyang naglalaro', 'info'],
  completed: ['Natapos', 'ok'],
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

  if (view.type === 'mag-aaral') {
    return (
      <StudentDetail
        studentId={view.studentId}
        onBack={() => setView({ type: 'list' })}
        onOpenSession={(sessionId) =>
          setView({ type: 'session', sessionId, studentId: view.studentId, from: 'mag-aaral' })
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
        onBack={() => setView({ type: 'mag-aaral', studentId: view.studentId })}
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
            : setView({ type: 'mag-aaral', studentId: view.studentId })
        }
      />
    );
  }

  return (
    <div className="stack">
      <StudentList
        listState={listState}
        setListState={setListState}
        onOpen={(studentId) => setView({ type: 'mag-aaral', studentId })}
      />
    </div>
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
  const [reloadKey, setReloadKey] = useState(0);
  const [editingAccount, setEditingAccount] = useState(null);
  const [roleDraft, setRoleDraft] = useState('student');
  const [roleError, setRoleError] = useState('');
  const [savingRole, setSavingRole] = useState(false);

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
  }, [search, page, reloadKey]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const runSearch = () => setListState({ search: input.trim(), page: 1 });

  async function saveRole(event) {
    event.preventDefault();
    if (!editingAccount) return;
    setSavingRole(true);
    setRoleError('');
    try {
      await apiFetch(`${BASE}/students/${editingAccount.id}/role`, {
        method: 'PATCH',
        body: { role: roleDraft },
      });
      setEditingAccount(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setRoleError(err.message || 'Hindi ma-update ang uri ng account.');
    } finally {
      setSavingRole(false);
    }
  }

  return (
    <div className="stack">
      <div className="rec-head">
        <div>
          <h1 className="rec-title">Mga account</h1>
          <p className="rec-sub">
            {data ? `${plural(data.total, 'account')}${search ? ` matching “${search}”` : ''}` : 'Naglo-load…'}
          </p>
        </div>
      </div>

      <div className="rec-card">
        <div className="rec-toolbar">
          <input
            type="text"
            className="rec-search"
            value={input}
            placeholder="Maghanap gamit ang username o ipinapakitang pangalan"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          <button type="button" className="btn btn-primary" onClick={runSearch}>
            Maghanap
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
            <p className="rec-empty">Walang nahanap na mag-aaral.</p>
          ) : (
            <div className="rec-wrap">
              <table className="rec-table">
                <thead>
                  <tr>
                    <th aria-label="Baguhin ang uri ng account"></th>
                    <th>Mag-aaral</th>
                    <th>Email</th>
                    <th>Uri ng account</th>
                    <th>Nagparehistro</th>
                    <th>Mga sesyon</th>
                    <th>Natapos</th>
                    <th>Huling aktibo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.id}>
                      <td className="rec-role-edit-cell">
                        <button
                          type="button"
                          className="rec-role-edit"
                          aria-label={`Baguhin ang uri ng account ni ${s.username}`}
                          title={s.can_manage_admins ? 'Protektado ang superadmin na account' : 'Baguhin ang uri ng account'}
                          disabled={s.can_manage_admins}
                          onClick={() => {
                            setEditingAccount(s);
                            setRoleDraft(s.role);
                            setRoleError('');
                          }}
                        >
                          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </svg>
                        </button>
                      </td>
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
                      <td><Badge kind={s.role === 'admin' ? 'admin' : 'info'}>{s.role === 'admin' ? 'Admin' : 'Mag-aaral'}</Badge></td>
                      <td>{new Date(s.created_at).toLocaleDateString()}</td>
                      <td>{s.total_sessions}</td>
                      <td>
                        <Badge kind={s.completed_sessions > 0 ? 'ok' : 'info'}>
                          {s.completed_sessions}/{s.total_sessions}
                        </Badge>
                      </td>
                      <td title={fmt(s.last_activity)}>{timeAgo(s.last_activity)}</td>
                      <td>
                        {s.role === 'student' && <button type="button" className="btn" onClick={() => onOpen(s.id)}>Tingnan</button>}
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
      {editingAccount && (
        <div className="rec-role-overlay" onMouseDown={(event) => event.target === event.currentTarget && !savingRole && setEditingAccount(null)}>
          <form className="rec-role-dialog" role="dialog" aria-modal="true" aria-labelledby="rec-role-title" onSubmit={saveRole}>
            <h2 id="rec-role-title">Baguhin ang uri ng account</h2>
            <p className="rec-muted">{editingAccount.display_name || editingAccount.username} (@{editingAccount.username})</p>
            <label className="field">
              <span>Pahintulot</span>
              <select className="input" value={roleDraft} onChange={(event) => setRoleDraft(event.target.value)} disabled={savingRole}>
                <option value="student">Mag-aaral</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {roleError && <div className="alert alert-error" role="alert">{roleError}</div>}
            <div className="rec-role-actions">
              <button type="button" className="btn btn-ghost" disabled={savingRole} onClick={() => setEditingAccount(null)}>Kanselahin</button>
              <button type="submit" className="btn btn-primary" disabled={savingRole || roleDraft === editingAccount.role}>
                {savingRole ? 'Sine-save…' : 'I-save ang pagbabago'}
              </button>
            </div>
          </form>
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
  const [showAllSessions, setShowAllSessions] = useState(false);
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
            ← Bumalik to students
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <p>Naglo-load student…</p>;

  const { student, stats, sessions } = data;
  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, 5);
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
          ← Bumalik to students
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
              Burahin ang account
            </button>
          )}
        </div>

        {confirming && (
          <div className="rec-danger">
            <strong>Permanenteng burahin ang mag-aaral na ito?</strong>
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
                {deleting ? 'Deleting…' : 'Burahin nang tuluyan'}
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
              <h2>Mga sagot</h2>
              <p className="sd-sub">Mga sagot na pinili sa lahat ng kuwento</p>
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
            {storyRows.length === 0 && <p className="sd-sub">Wala pang sagot.</p>}
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
              <span className="sd-box-tag">Tama</span>
              <strong>{stats.correct_selections}</strong>
              <small>{pct(stats.correct_selections, stats.total_selections)}% accuracy</small>
            </div>
            <div className="sd-box sd-box-bad">
              <span className="sd-box-tag">Mali</span>
              <strong>{stats.incorrect_selections}</strong>
              <small>mga maling sagot</small>
            </div>
            <div className="sd-box sd-box-total">
              <span className="sd-box-tag">Kabuuang pinili</span>
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
                <h2>Mga paglalaro</h2>
                <p className="sd-sub">Bilang ng paglalaro ng mag-aaral</p>
              </div>
            </div>
            <span className="sd-big">{stats.total_sessions}</span>
          </div>

          <div className="sd-card">
            <div className="sd-head">
              <DashIcon name="done" tone="green" />
              <div>
                <h2>Progreso</h2>
                <p className="sd-sub">Kalagayan ng mga paglalaro</p>
              </div>
            </div>
            <div className="sd-tint sd-tint-ok">
              <div>
                <strong>Natapos</strong>
                <small>Natapos ang kuwento</small>
              </div>
              <div className="sd-tint-value">
                {stats.completed_sessions}
                <small>{pct(stats.completed_sessions, stats.total_sessions)}%</small>
              </div>
            </div>
            <div className="sd-tint sd-tint-info">
              <div>
                <strong>Kasalukuyang naglalaro</strong>
                <small>Nagpapatuloy sa paglalaro</small>
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
        <h2>Mga kuwentong nilaro</h2>
        {byStory.size === 0 ? (
          <p className="rec-muted">Wala pang kuwentong nilaro ang mag-aaral na ito.</p>
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
        <h2 className="rec-pad">Kasaysayan ng sesyon</h2>
        {sessions.length === 0 ? (
          <p className="rec-empty">Wala pang sesyon.</p>
        ) : (
          <>
            {sessions.length > 5 && (
              <details className="rec-session-history-details" onToggle={(event) => setShowAllSessions(event.currentTarget.open)}>
                <summary>Ipakita ang lahat ng sesyon ({sessions.length})</summary>
                <p>Lahat ng naitalang sesyon ang ipinapakita sa ibaba.</p>
              </details>
            )}
            <div className="rec-wrap">
              <table className="rec-table">
                <thead>
                  <tr>
                    <th>Kuwento</th>
                    <th>Estado</th>
                    <th>Nagsimula</th>
                    <th>Huling aktibo</th>
                    <th>Mga pinili</th>
                    <th>Tama</th>
                    <th>Mali</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSessions.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.story_title}</strong></td>
                      <td><StatusBadge status={s.status} /></td>
                      <td>{fmt(s.started_at)}</td>
                      <td title={fmt(s.last_activity_at)}>{timeAgo(s.last_activity_at)}</td>
                      <td>{s.total_selections}</td>
                      <td className="rec-ok-text">{s.correct_selections}</td>
                      <td className="rec-bad-text">{s.incorrect_selections}</td>
                      <td><button type="button" className="btn" onClick={() => onOpenSession(s.id)}>Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
  if (c.resolved && c.fails === 0) return <Badge kind="ok">✓ unang pagsubok</Badge>;
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
            ← Bumalik to student
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <p>Naglo-load breakdown…</p>;

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
          ← Bumalik to {student.username}
        </button>
      </div>

      <div className="rec-head">
        <div>
          <h1 className="rec-title">{storyTitle}</h1>
          <p className="rec-sub">Detalye ng bawat eksena para kay {student.username}</p>
        </div>
      </div>

      <div className="rec-tiles">
        <Tile tone="info" value={sessions.length} label="Mga paglalaro" />
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
        <h2 className="rec-pad">Bawat pasya</h2>
        <p className="rec-muted rec-pad">
          Every Eksena of the story is listed in story order. Each Paglalaro column is one playthrough. A fail is a wrong
          answer picked before the right one, so &quot;✓ after 2 fails&quot; means two wrong tries, then the right answer.
        </p>
        {decisions.length === 0 ? (
          <p className="rec-empty">Wala pang nasasagot na pasya.</p>
        ) : (
          <div className="rec-wrap">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Eksena</th>
                  <th>Kabuuang pinili</th>
                  <th>Mga maling pagsubok</th>
                  <th>Nalutas sa</th>
                  <th>Karaniwang bilang ng pagsubok bago malutas</th>
                  {sessions.map((s) => (
                    <th key={s.id}>Paglalaro {s.number}</th>
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
                        <Badge kind="info">Hindi pa nararating</Badge>
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
        <h2 className="rec-pad">Mga paglalaro</h2>
        <div className="rec-wrap">
          <table className="rec-table">
            <thead>
              <tr>
                <th>Paglalaro</th>
                <th>Estado</th>
                <th>Nagsimula</th>
                <th>Mga pinili</th>
                <th>Mga mali</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>Paglalaro {s.number}</strong>
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
            ← Bumalik
          </button>
        </div>
      </div>
    );
  }
  if (!data) return <p>Naglo-load session…</p>;

  const { session, student, story_title: storyTitle, decisions, entries } = data;

  return (
    <div className="stack">
      <div>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Bumalik
        </button>
      </div>

      <div className="rec-card">
        <div className="rec-head">
          <div>
            <h1 className="rec-title">{storyTitle}</h1>
            <p className="rec-sub">
              {student?.username ?? 'Unknown mag-aaral'} · started {fmt(session.started_at)}
              {session.completed_at ? ` · completed ${fmt(session.completed_at)}` : ''}
            </p>
          </div>
          <StatusBadge status={session.status} />
        </div>
      </div>

      <div className="rec-card rec-flush">
        <h2 className="rec-pad">Mga pagsubok sa bawat pasya</h2>
        {decisions.length === 0 ? (
          <p className="rec-empty">Walang nasagot na pasya sa sesyong ito.</p>
        ) : (
          <div className="rec-wrap">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Pasya</th>
                  <th>Mga pinili (pagsubok)</th>
                  <th>Mali</th>
                  <th>Nalutas</th>
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
        <h2 className="rec-pad">Mga aktibidad ayon sa oras</h2>
        <p className="rec-muted rec-pad">Tanging mga pagpili sa pasya ang itinatala, hindi ang pagpindot para ipagpatuloy ang kuwento.</p>
        {entries.length === 0 ? (
          <p className="rec-empty">Walang naitalang pagpili.</p>
        ) : (
          <div className="rec-wrap">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Oras</th>
                  <th>Eksena</th>
                  <th>Piniling sagot</th>
                  <th>Resulta</th>
                  <th>Pagsubok</th>
                  <th>Sumunod na eksena</th>
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
                      <Badge kind={e.is_correct ? 'ok' : 'bad'}>{e.is_correct ? 'Tama' : 'Mali'}</Badge>
                    </td>
                    <td>{e.attempt_number}</td>
                    <td>
                      {e.resulting_scene_title ?? '—'}
                      {e.failure_text && <div className="rec-muted">Pagkabigo: {e.failure_text}</div>}
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

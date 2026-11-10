import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';

const BASE = '/admin/records';
const PAGE_SIZE = 15;
const PREVIEW_ROWS = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();

function timeAgo(d) {
  if (!d) return 'Wala pa';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Ngayon lang';
  if (s < 3600) return `${Math.floor(s / 60)} min ang nakaraan`;
  if (s < 86400) return `${Math.floor(s / 3600)} oras ang nakaraan`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} araw ang nakaraan`;
  return new Date(d).toLocaleDateString();
}

const STATUS = {
  in_progress: ['Naglalaro', 'info'],
  completed: ['Natapos', 'ok'],
  abandoned: ['Itinigil', 'warn'],
};

const ICONS = {
  search: ['M21 21l-4.3-4.3', 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z'],
  back: ['M15 18l-6-6 6-6'],
  close: ['M18 6L6 18', 'M6 6l12 12'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6', 'M14 11v6'],
  chevron: ['M9 18l6-6-6-6'],
  play: ['M6 4l14 8-14 8z'],
  check: ['M20 6L9 17l-5-5'],
  cursor: ['M3 3l7 17 2.5-7.5L20 10z'],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  alert: [
    'M12 9v4',
    'M12 17h.01',
    'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  ],
  layers: ['M12 2l10 5-10 5L2 7z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// Small data hook: loads a path, keeps the previous data while reloading.
function useFetch(path) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [key, setKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    apiFetch(path)
      .then((data) => active && setState({ data, error: '', loading: false }))
      .catch((e) =>
        active &&
        setState((s) => ({ ...s, error: e.message || 'May nangyaring error.', loading: false }))
      );
    return () => {
      active = false;
    };
  }, [path, key]);

  const reload = useCallback(() => setKey((k) => k + 1), []);
  return { ...state, reload };
}

// ---------------------------------------------------------------------------
// Shared UI pieces
// ---------------------------------------------------------------------------
function Badge({ kind = 'neutral', children }) {
  return <span className={`sr-badge sr-badge-${kind}`}>{children}</span>;
}

function StatusBadge({ status }) {
  const [label, kind] = STATUS[status] ?? [status, 'neutral'];
  return <Badge kind={kind}>{label}</Badge>;
}

function Tile({ label, value, sub, icon, text }) {
  return (
    <div className="sr-tile">
      {icon && (
        <div className="sr-tile-icon">
          <Icon name={icon} size={20} />
        </div>
      )}
      <div className="sr-tile-body">
        <div className="sr-tile-label">{label}</div>
        <div className={text ? 'sr-tile-value sr-tile-value-text' : 'sr-tile-value'}>{value}</div>
        {sub && <div className="sr-tile-sub">{sub}</div>}
      </div>
    </div>
  );
}

function AccuracyBar({ correct, incorrect }) {
  const total = correct + incorrect;
  if (total === 0) {
    return (
      <div>
        <div className="sr-acc-track" />
        <div className="sr-acc-legend sr-muted">Wala pang sagot</div>
      </div>
    );
  }
  const right = pct(correct, total);
  return (
    <div>
      <div className="sr-acc-track" role="img" aria-label={`${right}% tama`}>
        <span className="sr-acc-ok" style={{ width: `${right}%` }} />
        <span className="sr-acc-bad" style={{ width: `${100 - right}%` }} />
      </div>
      <div className="sr-acc-legend">
        <span className="sr-ok-text">{correct} tama</span>
        <span className="sr-bad-text">{incorrect} mali</span>
        <span className="sr-muted">{right}% katumpakan</span>
      </div>
    </div>
  );
}

function Loading({ label }) {
  return (
    <div className="sr-loading" role="status">
      <span className="sr-spinner" />
      <span>{label}</span>
    </div>
  );
}

function ErrorState({ message, onRetry, onBack, backLabel = 'Bumalik' }) {
  return (
    <div className="sr-card sr-error-state">
      <div className="alert alert-error" role="alert">
        {message}
      </div>
      <div className="sr-row">
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Subukan muli
          </button>
        )}
        {onBack && (
          <button type="button" className="btn" onClick={onBack}>
            {backLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function Breadcrumbs({ items }) {
  return (
    <nav className="sr-crumbs" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="sr-crumb">
            {i > 0 && <Icon name="chevron" size={14} />}
            {item.onClick && !last ? (
              <button type="button" onClick={item.onClick}>
                {item.label}
              </button>
            ) : (
              <span className={last ? 'sr-crumb-current' : ''} aria-current={last ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Modal({ title, subtitle, onClose, busy, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div
      className="sr-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="sr-modal" role="dialog" aria-modal="true" aria-labelledby="sr-modal-title">
        <div className="sr-modal-head">
          <div>
            <h2 id="sr-modal-title">{title}</h2>
            {subtitle && <p className="sr-muted">{subtitle}</p>}
          </div>
          <button type="button" className="sr-icon-btn" onClick={onClose} disabled={busy} aria-label="Isara">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parent: simple view switcher
// ---------------------------------------------------------------------------
export default function StudentRecords() {
  const [view, setView] = useState({ type: 'list' });
  const [listState, setListState] = useState({ search: '', role: 'all', page: 1 });

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const goList = () => setView({ type: 'list' });
  const goStudent = (studentId) => () => setView({ type: 'mag-aaral', studentId });
  const goStory = (studentId, storyId) => () => setView({ type: 'performance', studentId, storyId });

  let content;

  if (view.type === 'mag-aaral') {
    content = (
      <StudentDetail
        studentId={view.studentId}
        onHome={goList}
        onOpenSession={(sessionId) =>
          setView({ type: 'session', sessionId, studentId: view.studentId, from: 'mag-aaral' })
        }
        onOpenStory={(storyId) => goStory(view.studentId, storyId)()}
      />
    );
  } else if (view.type === 'performance') {
    content = (
      <StoryPerformance
        studentId={view.studentId}
        storyId={view.storyId}
        onHome={goList}
        onStudent={goStudent(view.studentId)}
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
  } else if (view.type === 'session') {
    const fromPerformance = view.from === 'performance';
    content = (
      <SessionDetail
        sessionId={view.sessionId}
        onHome={goList}
        onStudent={goStudent(view.studentId)}
        onStory={fromPerformance ? goStory(view.studentId, view.storyId) : undefined}
        onBack={fromPerformance ? goStory(view.studentId, view.storyId) : goStudent(view.studentId)}
      />
    );
  } else {
    content = (
      <StudentList
        listState={listState}
        setListState={setListState}
        onOpen={(studentId) => setView({ type: 'mag-aaral', studentId })}
      />
    );
  }

  return <div className="sr-root">{content}</div>;
}

// ---------------------------------------------------------------------------
// Account list
// ---------------------------------------------------------------------------
function StudentList({ listState, setListState, onOpen }) {
  const { search, role = 'all', page } = listState;
  const [input, setInput] = useState(search);
  const [editingAccount, setEditingAccount] = useState(null);
  const [roleDraft, setRoleDraft] = useState('student');
  const [roleError, setRoleError] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const { data, error, loading, reload } = useFetch(
    `${BASE}/students?${new URLSearchParams({ search, role, page, pageSize: PAGE_SIZE })}`
  );

  // Search as you type (debounced). Enter searches immediately.
  useEffect(() => {
    const t = setTimeout(() => {
      const value = input.trim();
      if (value !== search) setListState({ search: value, role, page: 1 });
    }, 350);
    return () => clearTimeout(t);
  }, [input, role, search, setListState]);

  const runSearch = () => setListState({ search: input.trim(), role, page: 1 });
  const clearSearch = () => {
    setInput('');
    setListState({ search: '', role, page: 1 });
  };

  const pageSize = data?.pageSize ?? PAGE_SIZE;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const rangeStart = data && data.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = data ? Math.min(page * pageSize, data.total) : 0;

  const closeRoleDialog = useCallback(() => setEditingAccount(null), []);

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
      reload();
    } catch (err) {
      setRoleError(err.message || 'Hindi ma-update ang uri ng account.');
    } finally {
      setSavingRole(false);
    }
  }

  return (
    <>
      <header className="sr-head">
        <div>
          <h1 className="sr-title">Mga account</h1>
          <p className="sr-sub">
            {data
              ? `${data.total} account${search ? ` na tumutugma sa “${search}”` : ''}`
              : 'Naglo-load…'}
          </p>
        </div>
      </header>

      <div className="sr-card sr-toolbar">
        <div className="sr-search">
          <Icon name="search" size={18} />
          <input
            type="text"
            value={input}
            placeholder="Maghanap gamit ang username o pangalan"
            aria-label="Maghanap ng account"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          {input && (
            <button type="button" className="sr-search-clear" onClick={clearSearch} aria-label="I-clear ang paghahanap">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <select
          className="sr-select sr-role-filter"
          value={role}
          aria-label="Salain ayon sa uri ng account"
          onChange={(event) => setListState({ search, role: event.target.value, page: 1 })}
        >
          <option value="all">Lahat ng account</option>
          <option value="student">Mag-aaral</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}{' '}
          <button type="button" className="sr-link" onClick={reload}>
            Subukan muli
          </button>
        </div>
      )}

      {!data && loading && <Loading label="Naglo-load ang mga account…" />}

      {data && (
        <div
          className="sr-card sr-flush"
          style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 120ms' }}
          aria-busy={loading}
        >
          {data.students.length === 0 ? (
            <div className="sr-empty">
              <strong>Walang nahanap na account</strong>
              <p>{search ? 'Subukan ang ibang salita sa paghahanap.' : 'Wala pang nakarehistro.'}</p>
              {search && (
                <button type="button" className="btn" onClick={clearSearch}>
                  I-clear ang paghahanap
                </button>
              )}
            </div>
          ) : (
            <div className="sr-table-wrap">
              <table className="sr-table sr-table-accounts">
                <thead>
                  <tr>
                    <th>Mag-aaral</th>
                    <th className="sr-hide-md">Email</th>
                    <th>Uri</th>
                    <th className="sr-hide-md">Nagparehistro</th>
                    <th className="sr-num">Sesyon</th>
                    <th className="sr-num">Natapos</th>
                    <th className="sr-hide-sm">Huling aktibo</th>
                    <th aria-label="Mga aksyon" />
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="sr-user">
                          <div className="sr-avatar">{initial(s.username)}</div>
                          <div className="sr-user-text">
                            <strong>{s.username}</strong>
                            <span className="sr-muted">{s.display_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="sr-hide-md">{s.email ?? '—'}</td>
                      <td>
                        <Badge kind={s.role === 'admin' ? 'admin' : 'info'}>
                          {s.role === 'admin' ? 'Admin' : 'Mag-aaral'}
                        </Badge>
                      </td>
                      <td className="sr-hide-md">{fmtDate(s.created_at)}</td>
                      <td className="sr-num">{s.total_sessions}</td>
                      <td className="sr-num">
                        <Badge kind={s.completed_sessions > 0 ? 'ok' : 'neutral'}>
                          {s.completed_sessions}/{s.total_sessions}
                        </Badge>
                      </td>
                      <td className="sr-hide-sm" title={fmt(s.last_activity)}>
                        {timeAgo(s.last_activity)}
                      </td>
                      <td>
                        <div className="sr-actions">
                          {s.role === 'student' && (
                            <button type="button" className="btn sr-btn-sm" onClick={() => onOpen(s.id)}>
                              Tingnan
                            </button>
                          )}
                          <button
                            type="button"
                            className="sr-icon-btn"
                            aria-label={`Baguhin ang uri ng account ni ${s.username}`}
                            title={
                              s.can_manage_admins
                                ? 'Protektado ang superadmin na account'
                                : 'Baguhin ang uri ng account'
                            }
                            disabled={s.can_manage_admins}
                            onClick={() => {
                              setEditingAccount(s);
                              setRoleDraft(s.role);
                              setRoleError('');
                            }}
                          >
                            <Icon name="edit" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="sr-pager">
            <span className="sr-muted">
              {data.total > 0 ? `Ipinapakita ang ${rangeStart}–${rangeEnd} ng ${data.total}` : 'Walang ipapakita'}
            </span>
            <div className="sr-row">
              <button
                type="button"
                className="btn sr-btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setListState({ search, role, page: page - 1 })}
              >
                ← Nakaraan
              </button>
              <span className="sr-muted">
                Pahina {page} ng {totalPages}
              </span>
              <button
                type="button"
                className="btn sr-btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setListState({ search, role, page: page + 1 })}
              >
                Susunod →
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAccount && (
        <Modal
          title="Baguhin ang uri ng account"
          subtitle={`${editingAccount.display_name || editingAccount.username} (@${editingAccount.username})`}
          onClose={closeRoleDialog}
          busy={savingRole}
        >
          <form className="sr-modal-body" onSubmit={saveRole}>
            <label className="sr-field">
              <span>Pahintulot</span>
              <select
                className="sr-select"
                value={roleDraft}
                onChange={(e) => setRoleDraft(e.target.value)}
                disabled={savingRole}
              >
                <option value="student">Mag-aaral</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {roleDraft === 'admin' && roleDraft !== editingAccount.role && (
              <div className="alert alert-warn">Magkakaroon ng admin access ang account na ito.</div>
            )}
            {roleError && (
              <div className="alert alert-error" role="alert">
                {roleError}
              </div>
            )}
            <div className="sr-modal-actions">
              <button type="button" className="btn" disabled={savingRole} onClick={closeRoleDialog}>
                Kanselahin
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingRole || roleDraft === editingAccount.role}
              >
                {savingRole ? 'Sine-save…' : 'I-save ang pagbabago'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Student detail
// ---------------------------------------------------------------------------
function StudentDetail({ studentId, onHome, onOpenSession, onOpenStory }) {
  const { data, error, reload } = useFetch(`${BASE}/students/${studentId}`);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const closeConfirm = useCallback(() => setConfirming(false), []);

  if (error && !data) {
    return <ErrorState message={error} onRetry={reload} onBack={onHome} backLabel="← Bumalik sa listahan" />;
  }
  if (!data) return <Loading label="Naglo-load ang mag-aaral…" />;

  const { student, stats, sessions } = data;
  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, PREVIEW_ROWS);
  const canDelete = typed.trim().toLowerCase() === student.username.toLowerCase();

  async function deleteStudent() {
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`${BASE}/students/${studentId}`, {
        method: 'DELETE',
        body: { confirmUsername: typed },
      });
      onHome();
    } catch (err) {
      setDeleteError(err.message || 'Hindi nabura ang account.');
      setDeleting(false);
    }
  }

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
  const stories = [...byStory.values()];

  return (
    <>
      <Breadcrumbs items={[{ label: 'Mga account', onClick: onHome }, { label: student.username }]} />

      <div className="sr-card sr-profile">
        <div className="sr-user">
          <div className="sr-avatar sr-avatar-lg">{initial(student.username)}</div>
          <div className="sr-user-text">
            <h1 className="sr-title">{student.username}</h1>
            <p className="sr-sub">
              {student.display_name} · {student.email ?? 'walang email'}
            </p>
            <p className="sr-sub">
              Nagparehistro {fmtDate(student.created_at)} · huling aktibo {timeAgo(stats.last_activity)}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn sr-btn-danger-ghost"
          onClick={() => {
            setTyped('');
            setDeleteError('');
            setConfirming(true);
          }}
        >
          <Icon name="trash" />
          Burahin ang account
        </button>
      </div>

      <div className="sr-tiles">
        <Tile icon="play" label="Mga paglalaro" value={stats.total_sessions} />
        <Tile
          icon="check"
          label="Natapos"
          value={stats.completed_sessions}
          sub={`${pct(stats.completed_sessions, stats.total_sessions)}% ng mga paglalaro`}
        />
        <Tile
          icon="cursor"
          label="Kabuuang pinili"
          value={stats.total_selections}
          sub={`${stats.in_progress_sessions} ang kasalukuyang nilalaro`}
        />
        <Tile
          icon="target"
          label="Katumpakan"
          value={stats.total_selections > 0 ? `${pct(stats.correct_selections, stats.total_selections)}%` : '—'}
          sub={`${stats.correct_selections} tama · ${stats.incorrect_selections} mali`}
        />
      </div>

      <section className="sr-card">
        <h2 className="sr-h2">Mga kuwentong nilaro</h2>
        {stories.length === 0 ? (
          <p className="sr-muted">Wala pang kuwentong nilaro ang mag-aaral na ito.</p>
        ) : (
          <div className="sr-story-grid">
            {stories.map((r) => (
              <article key={r.id} className="sr-story">
                <h3>{r.title}</h3>
                <div className="sr-row">
                  <Badge kind="info">{r.sessions} paglalaro</Badge>
                  <Badge kind={r.completed > 0 ? 'ok' : 'neutral'}>{r.completed} natapos</Badge>
                </div>
                <AccuracyBar correct={r.correct} incorrect={r.incorrect} />
                <button type="button" className="btn btn-primary sr-btn-sm" onClick={() => onOpenStory(r.id)}>
                  Breakdown kada eksena →
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="sr-card sr-flush">
        <div className="sr-card-head">
          <h2 className="sr-h2">Kasaysayan ng sesyon</h2>
          {sessions.length > PREVIEW_ROWS && (
            <button
              type="button"
              className="btn sr-btn-sm"
              aria-expanded={showAllSessions}
              onClick={() => setShowAllSessions((v) => !v)}
            >
              {showAllSessions ? 'Ipakita ang mas kaunti' : `Ipakita lahat (${sessions.length})`}
            </button>
          )}
        </div>
        {sessions.length === 0 ? (
          <p className="sr-empty-inline">Wala pang sesyon.</p>
        ) : (
          <div className="sr-table-wrap">
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Kuwento</th>
                  <th>Estado</th>
                  <th className="sr-hide-md">Nagsimula</th>
                  <th className="sr-hide-sm">Huling aktibo</th>
                  <th className="sr-num">Pinili</th>
                  <th className="sr-num">Tama</th>
                  <th className="sr-num">Mali</th>
                  <th aria-label="Mga aksyon" />
                </tr>
              </thead>
              <tbody>
                {visibleSessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.story_title}</strong>
                    </td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="sr-hide-md">{fmt(s.started_at)}</td>
                    <td className="sr-hide-sm" title={fmt(s.last_activity_at)}>
                      {timeAgo(s.last_activity_at)}
                    </td>
                    <td className="sr-num">{s.total_selections}</td>
                    <td className="sr-num sr-ok-text">{s.correct_selections}</td>
                    <td className={`sr-num ${s.incorrect_selections > 0 ? 'sr-bad-text' : ''}`}>
                      {s.incorrect_selections}
                    </td>
                    <td>
                      <div className="sr-actions">
                        <button type="button" className="btn sr-btn-sm" onClick={() => onOpenSession(s.id)}>
                          Buksan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirming && (
        <Modal
          title="Permanenteng burahin ang mag-aaral?"
          subtitle={`${student.display_name || student.username} (@${student.username})`}
          onClose={closeConfirm}
          busy={deleting}
        >
          <div className="sr-modal-body">
            <p className="sr-body-text">
              Buburahin nito ang account, ang sign-in, at lahat ng game session at kasaysayan ng mga pinili ng
              mag-aaral na ito. Hindi na ito maibabalik.
            </p>
            <label className="sr-field">
              <span>I-type ang “{student.username}” para kumpirmahin</span>
              <input
                type="text"
                className="sr-input"
                value={typed}
                autoFocus
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
              />
            </label>
            {deleteError && (
              <div className="alert alert-error" role="alert">
                {deleteError}
              </div>
            )}
            <div className="sr-modal-actions">
              <button type="button" className="btn" disabled={deleting} onClick={closeConfirm}>
                Kanselahin
              </button>
              <button
                type="button"
                className="sr-btn-danger"
                disabled={!canDelete || deleting}
                onClick={deleteStudent}
              >
                {deleting ? 'Binubura…' : 'Burahin nang tuluyan'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Scene-by-scene breakdown for one student and one story
// ---------------------------------------------------------------------------
function Cell({ c }) {
  if (!c) return <span className="sr-muted">—</span>;
  if (c.resolved && c.fails === 0) return <Badge kind="ok">✓ Unang subok</Badge>;
  if (c.resolved) return <Badge kind="warn">✓ Pagkatapos ng {c.fails} mali</Badge>;
  return <Badge kind="bad">{c.fails} mali · hindi nalutas</Badge>;
}

function StoryPerformance({ studentId, storyId, onHome, onStudent, onOpenSession }) {
  const { data, error, reload } = useFetch(`${BASE}/students/${studentId}/stories/${storyId}/performance`);
  const [showAllPlays, setShowAllPlays] = useState(false);

  if (error && !data) {
    return <ErrorState message={error} onRetry={reload} onBack={onStudent} backLabel="← Bumalik sa mag-aaral" />;
  }
  if (!data) return <Loading label="Naglo-load ang breakdown…" />;

  const { student, story_title: storyTitle, sessions, decisions, totals } = data;
  const visiblePlays = showAllPlays ? sessions : sessions.slice(0, PREVIEW_ROWS);
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const hardest = decisions.reduce(
    (best, d) => (d.total_fails > (best?.total_fails ?? 0) ? d : best),
    null
  );
  const maxFails = hardest?.total_fails ?? 0;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Mga account', onClick: onHome },
          { label: student.username, onClick: onStudent },
          { label: storyTitle },
        ]}
      />

      <header className="sr-head">
        <div>
          <h1 className="sr-title">{storyTitle}</h1>
          <p className="sr-sub">Detalye ng bawat eksena para kay {student.username}</p>
        </div>
      </header>

      <div className="sr-tiles">
        <Tile icon="play" label="Mga paglalaro" value={sessions.length} />
        <Tile icon="check" label="Natapos na paglalaro" value={completed} />
        <Tile icon="cursor" label="Kabuuang pinili" value={totals.selections} />
        <Tile icon="close" label="Kabuuang mali" value={totals.fails} />
        <Tile
          icon="alert"
          text
          label="Pinakamaraming mali"
          value={hardest ? hardest.scene_title : 'Wala pang mali'}
          sub={hardest ? `${hardest.total_fails} mali` : undefined}
        />
      </div>

      <section className="sr-card sr-flush">
        <div className="sr-card-head sr-card-head-stack">
          <h2 className="sr-h2">Bawat pasya</h2>
          <p className="sr-muted">
            Nakalista ang bawat eksena ayon sa pagkakasunod ng kuwento. Ang bawat “Paglalaro” ay isang playthrough.
            Ang “mali” ay maling sagot na napili bago ang tama, kaya ang “Pagkatapos ng 2 mali” ay dalawang maling
            subok bago ang tamang sagot.
          </p>
        </div>
        {decisions.length === 0 ? (
          <p className="sr-empty-inline">Wala pang nasasagot na pasya.</p>
        ) : (
          <div className="sr-table-wrap">
            <table className="sr-table sr-table-matrix">
              <thead>
                <tr>
                  <th>Eksena</th>
                  <th className="sr-num">Kabuuang pinili</th>
                  <th className="sr-num">Mali</th>
                  <th>Nalutas sa</th>
                  <th className="sr-num">Karaniwang subok bago malutas</th>
                  {sessions.map((s) => (
                    <th key={s.id}>Paglalaro {s.number}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => {
                  const hot = maxFails > 0 && d.total_fails === maxFails;
                  return (
                    <tr key={d.scene_id} className={hot ? 'sr-row-hot' : ''}>
                      <td>
                        <strong>{d.scene_title}</strong>
                      </td>
                      <td className="sr-num">{d.total_attempts}</td>
                      <td className={`sr-num ${d.total_fails > 0 ? 'sr-bad-text' : ''}`}>{d.total_fails}</td>
                      <td>
                        {d.sessions_reached === 0 ? (
                          <Badge kind="neutral">Hindi pa nararating</Badge>
                        ) : (
                          `${d.sessions_resolved}/${d.sessions_reached} paglalaro`
                        )}
                      </td>
                      <td className="sr-num">{d.avg_attempts_to_solve ?? '—'}</td>
                      {d.per_session.map((c, i) => (
                        <td key={sessions[i].id}>
                          <Cell c={c} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-card sr-flush">
        <div className="sr-card-head">
          <h2 className="sr-h2">Mga paglalaro</h2>
          {sessions.length > PREVIEW_ROWS && (
            <button
              type="button"
              className="btn sr-btn-sm"
              aria-expanded={showAllPlays}
              onClick={() => setShowAllPlays((v) => !v)}
            >
              {showAllPlays ? 'Ipakita ang mas kaunti' : `Ipakita lahat (${sessions.length})`}
            </button>
          )}
        </div>
        <div className="sr-table-wrap">
          <table className="sr-table">
            <thead>
              <tr>
                <th>Paglalaro</th>
                <th>Estado</th>
                <th className="sr-hide-sm">Nagsimula</th>
                <th className="sr-num">Pinili</th>
                <th className="sr-num">Mali</th>
                <th aria-label="Mga aksyon" />
              </tr>
            </thead>
            <tbody>
              {visiblePlays.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>Paglalaro {s.number}</strong>
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="sr-hide-sm">{fmt(s.started_at)}</td>
                  <td className="sr-num">{s.selections}</td>
                  <td className={`sr-num ${s.fails > 0 ? 'sr-bad-text' : ''}`}>{s.fails}</td>
                  <td>
                    <div className="sr-actions">
                      <button type="button" className="btn sr-btn-sm" onClick={() => onOpenSession(s.id)}>
                        Buksan ang log
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// One playthrough: attempts per decision + chronological log
// ---------------------------------------------------------------------------
function SessionDetail({ sessionId, onHome, onStudent, onStory, onBack }) {
  const { data, error, reload } = useFetch(`${BASE}/sessions/${sessionId}`);

  if (error && !data) {
    return <ErrorState message={error} onRetry={reload} onBack={onBack} backLabel="← Bumalik" />;
  }
  if (!data) return <Loading label="Naglo-load ang sesyon…" />;

  const { session, student, story_title: storyTitle, decisions, entries } = data;
  const resolvedCount = decisions.filter((d) => d.resolved).length;
  const totalAttempts = decisions.reduce((sum, d) => sum + d.attempts, 0);
  const totalWrong = decisions.reduce((sum, d) => sum + d.incorrect, 0);

  const crumbs = [{ label: 'Mga account', onClick: onHome }];
  if (student) crumbs.push({ label: student.username, onClick: onStudent });
  crumbs.push({ label: storyTitle, onClick: onStory });
  crumbs.push({ label: 'Sesyon' });

  return (
    <>
      <Breadcrumbs items={crumbs} />

      <div className="sr-card sr-profile">
        <div>
          <h1 className="sr-title">{storyTitle}</h1>
          <p className="sr-sub">
            {student?.username ?? 'Hindi kilalang mag-aaral'} · nagsimula {fmt(session.started_at)}
            {session.completed_at ? ` · natapos ${fmt(session.completed_at)}` : ''}
          </p>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div className="sr-tiles">
        <Tile icon="layers" label="Mga pasya" value={decisions.length} />
        <Tile icon="check" label="Nalutas" value={resolvedCount} sub={`${pct(resolvedCount, decisions.length)}%`} />
        <Tile icon="cursor" label="Kabuuang pinili" value={totalAttempts} />
        <Tile icon="close" label="Mali" value={totalWrong} />
      </div>

      <section className="sr-card sr-flush">
        <div className="sr-card-head">
          <h2 className="sr-h2">Mga pagsubok sa bawat pasya</h2>
        </div>
        {decisions.length === 0 ? (
          <p className="sr-empty-inline">Walang nasagot na pasya sa sesyong ito.</p>
        ) : (
          <div className="sr-table-wrap">
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Pasya</th>
                  <th className="sr-num">Pagsubok</th>
                  <th className="sr-num">Mali</th>
                  <th>Nalutas</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={d.scene_id}>
                    <td>
                      <strong>{d.scene_title}</strong>
                    </td>
                    <td className="sr-num">{d.attempts}</td>
                    <td className={`sr-num ${d.incorrect > 0 ? 'sr-bad-text' : ''}`}>{d.incorrect}</td>
                    <td>
                      <Badge kind={d.resolved ? 'ok' : 'warn'}>{d.resolved ? 'Oo' : 'Hindi pa'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sr-card sr-flush">
        <div className="sr-card-head sr-card-head-stack">
          <h2 className="sr-h2">Mga aktibidad ayon sa oras</h2>
          <p className="sr-muted">
            Tanging mga pagpili sa pasya ang itinatala, hindi ang pagpindot para ipagpatuloy ang kuwento.
          </p>
        </div>
        {entries.length === 0 ? (
          <p className="sr-empty-inline">Walang naitalang pagpili.</p>
        ) : (
          <div className="sr-table-wrap">
            <table className="sr-table">
              <thead>
                <tr>
                  <th className="sr-num">#</th>
                  <th className="sr-hide-sm">Oras</th>
                  <th>Eksena</th>
                  <th>Piniling sagot</th>
                  <th>Resulta</th>
                  <th className="sr-num">Subok</th>
                  <th className="sr-hide-md">Sumunod na eksena</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="sr-num">{e.step}</td>
                    <td className="sr-hide-sm">{fmt(e.selected_at)}</td>
                    <td>
                      <strong>{e.scene_title}</strong>
                      <div className="sr-muted sr-mono">{e.scene_id?.slice(0, 8)}</div>
                    </td>
                    <td>{e.choice_text}</td>
                    <td>
                      <Badge kind={e.is_correct ? 'ok' : 'bad'}>{e.is_correct ? 'Tama' : 'Mali'}</Badge>
                    </td>
                    <td className="sr-num">{e.attempt_number}</td>
                    <td className="sr-hide-md">
                      {e.resulting_scene_title ?? '—'}
                      {e.failure_text && <div className="sr-muted">Pagkabigo: {e.failure_text}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
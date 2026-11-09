import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

function StatCard({ label, value, hint, tone }) {
  return (
    <div className={`stat-card ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetRequests, setResetRequests] = useState([]);
  const [reviewing, setReviewing] = useState('');
  const [reviewError, setReviewError] = useState('');

  async function loadResetRequests() {
    try {
      const result = await apiFetch('/admin/password-resets');
      setResetRequests(result.requests || []);
    } catch (err) {
      setReviewError(err.message || 'Could not load password reset requests.');
    }
  }

  async function reviewRequest(id, decision) {
    setReviewing(id);
    setReviewError('');
    try {
      await apiFetch(`/admin/password-resets/${id}/review`, { method: 'POST', body: { decision } });
      await loadResetRequests();
      const result = await apiFetch('/admin/dashboard');
      setData(result);
    } catch (err) {
      setReviewError(err.message || 'Could not review this request.');
    } finally {
      setReviewing('');
    }
  }

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const result = await apiFetch('/admin/dashboard');
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err.message || 'Could not load the dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    loadResetRequests();
    const refreshTimer = window.setInterval(loadResetRequests, 30000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  if (loading) return <p>Loading dashboard…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const { stats, recentActivity } = data;

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">Live statistics from the database.</p>
        </div>
      </div>

      {stats.pendingPasswordResets > 0 && (
        <div className="alert alert-warn">
          {stats.pendingPasswordResets} password reset request
          {stats.pendingPasswordResets === 1 ? '' : 's'} awaiting review.
        </div>
      )}

      <section className="panel stack">
        <div className="page-heading"><div><h2>Password reset requests</h2><p className="muted">Review student requests. Approved students receive a reset link at their registered email.</p></div></div>
        {reviewError && <div className="alert alert-error">{reviewError}</div>}
        {resetRequests.length === 0 ? <p className="muted">No requests are awaiting review.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Student</th><th>Requested</th><th>Actions</th></tr></thead>
            <tbody>{resetRequests.map((request) => <tr key={request.id}>
              <td>{request.profiles?.display_name || request.profiles?.username || 'Student'} <span className="muted">({request.profiles?.username})</span></td>
              <td>{new Date(request.requested_at).toLocaleString()}</td>
              <td className="table-actions">
                <button type="button" className="btn btn-primary" disabled={Boolean(reviewing)} onClick={() => reviewRequest(request.id, 'approved')}>{reviewing === request.id ? 'Saving…' : 'Approve'}</button>
                <button type="button" className="btn" disabled={Boolean(reviewing)} onClick={() => reviewRequest(request.id, 'rejected')}>Reject</button>
              </td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>

      <div className="stat-grid">
        <StatCard label="Registered students" value={stats.totalStudents} />
        <StatCard
          label="Stories"
          value={stats.totalStories}
          hint={`${stats.publishedStories} published`}
        />
        <StatCard label="Game sessions" value={stats.totalSessions} />
        <StatCard label="Completed sessions" value={stats.completedSessions} />
        <StatCard label="Completion rate" value={`${stats.completionRate}%`} />
        <StatCard
          label="Password reset requests"
          value={stats.pendingPasswordResets}
          hint="pending"
          tone={stats.pendingPasswordResets > 0 ? 'warn' : undefined}
        />
        <StatCard label="Choice selections logged" value={stats.totalChoiceSelections} />
        <StatCard label="In progress" value={stats.inProgressSessions} />
      </div>

      <div className="page-heading">
        <h2>Recent activity</h2>
      </div>

      {recentActivity.length === 0 ? (
        <div className="panel">
          <p className="muted">No game sessions yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Story</th>
                <th>Status</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((session) => (
                <tr key={session.id}>
                  <td>{session.profiles?.username || '—'}</td>
                  <td>{session.stories?.title || '—'}</td>
                  <td>
                    <span className={`badge badge-${session.status}`}>{session.status}</span>
                  </td>
                  <td>{new Date(session.last_activity_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="quick-links">
        <Link className="btn" to="/admin/students">
          Manage students
        </Link>
        <Link className="btn" to="/admin/stories">
          Configure stories
        </Link>
      </div>
    </div>
  );
}

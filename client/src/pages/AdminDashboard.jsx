import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import StoryAnalyticsDashboard from '../components/admin/StoryAnalyticsDashboard';

function RecentActivity({ sessions }) {
  return (
    <section className="analytics-panel analytics-recent-panel">
      <div className="analytics-panel-heading">
        <div><h2>Recent activity</h2><p>The latest student story sessions.</p></div>
        <Link to="/admin/students">View students</Link>
      </div>
      {sessions.length === 0 ? <p className="analytics-empty-chart">No story sessions yet.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Student</th><th>Story</th><th>Status</th><th>Last activity</th></tr></thead>
            <tbody>{sessions.map((session) => (
              <tr key={session.id}>
                <td>{session.profiles?.display_name || session.profiles?.username || 'Student'}</td>
                <td>{session.stories?.title || '—'}</td>
                <td><span className={`badge badge-${session.status}`}>{session.status.replace('_', ' ')}</span></td>
                <td>{session.last_activity_at ? new Date(session.last_activity_at).toLocaleString() : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboard, analytics] = await Promise.all([
        apiFetch('/admin/dashboard'),
        apiFetch('/admin/analytics'),
      ]);
      setData({ dashboard, analytics });
    } catch (err) {
      setError(err.message || 'Could not load the dashboard analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <div className="admin-analytics-page analytics-loading"><span className="analytics-loading-spinner" /><p>Gathering story progress…</p></div>;
  }
  if (error && !data) {
    return <div className="admin-analytics-page analytics-error"><h1>Could not load analytics</h1><p>{error}</p><button type="button" className="btn btn-primary" onClick={load}>Try again</button></div>;
  }

  return (
    <div className="stack admin-analytics-page">
      <div className="analytics-page-heading">
        <div><p className="analytics-eyebrow">Teacher overview</p><h1>Story analytics</h1><p>See how students are progressing through your published stories.</p></div>
        <Link className="btn btn-primary" to="/admin/stories">Manage stories</Link>
      </div>
      {error && <div className="alert alert-error">{error} <button type="button" className="analytics-retry-link" onClick={load}>Refresh analytics</button></div>}
      <StoryAnalyticsDashboard analytics={data.analytics} />
      <RecentActivity sessions={data.dashboard.recentActivity || []} />
    </div>
  );
}

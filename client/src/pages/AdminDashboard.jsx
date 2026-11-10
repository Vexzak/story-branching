import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import StoryAnalyticsDashboard from '../components/admin/StoryAnalyticsDashboard';

const STATUS_LABELS = {
  completed: 'Natapos',
  in_progress: 'Naglalaro',
  abandoned: 'Hindi tinapos',
};

function RecentActivity({ sessions }) {
  return (
    <section className="analytics-panel analytics-recent-panel">
      <div className="analytics-panel-heading">
        <div><h2>Kamakailang aktibidad</h2><p>Pinakabagong sesyon ng mga mag-aaral sa kuwento.</p></div>
        <Link to="/admin/students">Tingnan ang mga mag-aaral</Link>
      </div>
      {sessions.length === 0 ? <p className="analytics-empty-chart">Wala pang sesyon sa kuwento.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Mag-aaral</th><th>Kuwento</th><th>Estado</th><th>Huling aktibidad</th></tr></thead>
            <tbody>{sessions.map((session) => {
              const name = session.profiles?.display_name || session.profiles?.username || 'Mag-aaral';
              return (
                <tr key={session.id}>
                  <td>
                    <div className="activity-student">
                      <span className="activity-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
                      {name}
                    </div>
                  </td>
                  <td>{session.stories?.title || '—'}</td>
                  <td><span className={`badge badge-${session.status}`}>{STATUS_LABELS[session.status] || session.status}</span></td>
                  <td className="activity-time">
                    {session.last_activity_at
                      ? new Date(session.last_activity_at).toLocaleString('fil-PH', { dateStyle: 'medium', timeStyle: 'short' })
                      : '—'}
                  </td>
                </tr>
              );
            })}</tbody>
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
      setError(err.message || 'Hindi ma-load ang datos ng dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <div className="admin-analytics-page analytics-loading"><span className="analytics-loading-spinner" /><p>Kinukuha ang progreso ng mga kuwento…</p></div>;
  }
  if (error && !data) {
    return <div className="admin-analytics-page analytics-error"><h1>Hindi ma-load ang datos</h1><p>{error}</p><button type="button" className="btn btn-primary" onClick={load}>Subukan muli</button></div>;
  }

  const sessions = data.dashboard.recentActivity || [];

  return (
    <div className="stack admin-analytics-page">
      <div className="analytics-page-heading">
        <div><p className="analytics-eyebrow">Buod para sa guro</p><h1>Datos ng mga kuwento</h1><p>Tingnan ang progreso ng mga mag-aaral sa mga nailathalang kuwento.</p></div>
        <div className="analytics-page-actions">
          <button type="button" className="btn btn-outline-light" onClick={load} disabled={loading}>
            {loading ? 'Nire-refresh…' : 'I-refresh'}
          </button>
          <Link className="btn btn-light" to="/admin/stories">Pamahalaan ang mga kuwento</Link>
        </div>
      </div>
      {error && <div className="alert alert-error">{error} <button type="button" className="analytics-retry-link" onClick={load}>I-refresh ang datos</button></div>}
      <StoryAnalyticsDashboard analytics={data.analytics} sessions={sessions} />
      <RecentActivity sessions={sessions} />
    </div>
  );
}
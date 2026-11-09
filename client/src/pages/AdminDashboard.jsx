import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import StoryAnalyticsDashboard from '../components/admin/StoryAnalyticsDashboard';

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
            <tbody>{sessions.map((session) => (
              <tr key={session.id}>
                <td>{session.profiles?.display_name || session.profiles?.username || 'Mag-aaral'}</td>
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
      setError(err.message || 'Hindi ma-load ang datos ng dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <div className="admin-analytics-page analytics-loading"><span className="analytics-loading-spinner" /><p>Gathering story progress…</p></div>;
  }
  if (error && !data) {
    return <div className="admin-analytics-page analytics-error"><h1>Hindi ma-load ang datos</h1><p>{error}</p><button type="button" className="btn btn-primary" onClick={load}>Subukan muli</button></div>;
  }

  return (
    <div className="stack admin-analytics-page">
      <div className="analytics-page-heading">
        <div><p className="analytics-eyebrow">Buod para sa guro</p><h1>Datos ng mga kuwento</h1><p>Tingnan ang progreso ng mga mag-aaral sa mga nailathalang kuwento.</p></div>
        <Link className="btn btn-primary" to="/admin/stories">Pamahalaan ang mga kuwento</Link>
      </div>
      {error && <div className="alert alert-error">{error} <button type="button" className="analytics-retry-link" onClick={load}>I-refresh ang datos</button></div>}
      <StoryAnalyticsDashboard analytics={data.analytics} />
      <RecentActivity sessions={data.dashboard.recentActivity || []} />
    </div>
  );
}

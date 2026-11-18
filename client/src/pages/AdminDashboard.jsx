import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import StoryAnalyticsDashboard from '../components/admin/StoryAnalyticsDashboard';

function RecentActivity({ sessions }) {
  const [showAll, setShowAll] = useState(false);
  const visibleSessions = sessions.slice(0, 5);

  useEffect(() => {
    if (!showAll) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowAll(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showAll]);

  const renderSessions = (items) => items.map((session) => {
    const name = session.profiles?.display_name || session.profiles?.username || 'Mag-aaral';
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
    return (
      <article className="admin-activity-item" key={session.id}>
        <span className="activity-avatar" aria-hidden="true">{initials}</span>
        <div className="admin-activity-copy"><strong>{name}</strong><span>{session.status === 'completed' ? `Natapos ang kuwento na ${session.stories?.title || ''}` : session.status === 'in_progress' ? `Nagsimula sa kuwento na ${session.stories?.title || ''}` : `Bumalik sa kuwento na ${session.stories?.title || ''}`}</span></div>
        <time>{session.last_activity_at ? new Date(session.last_activity_at).toLocaleString('fil-PH', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</time>
      </article>
    );
  });

  return (
    <>
    <section className="analytics-panel analytics-recent-panel">
      <div className="analytics-panel-heading">
        <div><h2>Aktibidad kamakailan</h2><p>Pinakabagong aktibidad ng mga mag-aaral sa mga kuwento.</p></div>
        <div className="analytics-recent-actions">
          {sessions.length > 5 && (
            <button
              type="button"
              className="analytics-activity-toggle"
              aria-haspopup="dialog"
              onClick={() => setShowAll(true)}
            >
              Tingnan lahat
              <span aria-hidden="true">↓</span>
            </button>
          )}
        </div>
      </div>
      {sessions.length === 0 ? <p className="analytics-empty-chart">Wala pang sesyon sa kuwento.</p> : (
        <div className="admin-activity-list">{renderSessions(visibleSessions)}</div>
      )}
    </section>
    {showAll && (
      <div className="admin-activity-modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setShowAll(false);
      }}>
        <section className="admin-activity-modal" role="dialog" aria-modal="true" aria-labelledby="admin-activity-modal-title">
          <header className="admin-activity-modal-header">
            <div><h2 id="admin-activity-modal-title">Aktibidad kamakailan</h2><p>Lahat ng pinakabagong aktibidad ng mga mag-aaral.</p></div>
            <button type="button" className="admin-activity-modal-close" aria-label="Isara" onClick={() => setShowAll(false)}>×</button>
          </header>
          <div className="admin-activity-modal-list">{renderSessions(sessions)}</div>
        </section>
      </div>
    )}
    </>
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
  const hardestStory = data.analytics.stories.find((story) => /viajero/i.test(story.title));
  const hardestStoryRows = [...data.analytics.stories]
    .filter((story) => story.averageAttemptsPerScene !== null && story.averageAttemptsPerScene !== undefined)
    .sort((a, b) => b.averageAttemptsPerScene - a.averageAttemptsPerScene);
  if (hardestStory && !hardestStoryRows.some((story) => story.id === hardestStory.id)) hardestStoryRows.push(hardestStory);
  if (!hardestStory) hardestStoryRows.push({ id: 'viajeros-no-data', title: 'Viajeros', averageAttemptsPerScene: null });
  const maxStoryAttempts = Math.max(...hardestStoryRows.map((story) => Number(story.averageAttemptsPerScene) || 0), 1);

  return (
    <div className="stack admin-analytics-page">
      <div className="analytics-page-heading">
      <div><h1>Datos ng mga kuwento</h1><p>Tingnan ang progreso ng mga mag-aaral sa mga nailathalang kuwento.</p><p className="admin-updated">Huling na-update: {new Date().toLocaleString('fil-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
        <div className="analytics-page-actions"><button type="button" className="btn btn-outline-light" onClick={load} disabled={loading}>{loading ? 'Nire-refresh…' : 'I-refresh'}</button></div>
      </div>
      {error && <div className="alert alert-error">{error} <button type="button" className="analytics-retry-link" onClick={load}>I-refresh ang datos</button></div>}
      <StoryAnalyticsDashboard analytics={data.analytics} sessions={sessions} weeklyStats={data.dashboard.stats} />
      <div className="admin-lower-grid">
        <section className="analytics-panel admin-hardest-panel">
          <div className="analytics-panel-heading"><div><h2>Pinakamahirap na kuwento</h2><p>Batay sa karaniwang bilang ng pagsubok bawat eksena.</p></div></div>
          <div className="admin-hardest-table-wrap">
            <table className="admin-hardest-table">
              <thead><tr><th>#</th><th>Kuwento</th><th><span className="sr-only">Paghahambing</span></th><th>Karaniwang pagsubok</th></tr></thead>
              <tbody>{hardestStoryRows.map((story, index) => {
                const attempts = Number(story.averageAttemptsPerScene) || 0;
                const tone = /viajero/i.test(story.title) ? 'light' : index === 0 ? 'strong' : 'medium';
                return <tr key={story.id}><td>{index + 1}</td><th scope="row">{story.title}</th><td><span className="admin-hardest-track"><i className={`is-${tone}`} style={{ width: `${Math.min(attempts / maxStoryAttempts * 100, 100)}%` }} /></span></td><td>{story.averageAttemptsPerScene ?? '—'}</td></tr>;
              })}</tbody>
            </table>
          </div>
        </section>
        <RecentActivity sessions={sessions} />
      </div>
    </div>
  );
}

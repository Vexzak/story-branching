import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../api';

export default function PasswordResetBell({ count = 0 }) {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/admin/password-resets');
      setRequests(result.requests || []);
    } catch (err) {
      setError(err.message || 'Hindi ma-load ang mga kahilingan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

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
      setError(err.message || 'Hindi ma-update ang kahilingan.');
    } finally {
      setReviewing('');
    }
  }

  return (
    <>
      <button
        type="button"
        className="nav-password-reset-button"
        aria-label={count ? `${count} kahilingan sa pagpapalit ng password` : 'Mga kahilingan sa pagpapalit ng password'}
        title="Mga kahilingan sa pagpapalit ng password"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {count > 0 && <span className="nav-password-reset-count">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="reset-requests-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="reset-requests-modal" role="dialog" aria-modal="true" aria-labelledby="reset-requests-title">
            <header className="reset-requests-header">
              <div>
                <h2 id="reset-requests-title">Mga kahilingan sa pagpapalit ng password</h2>
                <p>{requests.length} naghihintay na kahilingan</p>
              </div>
              <button type="button" className="reset-requests-close" aria-label="Isara" onClick={() => setOpen(false)}>×</button>
            </header>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            {loading ? <p className="reset-requests-empty">Kinukuha ang mga kahilingan…</p> : requests.length === 0 ? (
              <p className="reset-requests-empty">Walang naghihintay na kahilingan.</p>
            ) : (
              <ul className="reset-requests-list">
                {requests.map((request) => {
                  const name = request.student?.display_name || request.student?.username || 'Mag-aaral';
                  return (
                    <li key={request.id}>
                      <div className="reset-request-info">
                        <strong>{name}</strong>
                        <span>{request.student?.username}{request.student?.email ? ` · ${request.student.email}` : ''}</span>
                        <small>{new Date(request.requested_at).toLocaleString('fil-PH')}</small>
                      </div>
                      <div className="reset-request-actions">
                        <button type="button" className="btn btn-primary" disabled={Boolean(reviewing)} onClick={() => review(request.id, 'approved')}>
                          {reviewing === request.id ? 'Sine-save…' : 'Aprubahan'}
                        </button>
                        <button type="button" className="btn" disabled={Boolean(reviewing)} onClick={() => review(request.id, 'rejected')}>Tanggihan</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

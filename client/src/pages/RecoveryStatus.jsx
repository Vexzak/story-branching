import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

const messages = {
  pending: 'Naipadala ang kahilingan mo. Susuriin ito ng admin sa lalong madaling panahon.',
  approved: 'Naaprubahan ang kahilingan mo. Tingnan ang email sa account mo para sa ligtas na link sa pagpapalit ng password.',
  rejected: 'Tinanggihan ng admin ang kahilingan mo. Makipag-ugnayan sa guro o admin kung kailangan mo pa ng tulong.',
  expired: 'Nag-expire ang kahilingang ito. Magsumite ng bagong kahilingan para magpalit ng password.',
  completed: 'Your password was changed successfully. You can now log in with your new password.',
};

export default function RecoveryStatus() {
  const [request, setRequest] = useState(() => {
    const status = localStorage.getItem('passwordRecoveryFinalStatus');
    return status ? { status } : null;
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const trackingKey = localStorage.getItem('passwordRecoveryTrackingKey');
    if (!trackingKey) {
      if (!localStorage.getItem('passwordRecoveryFinalStatus')) {
        setError('Walang naka-save na kahilingan sa browser na ito. Magsumite ng bagong kahilingan.');
      }
      return undefined;
    }

    let active = true;
    let timer;
    let finished = false;
    const refresh = async () => {
      try {
        const result = await apiFetch(`/auth/password-recovery/${trackingKey}`);
        if (active) {
          setRequest(result.request);
          setError('');
          if (['rejected', 'completed', 'expired'].includes(result.request.status)) {
            localStorage.setItem('passwordRecoveryFinalStatus', result.request.status);
            localStorage.removeItem('passwordRecoveryTrackingKey');
            finished = true;
          }
        }
      } catch (err) {
        if (active) setError(err.message || 'Hindi masuri ang estado ng kahilingan mo.');
      }
      if (active && !finished) timer = window.setTimeout(refresh, 10000);
    };
    refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Estado ng kahilingan sa pagpapalit ng password</h1>
        {request ? <p className="auth-subtitle" role="status">{messages[request.status] || `Request status: ${request.status}`}</p> : <p className="auth-subtitle">{error || 'Checking your request…'}</p>}
        {request?.status === 'approved' && <p className="muted">Maaaring abutin ng ilang minuto bago dumating ang email. Tingnan ang inbox at spam folder.</p>}
        <div className="auth-links"><Link to="/login">Bumalik sa pag-log in</Link><Link to="/forgot-password">Magsumite ng panibagong kahilingan</Link></div>
      </div>
    </div>
  );
}

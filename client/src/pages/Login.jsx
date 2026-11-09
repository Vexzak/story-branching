import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { apiFetch } from '../api';
import { useAuth } from '../App';

const recoveryNotices = {
  pending: { tone: 'alert-warn', text: 'Naghihintay ang kahilingan mong magpalit ng password na masuri ng admin.' },
  approved: { tone: 'alert-success', text: 'Naaprubahan ang kahilingan mong magpalit ng password. Tingnan ang nakarehistro mong email para sa link.' },
  rejected: { tone: 'alert-error', text: 'Tinanggihan ang kahilingan mong magpalit ng password. Humingi ng tulong sa guro o admin.' },
  completed: { tone: 'alert-success', text: 'Matagumpay na napalitan ang password mo. Maaari ka nang mag-log in gamit ang bago mong password.' },
  expired: { tone: 'alert-warn', text: 'Nag-expire ang kahilingan mong magpalit ng password. Magsumite ng bago.' },
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState(() => {
    const status = localStorage.getItem('passwordRecoveryFinalStatus');
    return recoveryNotices[status] || null;
  });

  // Show recovery decisions when the student returns to login, even if they
  // navigated away from the dedicated recovery-status page.
  useEffect(() => {
    let active = true;
    let timer;
    const refreshRecoveryStatus = async () => {
      const finalStatus = localStorage.getItem('passwordRecoveryFinalStatus');
      if (finalStatus && recoveryNotices[finalStatus]) {
        if (active) setRecoveryNotice(recoveryNotices[finalStatus]);
        return;
      }

      const trackingKey = localStorage.getItem('passwordRecoveryTrackingKey');
      if (trackingKey) {
        try {
          const result = await apiFetch(`/auth/password-recovery/${trackingKey}`);
          const status = result.request?.status;
          if (active && recoveryNotices[status]) setRecoveryNotice(recoveryNotices[status]);
          if (['rejected', 'completed', 'expired'].includes(status)) {
            localStorage.setItem('passwordRecoveryFinalStatus', status);
            localStorage.removeItem('passwordRecoveryTrackingKey');
          }
        } catch (statusError) {
          console.warn('Could not check password recovery status:', statusError.message);
        }
      }
      if (active) timer = window.setTimeout(refreshRecoveryStatus, 15000);
    };

    refreshRecoveryStatus();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  // Route the user once both the session and profile are available.
  useEffect(() => {
    if (loading || !session || !profile) return;
    const fallback = profile.role === 'admin' ? '/admin' : '/home';
    const target = location.state?.from?.pathname || fallback;
    navigate(target, { replace: true });
  }, [loading, session, profile, navigate, location.state]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        /invalid login/i.test(signInError.message)
          ? 'Mali ang email o password.'
          : signInError.message
      );
    }
    setBusy(false);
  }

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">📖 Story Adventures</h1>
        <p className="auth-subtitle">Mag-sign in para maipagpatuloy ang mga kuwento mo.</p>

        {recoveryNotice && <div className={`alert ${recoveryNotice.tone}`} role="status" aria-live="polite">{recoveryNotice.text} <Link to="/recovery-status">Tingnan ang kahilingan</Link></div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ilagay ang password mo"
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Mag-log in'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Nakalimutan ang password?</Link>
          <Link to="/signup">Gumawa ng account</Link>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { apiFetch } from '../api';

export default function NewPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setReady(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setReady(true);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password.length < 8 || password.length > 72) {
      setError('Dapat 8 hanggang 72 character ang password.');
      return;
    }
    if (password !== confirm) {
      setError('Hindi magkatugma ang mga password.');
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message || 'Could not update your password. The reset link may have expired.');
      setBusy(false);
      return;
    }

    const trackingKey = localStorage.getItem('passwordRecoveryTrackingKey');
    if (trackingKey) {
      try {
        await apiFetch('/auth/password-recovery/complete', { method: 'POST', body: { trackingKey } });
      } catch { /* Password is already changed; status update is best-effort. */ }
      localStorage.removeItem('passwordRecoveryTrackingKey');
    }
    navigate('/login', { replace: true, state: { message: 'Your password has been changed. Please log in.' } });
  }

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Pumili ng bagong password</h1>
        {!ready ? <p className="auth-subtitle">Buksan ang pahinang ito mula sa email para magpalit ng password. Kung nag-expire ang link, humiling muli.</p> : <>
          <p className="auth-subtitle">Pumili ng password na may hindi bababa sa 8 character.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit} className="form">
            <label className="field"><span>Bagong password</span><input type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label className="field"><span>Kumpirmahin ang bagong password</span><input type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'I-save ang bagong password'}</button>
          </form>
        </>}
        <div className="auth-links"><Link to="/login">Bumalik sa pag-log in</Link></div>
      </div>
    </div>
  );
}

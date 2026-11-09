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
      setError('Password must be between 8 and 72 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
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
        <h1 className="auth-title">Choose a new password</h1>
        {!ready ? <p className="auth-subtitle">Open this page from the password reset email. If the link expired, request another reset.</p> : <>
          <p className="auth-subtitle">Choose a password with at least 8 characters.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleSubmit} className="form">
            <label className="field"><span>New password</span><input type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
          </form>
        </>}
        <div className="auth-links"><Link to="/login">Back to login</Link></div>
      </div>
    </div>
  );
}

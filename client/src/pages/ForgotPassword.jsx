import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hasSavedRequest = Boolean(
    localStorage.getItem('passwordRecoveryTrackingKey') ||
    localStorage.getItem('passwordRecoveryFinalStatus')
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await apiFetch('/auth/password-recovery', {
        method: 'POST',
        body: { username },
      });
      localStorage.removeItem('passwordRecoveryFinalStatus');
      localStorage.setItem('passwordRecoveryTrackingKey', result.trackingKey);
      navigate('/recovery-status');
    } catch (err) {
      setError(err.message || 'Could not send your request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Forgot your password?</h1>
        <p className="auth-subtitle">Enter your username. An administrator will review your request. If approved, a password reset link will be sent to the email address on your account.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Username</span>
            <input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sending request…' : 'Request password reset'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">← Back to login</Link>
          {hasSavedRequest && <Link to="/recovery-status">Check request status</Link>}
        </div>
      </div>
    </div>
  );
}

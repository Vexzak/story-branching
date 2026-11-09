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
      setError(err.message || 'Hindi maipadala ang kahilingan. Subukan muli.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Nakalimutan ang password?</h1>
        <p className="auth-subtitle">Ilagay ang username mo. Susuriin ng admin ang kahilingan. Kapag naaprubahan, ipapadala sa email na nasa account mo ang link para magpalit ng password.</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Pangalan ng gumagamit</span>
            <input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Sending request…' : 'Humiling na magpalit ng password'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">← Bumalik sa pag-log in</Link>
          {hasSavedRequest && <Link to="/recovery-status">Tingnan ang estado ng kahilingan</Link>}
        </div>
      </div>
    </div>
  );
}

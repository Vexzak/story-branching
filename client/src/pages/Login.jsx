import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../App';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
          ? 'Incorrect email or password.'
          : signInError.message
      );
    }
    setBusy(false);
  }

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">📖 Story Adventures</h1>
        <p className="auth-subtitle">Sign in to continue your stories.</p>

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
              placeholder="Your password"
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Log in'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  );
}

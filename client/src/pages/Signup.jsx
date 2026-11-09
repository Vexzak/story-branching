import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { apiFetch } from '../api';

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const errors = {};
    if (!form.email.trim()) errors.email = 'Tirahang email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = 'Maglagay ng wastong email address.';

    const username = form.username.trim();
    if (username.length < 3) errors.username = 'Pangalan ng gumagamit must be at least 3 characters.';
    else if (username.length > 30) errors.username = 'Pangalan ng gumagamit must be 30 characters or fewer.';
    else if (!USERNAME_PATTERN.test(username))
      errors.username = 'Gumamit lamang ng mga letra, numero, tuldok, gitling at salungguhit.';

    if (form.password.length < 8) errors.password = 'Dapat may hindi bababa sa 8 character ang password.';
    else if (form.password.length > 72) errors.password = 'Hindi dapat lumampas sa 72 character ang password.';
    if (form.password !== form.confirmPassword)
      errors.confirmPassword = 'Hindi magkatugma ang mga password.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!validate()) return;

    setBusy(true);
    try {
      await apiFetch('/auth/signup', {
        method: 'POST',
        body: {
          email: form.email.trim(),
          username: form.username.trim(),
          displayName: form.displayName.trim() || undefined,
          password: form.password,
        },
      });

      // Immediately sign in the new student.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (signInError) {
        setError('Nagawa na ang account. Mag-log in gamit ito.');
        navigate('/login');
        return;
      }

      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.message || 'Hindi magawa ang account.');
      if (err.details?.fields) setFieldErrors(err.details.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Gumawa ng account</h1>
        <p className="auth-subtitle">Dito maaaring gumawa ng account ang mga mag-aaral. Humingi sa guro ng account ng admin.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form" noValidate>
          <label className="field">
            <span>Tirahang email</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="halimbawa@email.com"
            />
            {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
          </label>

          <label className="field">
            <span>Pangalan ng gumagamit</span>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              placeholder="halimbawa: juan.delacruz"
            />
            {fieldErrors.username && <small className="field-error">{fieldErrors.username}</small>}
          </label>

          <label className="field">
            <span>Ipinapakitang pangalan <em>(opsyonal)</em></span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
              placeholder="halimbawa: Juan"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="Hindi bababa sa 8 character"
            />
            {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
          </label>

          <label className="field">
            <span>Kumpirmahin ang password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              placeholder="Ilagay muli ang password"
            />
            {fieldErrors.confirmPassword && (
              <small className="field-error">{fieldErrors.confirmPassword}</small>
            )}
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">May account ka na? Mag-log in</Link>
        </div>
      </div>
    </div>
  );
}

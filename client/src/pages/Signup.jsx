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
    if (!form.email.trim()) errors.email = 'Email address is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = 'Enter a valid email address.';

    const username = form.username.trim();
    if (username.length < 3) errors.username = 'Username must be at least 3 characters.';
    else if (username.length > 30) errors.username = 'Username must be 30 characters or fewer.';
    else if (!USERNAME_PATTERN.test(username))
      errors.username = 'Use only letters, numbers, dots, dashes, and underscores.';

    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    else if (form.password.length > 72) errors.password = 'Password must be 72 characters or fewer.';
    if (form.password !== form.confirmPassword)
      errors.confirmPassword = 'Passwords do not match.';

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
        setError('Account created. Please log in with your new account.');
        navigate('/login');
        return;
      }

      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not create the account.');
      if (err.details?.fields) setFieldErrors(err.details.fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Students can sign up here. Ask your teacher for an admin account.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form" noValidate>
          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="you@example.com"
            />
            {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
          </label>

          <label className="field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              placeholder="e.g. sam.lee"
            />
            {fieldErrors.username && <small className="field-error">{fieldErrors.username}</small>}
          </label>

          <label className="field">
            <span>Display name <em>(optional)</em></span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
              placeholder="e.g. Sam"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="At least 8 characters"
            />
            {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
          </label>

          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              placeholder="Repeat your password"
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
          <Link to="/login">Already have an account? Log in</Link>
        </div>
      </div>
    </div>
  );
}

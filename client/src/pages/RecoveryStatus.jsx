import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

const messages = {
  pending: 'Your request was sent. An administrator will review it soon.',
  approved: 'Your request was approved. Check the email address on your account for a secure password reset link.',
  rejected: 'Your request was rejected by an administrator. Please contact your teacher or administrator if you still need help.',
  expired: 'This request has expired. Please submit a new password reset request.',
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
        setError('No recovery request is saved in this browser. Please submit a new request.');
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
        if (active) setError(err.message || 'Could not check your request status.');
      }
      if (active && !finished) timer = window.setTimeout(refresh, 10000);
    };
    refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Password recovery status</h1>
        {request ? <p className="auth-subtitle" role="status">{messages[request.status] || `Request status: ${request.status}`}</p> : <p className="auth-subtitle">{error || 'Checking your request…'}</p>}
        {request?.status === 'approved' && <p className="muted">The reset email can take a few minutes to arrive. Check your inbox and spam folder.</p>}
        <div className="auth-links"><Link to="/login">Back to login</Link><Link to="/forgot-password">Submit another request</Link></div>
      </div>
    </div>
  );
}

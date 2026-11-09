import { Link } from 'react-router-dom';

// Phase 5: this screen will show the student their own request status
// (sent / waiting / approved / declined / expired) without exposing tokens.
export default function RecoveryStatus() {
  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Recovery status</h1>
        <p className="auth-subtitle">
          The recovery-status screen is scheduled for Phase 5.
        </p>
        <div className="auth-links">
          <Link to="/login">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}

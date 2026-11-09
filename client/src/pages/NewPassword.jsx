import { Link } from 'react-router-dom';

// Phase 5: this screen will only be reachable with a valid, single-use,
// short-lived reset authorization issued after an admin approves the request.
export default function NewPassword() {
  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Choose a new password</h1>
        <p className="auth-subtitle">
          The secure new-password screen is scheduled for Phase 5 and requires an approved reset
          request.
        </p>
        <div className="auth-links">
          <Link to="/login">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}

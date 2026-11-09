import { Link } from 'react-router-dom';

// Phase 5 will implement the admin-approved password recovery workflow. This
// page intentionally does not fake a reset; it explains the process so students
// are not misled while the feature is being built.
export default function ForgotPassword() {
  return (
    <div className="center-screen kids-theme">
      <div className="auth-card">
        <h1 className="auth-title">Forgot your password?</h1>
        <p className="auth-subtitle">
          Password recovery is scheduled for Phase 5. It will let you request a reset using your
          username or email, and a teacher or administrator will approve it before you choose a
          new password.
        </p>
        <p className="muted">
          Please ask your teacher or administrator for help until this feature is available.
        </p>
        <div className="auth-links">
          <Link to="/login">← Back to login</Link>
        </div>
      </div>
    </div>
  );
}

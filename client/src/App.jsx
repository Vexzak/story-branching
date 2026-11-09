import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { supabase } from './supabase';
import { apiFetch } from './api';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import RecoveryStatus from './pages/RecoveryStatus';
import NewPassword from './pages/NewPassword';
import StudentHome from './pages/StudentHome';
import StoryPlayer from './pages/StoryPlayer';
import AdminDashboard from './pages/AdminDashboard';
import StudentRecords from './pages/StudentRecords';
import StoryConfiguration from './pages/StoryConfiguration';
import AdminAccounts from './pages/AdminAccounts';

// ---------------------------------------------------------------------------
// Authentication context
// ---------------------------------------------------------------------------
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setProfileError('');
    try {
      const { profile: loaded } = await apiFetch('/me');
      setProfile(loaded);
      return loaded;
    } catch (err) {
      console.error('Failed to load profile:', err.message);
      setProfile(null);
      if (err.status === 401) {
        setProfileError('Your login session expired. Please sign in again.');
        // Defer sign-out until after auth-state callbacks finish. Keeping an
        // invalid token in storage makes every page refresh repeat this error.
        window.setTimeout(() => {
          supabase.auth.signOut({ scope: 'local' }).catch((signOutError) => {
            console.warn('Could not clear the expired session:', signOutError.message);
          });
        }, 0);
        return null;
      }
      setProfileError(err.message || 'Could not load your account profile.');
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      if (data.session) await loadProfile();
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession ?? null);
        if (nextSession) {
          await loadProfile();
        } else {
          setProfile(null);
          setProfileError('');
        }
      }
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (profile?.role !== 'student') return;
    // Keep a copy of published story content for the offline player. The API
    // wrapper falls back to this saved response when the network is unavailable.
    apiFetch('/stories/offline-pack').catch((err) => {
      console.warn('Could not refresh offline story data:', err.message);
    });
  }, [profile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, profile, profileError, loading, refreshProfile: loadProfile, signOut }),
    [session, profile, profileError, loading, loadProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Route guards - these are UX only; the server is authoritative for access.
// ---------------------------------------------------------------------------
function FullScreenMessage({ children }) {
  return (
    <div className="center-screen">
      <div className="panel">
        <p>{children}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ role, children }) {
  const { session, profile, profileError, refreshProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!profile) {
    if (!profileError) return <FullScreenMessage>Setting up your account…</FullScreenMessage>;
    return (
      <div className="center-screen">
        <div className="panel stack">
          <h2>Could not load your account</h2>
          <p>{profileError}</p>
          <button type="button" className="btn" onClick={refreshProfile}>Subukan muli</button>
        </div>
      </div>
    );
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/home'} replace />;
  }

  return children;
}

// ---------------------------------------------------------------------------
// Shared signed-in layout
// ---------------------------------------------------------------------------
function AppShell({ children }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingPasswordResets, setPendingPasswordResets] = useState(0);
  const showTopbar = profile?.role === 'admin' || location.pathname === '/home';

  useEffect(() => {
    if (profile?.role !== 'admin') {
      setPendingPasswordResets(0);
      return undefined;
    }

    let active = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await apiFetch('/admin/password-resets');
        if (active) setPendingPasswordResets(result.requests?.length || 0);
      } catch (err) {
        console.warn('Could not refresh pending password reset count:', err.message);
      } finally {
        inFlight = false;
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('password-reset-requests-updated', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('password-reset-requests-updated', refresh);
    };
  }, [profile?.role]);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className={profile?.role === 'admin' ? 'app-shell' : 'app-shell kids-theme'}>
      {showTopbar && <header className="topbar">
        <Link to={profile?.role === 'admin' ? '/admin' : '/home'} className="brand">
           ISIP-SANGAY
        </Link>
        <nav className="topbar-nav">
          {profile?.role === 'admin' ? (
            <>
              <Link to="/admin">Dashboard</Link>
              <Link
                to="/admin/students"
                className="nav-students-link"
                title={pendingPasswordResets ? `${pendingPasswordResets} pending password reset request${pendingPasswordResets === 1 ? '' : 's'}` : undefined}
                aria-label={pendingPasswordResets ? `Students, ${pendingPasswordResets} pending password reset request${pendingPasswordResets === 1 ? '' : 's'}` : 'Mga mag-aaral'}
              >
                Students
                {pendingPasswordResets > 0 && <span className="nav-notification-dot" aria-hidden="true" />}
              </Link>
              <Link to="/admin/stories">Stories</Link>
              {profile?.can_manage_admins && <Link to="/admin/accounts">Mga account ng admin</Link>}
            </>
          ) : (
            <Link to="/home">Stories</Link>
          )}
          <span className="username-chip" title="Signed in as">
            {profile?.username}
          </span>
          <button type="button" className="btn btn-ghost" onClick={handleSignOut}>
            Sign out
          </button>
        </nav>
      </header>}
      <main className="page">{children}</main>
    </div>
  );
}

function HomeRedirect() {
  const { session, profile, profileError, refreshProfile, loading } = useAuth();
  if (loading) return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) {
    if (!profileError) return <FullScreenMessage>Setting up your account…</FullScreenMessage>;
    return (
      <div className="center-screen">
        <div className="panel stack">
          <h2>Could not load your account</h2>
          <p>{profileError}</p>
          <button type="button" className="btn" onClick={refreshProfile}>Subukan muli</button>
        </div>
      </div>
    );
  }
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/home'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/recovery-status" element={<RecoveryStatus />} />
        <Route path="/reset-password" element={<NewPassword />} />

        {/* Student */}
        <Route
          path="/home"
          element={
            <ProtectedRoute role="student">
              <AppShell>
                <StudentHome />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/play/:storyId"
          element={
            <ProtectedRoute role="student">
              <AppShell>
                <StoryPlayer />
              </AppShell>
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AppShell>
                <AdminDashboard />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/students"
          element={
            <ProtectedRoute role="admin">
              <AppShell>
                <StudentRecords />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/stories"
          element={
            <ProtectedRoute role="admin">
              <AppShell>
                <StoryConfiguration />
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/accounts"
          element={
            <ProtectedRoute role="admin">
              <AppShell>
                <AdminAccounts />
              </AppShell>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

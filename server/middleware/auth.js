import { supabaseAdmin } from '../supabase.js';

/**
 * Validates the Supabase access token on the Authorization header and loads the
 * caller's profile. Attaches `req.authUser` and `req.profile`.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing authentication token.' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, role, can_manage_admins, book_tutorial_seen, created_at, updated_at')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('[auth profile lookup failed]', profileError);
      return res.status(500).json({ error: 'Could not load your account profile.' });
    }

    if (!profile) {
      return res
        .status(403)
        .json({ error: 'No profile is linked to this account.' });
    }

    req.authUser = data.user;
    req.profile = profile;
    next();
  } catch (err) {
    next(err);
  }
}

/** Must run after requireAuth. Blocks non-administrators. */
export function requireAdmin(req, res, next) {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  next();
}

/** Must run after requireAuth. Restricts admin account management to superadmins. */
export function requireAdminManager(req, res, next) {
  if (req.profile?.role !== 'admin' || req.profile?.can_manage_admins !== true) {
    return res.status(403).json({ error: 'Superadmin access required.' });
  }
  next();
}

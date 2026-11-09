import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Every admin route requires a valid session AND the admin role, enforced here
// on the server - never only by hiding buttons in React.
router.use(requireAuth, requireAdmin);

/** GET /api/admin/dashboard - real database statistics, nothing fabricated. */
router.get('/dashboard', async (req, res, next) => {
  try {
    const count = (table, apply) => {
      let q = supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
      if (apply) q = apply(q);
      return q;
    };

    const [
      students,
      stories,
      publishedStories,
      sessions,
      completedSessions,
      inProgressSessions,
      abandonedSessions,
      pendingResets,
      choicesLogged,
    ] = await Promise.all([
      count('profiles', (q) => q.eq('role', 'student')),
      count('stories'),
      count('stories', (q) => q.eq('status', 'published')),
      count('game_sessions'),
      count('game_sessions', (q) => q.eq('status', 'completed')),
      count('game_sessions', (q) => q.eq('status', 'in_progress')),
      count('game_sessions', (q) => q.eq('status', 'abandoned')),
      count('password_reset_requests', (q) => q.eq('status', 'pending')),
      count('choice_logs'),
    ]);

    const results = [
      students,
      stories,
      publishedStories,
      sessions,
      completedSessions,
      inProgressSessions,
      abandonedSessions,
      pendingResets,
      choicesLogged,
    ];

    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;

    const totalSessions = sessions.count ?? 0;
    const completed = completedSessions.count ?? 0;

    const { data: recentSessions, error: recentError } = await supabaseAdmin
      .from('game_sessions')
      .select(
        'id, status, started_at, completed_at, last_activity_at, profiles(username, display_name), stories(title)'
      )
      .order('last_activity_at', { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    res.json({
      stats: {
        totalStudents: students.count ?? 0,
        totalStories: stories.count ?? 0,
        publishedStories: publishedStories.count ?? 0,
        totalSessions,
        completedSessions: completed,
        inProgressSessions: inProgressSessions.count ?? 0,
        abandonedSessions: abandonedSessions.count ?? 0,
        completionRate: totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : 0,
        pendingPasswordResets: pendingResets.count ?? 0,
        totalChoiceSelections: choicesLogged.count ?? 0,
      },
      recentActivity: recentSessions ?? [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/students?search=&page=&pageSize=
 * Paginated, searchable student list with session counts.
 */
router.get('/students', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const search = String(req.query.search || '').trim();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, role, created_at', { count: 'exact' })
      .eq('role', 'student')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      const term = `%${search.replace(/[%_]/g, '')}%`;
      query = query.or(`username.ilike.${term},display_name.ilike.${term}`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      students: data ?? [],
      page,
      pageSize,
      total: count ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

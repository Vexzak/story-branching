import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { env } from '../env.js';
import { HttpError } from '../middleware/error.js';
import { buildStoryAnalytics } from '../lib/storyAnalytics.js';

const router = Router();

// Every admin route requires a valid session AND the admin role, enforced here
// on the server - never only by hiding buttons in React.
router.use(requireAuth, requireAdmin);

async function fetchAllRows(table, columns, configure = (query) => query) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await configure(
      supabaseAdmin.from(table).select(columns).order('id', { ascending: true })
    ).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

/** GET /api/admin/analytics - story, scene, and attempt summaries for teachers. */
router.get('/analytics', async (_req, res, next) => {
  try {
    const [storyResult, studentResult] = await Promise.all([
      supabaseAdmin
        .from('stories')
        .select('id, title, cover_image_path, sequence_order, published_version_id')
        .eq('status', 'published')
        .order('sequence_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
    ]);
    if (storyResult.error) throw storyResult.error;
    if (studentResult.error) throw studentResult.error;

    const stories = storyResult.data ?? [];
    const storyIds = stories.map((story) => story.id);
    if (!storyIds.length) {
      return res.json(buildStoryAnalytics({ stories: [], sessions: [], choiceLogs: [], versions: [], totalStudents: studentResult.count ?? 0 }));
    }

    const [sessions, choiceLogs, versions] = await Promise.all([
      fetchAllRows(
        'game_sessions',
        'id, story_id, student_id, story_version_id, status, current_scene_id, started_at, completed_at',
        (query) => query.in('story_id', storyIds)
      ),
      fetchAllRows(
        'choice_logs',
        'id, game_session_id, student_id, story_id, scene_id, choice_text_snapshot, scene_title_snapshot, is_correct, attempt_number, selected_at, resulting_scene_id',
        (query) => query.in('story_id', storyIds)
      ),
      fetchAllRows(
        'story_versions',
        'id, story_id, version_number, content',
        (query) => query.in('story_id', storyIds)
      ),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json(buildStoryAnalytics({
      stories,
      sessions,
      choiceLogs,
      versions,
      totalStudents: studentResult.count ?? 0,
    }));
  } catch (err) {
    next(err);
  }
});

router.get('/password-resets', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('password_reset_requests')
      .select('id, status, requested_at, student:profiles!password_reset_requests_student_id_fkey(username, display_name)')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    if (error) throw error;
    res.json({ requests: data ?? [] });
  } catch (err) {
    next(err);
  }
});

router.post('/password-resets/:id/review', async (req, res, next) => {
  try {
    const decision = req.body?.decision;
    if (!['approved', 'rejected'].includes(decision)) {
      throw new HttpError(400, 'Choose approve or reject.');
    }

    const { data: request, error: requestError } = await supabaseAdmin
      .from('password_reset_requests')
      .select('id, student_id, status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (requestError) throw requestError;
    if (!request) throw new HttpError(404, 'Password reset request not found.');
    if (request.status !== 'pending') throw new HttpError(409, 'This request has already been reviewed.');

    if (decision === 'approved') {
      const { data: authResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(request.student_id);
      if (userError) throw userError;
      const email = authResult?.user?.email;
      if (!email) throw new HttpError(400, 'This account has no registered email address.');

      const { error: emailError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${env.CLIENT_ORIGIN}/reset-password`,
      });
      if (emailError) throw emailError;
    }

    const reviewedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('password_reset_requests')
      .update({
        status: decision,
        reviewed_at: reviewedAt,
        reviewed_by: req.profile.id,
        approved_at: decision === 'approved' ? reviewedAt : null,
      })
      .eq('id', request.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) throw new HttpError(409, 'This request has already been reviewed.');

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.profile.id,
      action: `password_reset_${decision}`,
      target_type: 'password_reset_request',
      target_id: request.id,
    });

    res.json({ ok: true, status: decision });
  } catch (err) {
    next(err);
  }
});

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

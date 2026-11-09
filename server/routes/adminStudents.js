import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
}

const num = (v) => Number(v ?? 0);

async function emailFor(userId) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) return null;
  return data?.user?.email ?? null;
}

/** GET /students?search=&page=1&pageSize=15 */
router.get('/students', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 15));
    const search = String(req.query.search ?? '')
      .replace(/[%,()\\*]/g, ' ')
      .trim()
      .slice(0, 60);

    let query = supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, created_at', { count: 'exact' })
      .eq('role', 'student')
      .order('username', { ascending: true })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data: rows, count, error } = await query;
    if (error) throw error;

    const ids = (rows ?? []).map((r) => r.id);
    const statsById = new Map();
    let emails = [];
    if (ids.length) {
      const { data: stats, error: statsError } = await supabaseAdmin.rpc('admin_student_stats', {
        p_student_ids: ids,
      });
      if (statsError) throw statsError;
      for (const s of stats ?? []) statsById.set(s.student_id, s);
      emails = await Promise.all(ids.map(emailFor));
    }

    const students = (rows ?? []).map((r, i) => {
      const s = statsById.get(r.id) ?? {};
      return {
        id: r.id,
        username: r.username,
        display_name: r.display_name,
        email: emails[i] ?? null,
        created_at: r.created_at,
        total_sessions: num(s.total_sessions),
        completed_sessions: num(s.completed_sessions),
        last_activity: s.last_activity ?? null,
      };
    });

    res.json({ students, total: count ?? 0, page, pageSize });
  } catch (err) {
    next(err);
  }
});

/** GET /students/:studentId */
router.get('/students/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    assertUuid(studentId, 'student id');

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, role, created_at')
      .eq('id', studentId)
      .maybeSingle();
    if (error) throw error;
    if (!profile || profile.role !== 'student') throw new HttpError(404, 'Student not found.');

    const email = await emailFor(studentId);

    const { data: statRows, error: statError } = await supabaseAdmin.rpc('admin_student_stats', {
      p_student_ids: [studentId],
    });
    if (statError) throw statError;
    const s = statRows?.[0] ?? {};

    const { data: sessions, error: sessError } = await supabaseAdmin
      .from('game_sessions')
      .select('id, story_id, status, started_at, completed_at, last_activity_at')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(500);
    if (sessError) throw sessError;

    const sessionIds = (sessions ?? []).map((x) => x.id);
    const sessionStats = new Map();
    const titles = new Map();

    if (sessionIds.length) {
      const { data: sStats, error: ssError } = await supabaseAdmin.rpc('admin_session_stats', {
        p_session_ids: sessionIds,
      });
      if (ssError) throw ssError;
      for (const row of sStats ?? []) sessionStats.set(row.session_id, row);

      const storyIds = [...new Set(sessions.map((x) => x.story_id))];
      const { data: stories, error: stError } = await supabaseAdmin
        .from('stories')
        .select('id, title')
        .in('id', storyIds);
      if (stError) throw stError;
      for (const st of stories ?? []) titles.set(st.id, st.title);
    }

    res.json({
      student: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        email,
        created_at: profile.created_at,
      },
      stats: {
        total_sessions: num(s.total_sessions),
        completed_sessions: num(s.completed_sessions),
        in_progress_sessions: num(s.in_progress_sessions),
        abandoned_sessions: num(s.abandoned_sessions),
        total_selections: num(s.total_selections),
        correct_selections: num(s.correct_selections),
        incorrect_selections: num(s.incorrect_selections),
        last_activity: s.last_activity ?? null,
      },
      sessions: (sessions ?? []).map((x) => {
        const st = sessionStats.get(x.id) ?? {};
        return {
          id: x.id,
          story_id: x.story_id,
          story_title: titles.get(x.story_id) ?? 'Deleted story',
          status: x.status,
          started_at: x.started_at,
          completed_at: x.completed_at,
          last_activity_at: x.last_activity_at,
          total_selections: num(st.total_selections),
          correct_selections: num(st.correct_selections),
          incorrect_selections: num(st.incorrect_selections),
          decisions_resolved: num(st.decisions_resolved),
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /sessions/:sessionId - chronological activity for one playthrough. */
router.get('/sessions/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    assertUuid(sessionId, 'session id');

    const { data: session, error } = await supabaseAdmin
      .from('game_sessions')
      .select('id, student_id, story_id, story_version_id, status, started_at, completed_at, last_activity_at')
      .eq('id', sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!session) throw new HttpError(404, 'Session not found.');

    const [profileRes, storyRes, logRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, username, display_name')
        .eq('id', session.student_id)
        .maybeSingle(),
      supabaseAdmin.from('stories').select('id, title').eq('id', session.story_id).maybeSingle(),
      supabaseAdmin
        .from('choice_logs')
        .select(
          'id, scene_id, scene_title_snapshot, choice_text_snapshot, is_correct, attempt_number, selected_at, resulting_scene_id'
        )
        .eq('game_session_id', sessionId)
        .order('selected_at', { ascending: true })
        .limit(2000),
    ]);
    if (logRes.error) throw logRes.error;

    // Resolve resulting scene titles from the version this session actually used.
    let scenes = {};
    if (session.story_version_id) {
      const { data: version } = await supabaseAdmin
        .from('story_versions')
        .select('content')
        .eq('id', session.story_version_id)
        .maybeSingle();
      scenes = version?.content?.scenes ?? {};
    }

    const entries = (logRes.data ?? []).map((l, i) => {
      const result = l.resulting_scene_id ? scenes[l.resulting_scene_id] : null;
      return {
        id: l.id,
        step: i + 1,
        scene_id: l.scene_id,
        scene_title: l.scene_title_snapshot,
        choice_text: l.choice_text_snapshot,
        is_correct: l.is_correct,
        attempt_number: l.attempt_number,
        selected_at: l.selected_at,
        resulting_scene_title: result?.title ?? null,
        failure_text: !l.is_correct ? result?.narration ?? null : null,
      };
    });

    const byDecision = new Map();
    for (const e of entries) {
      if (!byDecision.has(e.scene_id)) {
        byDecision.set(e.scene_id, {
          scene_id: e.scene_id,
          scene_title: e.scene_title,
          attempts: 0,
          incorrect: 0,
          resolved: false,
        });
      }
      const d = byDecision.get(e.scene_id);
      d.attempts += 1;
      if (!e.is_correct) d.incorrect += 1;
      if (e.is_correct) d.resolved = true;
    }

    res.json({
      session: {
        id: session.id,
        status: session.status,
        started_at: session.started_at,
        completed_at: session.completed_at,
        last_activity_at: session.last_activity_at,
      },
      student: profileRes.data ?? null,
      story_title: storyRes.data?.title ?? 'Deleted story',
      decisions: [...byDecision.values()],
      entries,
    });
  } catch (err) {
    next(err);
  }
});

const round1 = (n) => Math.round(n * 10) / 10;

/** DELETE /students/:studentId   body: { confirmUsername } */
router.delete('/students/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    assertUuid(studentId, 'student id');
    const confirmUsername = String(req.body?.confirmUsername ?? '').trim();

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role')
      .eq('id', studentId)
      .maybeSingle();
    if (error) throw error;
    if (!profile) throw new HttpError(404, 'Student not found.');
    if (profile.role !== 'student') {
      throw new HttpError(403, 'Only student accounts can be deleted here.');
    }
    if (confirmUsername.toLowerCase() !== profile.username.toLowerCase()) {
      throw new HttpError(400, "Type the student's username exactly to confirm.");
    }

    // Deleting the auth user cascades to the profile, sessions, choice logs and
    // password-reset records (see the foreign keys in schema.sql).
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(studentId);
    if (deleteError) throw deleteError;

    const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.profile.id,
      action: 'student.delete',
      target_type: 'student',
      target_id: studentId,
      details: { username: profile.username },
    });
    if (auditError) console.error('Audit log failed:', auditError.message);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** GET /students/:studentId/stories/:storyId/performance */
// Walks the story from its starting scene and lists the question ("Eksena")
// scenes in the order a student meets them: question, correct answer, next
// story part, next question, and so on.
function decisionOrder(content) {
  const scenes = content?.scenes ?? {};
  const ordered = [];
  const seen = new Set();
  let id = content?.starting_scene_id;

  while (id && scenes[id] && !seen.has(id)) {
    seen.add(id);
    const scene = scenes[id];
    const choices = [...(scene.choices ?? [])].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );
    if (scene.scene_type === 'decision') {
      ordered.push({ id, title: scene.title });
      id = choices.find((c) => c.is_correct)?.destination_scene_id;
    } else if (scene.scene_type === 'ending') {
      break;
    } else {
      id = choices.find((c) => c.destination_scene_id)?.destination_scene_id;
    }
  }

  // Any question the walk did not reach, in the order set in the editor.
  const listed = new Set(ordered.map((o) => o.id));
  Object.values(scenes)
    .filter((s) => s.scene_type === 'decision' && !listed.has(s.id))
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .forEach((s) => ordered.push({ id: s.id, title: s.title }));

  return ordered;
}

/** GET /students/:studentId/stories/:storyId/performance */
router.get('/students/:studentId/stories/:storyId/performance', async (req, res, next) => {
  try {
    const { studentId, storyId } = req.params;
    assertUuid(studentId, 'student id');
    assertUuid(storyId, 'story id');

    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role')
      .eq('id', studentId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile || profile.role !== 'student') throw new HttpError(404, 'Student not found.');

    const { data: story } = await supabaseAdmin
      .from('stories')
      .select('id, title, published_version_id')
      .eq('id', storyId)
      .maybeSingle();

    const { data: sessionRows, error: sErr } = await supabaseAdmin
      .from('game_sessions')
      .select('id, story_version_id, status, started_at, completed_at')
      .eq('student_id', studentId)
      .eq('story_id', storyId)
      .order('started_at', { ascending: true })
      .limit(200);
    if (sErr) throw sErr;
    const sessions = sessionRows ?? [];

    const { data: logs, error: lErr } = await supabaseAdmin
      .from('choice_logs')
      .select('game_session_id, scene_id, scene_title_snapshot, is_correct, selected_at')
      .eq('student_id', studentId)
      .eq('story_id', storyId)
      .order('selected_at', { ascending: true })
      .limit(5000);
    if (lErr) throw lErr;

    // The story's current published version gives the full list of questions,
    // including ones this student has not reached yet.
    let master = [];
    if (story?.published_version_id) {
      const { data: current } = await supabaseAdmin
        .from('story_versions')
        .select('content')
        .eq('id', story.published_version_id)
        .maybeSingle();
      if (current?.content) master = decisionOrder(current.content);
    }

    // Older versions used by past runs, as a fallback for the order.
    const versionIds = [...new Set(sessions.map((s) => s.story_version_id).filter(Boolean))];
    const sceneOrder = new Map();
    if (versionIds.length) {
      const { data: versions, error: vErr } = await supabaseAdmin
        .from('story_versions')
        .select('version_number, content')
        .in('id', versionIds)
        .order('version_number', { ascending: true });
      if (vErr) throw vErr;
      for (const v of versions ?? []) {
        for (const [id, sc] of Object.entries(v.content?.scenes ?? {})) {
          sceneOrder.set(id, sc.display_order ?? 9999);
        }
      }
    }

    const sessionIndex = new Map(sessions.map((s, i) => [s.id, i]));
    const sessionSelections = sessions.map(() => 0);
    const sessionFails = sessions.map(() => 0);
    const decisions = new Map();

    master.forEach((m, i) => {
      decisions.set(m.id, {
        scene_id: m.id,
        scene_title: m.title || 'Untitled scene',
        rank: i,
        display_order: i,
        first_seen: '',
        per_session: sessions.map(() => null),
      });
    });

    for (const l of logs ?? []) {
      const idx = sessionIndex.get(l.game_session_id);
      if (idx === undefined) continue;

      let d = decisions.get(l.scene_id);
      if (!d) {
        d = {
          scene_id: l.scene_id,
          scene_title: l.scene_title_snapshot || 'Untitled scene',
          rank: 100000,
          display_order: sceneOrder.get(l.scene_id) ?? 9999,
          first_seen: l.selected_at,
          per_session: sessions.map(() => null),
        };
        decisions.set(l.scene_id, d);
      }

      const cell = d.per_session[idx] ?? { attempts: 0, fails: 0, resolved: false };
      cell.attempts += 1;
      sessionSelections[idx] += 1;
      if (l.is_correct) {
        cell.resolved = true;
      } else {
        cell.fails += 1;
        sessionFails[idx] += 1;
      }
      d.per_session[idx] = cell;
    }

    const list = [...decisions.values()]
      .map((d) => {
        const cells = d.per_session.filter(Boolean);
        const resolvedCells = cells.filter((c) => c.resolved);
        const avgFails = resolvedCells.length
          ? resolvedCells.reduce((n, c) => n + c.fails, 0) / resolvedCells.length
          : null;
        return {
          scene_id: d.scene_id,
          scene_title: d.scene_title,
          rank: d.rank,
          display_order: d.display_order,
          first_seen: d.first_seen,
          per_session: d.per_session,
          total_attempts: cells.reduce((n, c) => n + c.attempts, 0),
          total_fails: cells.reduce((n, c) => n + c.fails, 0),
          sessions_reached: cells.length,
          sessions_resolved: resolvedCells.length,
          avg_fails_before_resolve: avgFails === null ? null : round1(avgFails),
          avg_attempts_to_solve: avgFails === null ? null : round1(avgFails + 1),
        };
      })
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.display_order - b.display_order ||
          String(a.first_seen).localeCompare(String(b.first_seen))
      );

    res.json({
      student: { username: profile.username },
      story_title: story?.title ?? 'Deleted story',
      sessions: sessions.map((s, i) => ({
        id: s.id,
        number: i + 1,
        status: s.status,
        started_at: s.started_at,
        completed_at: s.completed_at,
        selections: sessionSelections[i],
        fails: sessionFails[i],
      })),
      decisions: list,
      totals: {
        selections: sessionSelections.reduce((a, b) => a + b, 0),
        fails: sessionFails.reduce((a, b) => a + b, 0),
      },
    });
  } catch (err) {
    next(err);
  }
});
export default router;
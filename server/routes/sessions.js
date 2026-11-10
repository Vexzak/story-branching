import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

router.use(requireAuth);
router.use((req, res, next) => {
  if (req.profile.role !== 'student') {
    return next(new HttpError(403, 'Only students can play stories.'));
  }
  next();
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
}

// Student-safe scene: never includes is_correct, destinations, or failure links.
function publicScene(content, sceneId) {
  const scene = sceneId ? content?.scenes?.[sceneId] : null;
  if (!scene) return null;
  const choices = [...(scene.choices ?? [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((c) => ({ id: c.id, text: c.text }));
  return {
    id: scene.id,
    title: scene.title,
    scene_type: scene.scene_type,
    narration: scene.narration,
    dialogue: scene.dialogue ?? null,
    background_image_path: scene.background_image_path ?? null,
    sound_effect_path: scene.sound_effect_path ?? null,
    character_config: scene.character_config ?? null,
    choices,
  };
}

function storyBookText(content) {
  const authoredText = content.story?.full_story_text?.trim();
  if (authoredText) return authoredText;

  return Object.values(content.scenes ?? {})
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((scene) => [
      scene.title,
      scene.narration,
      scene.dialogue,
      ...(scene.choices ?? []).map((choice) => choice.text),
    ].filter((part) => typeof part === 'string' && part.trim()).join('\n\n'))
    .filter(Boolean)
    .join('\n\n');
}

async function loadContent(versionId) {
  const { data, error } = await supabaseAdmin
    .from('story_versions')
    .select('content')
    .eq('id', versionId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.content) throw new HttpError(500, 'Story content is missing.');
  return data.content;
}

async function loadOwnedSession(sessionId, studentId) {
  const { data, error } = await supabaseAdmin
    .from('game_sessions')
    .select('id, story_id, story_version_id, status, current_scene_id, started_at, completed_at')
    .eq('id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Session not found.');
  return data;
}

async function findActive(studentId, storyId) {
  const { data, error } = await supabaseAdmin
    .from('game_sessions')
    .select('id, story_id, story_version_id, status, current_scene_id, started_at, completed_at')
    .eq('student_id', studentId)
    .eq('story_id', storyId)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function assertStoryUnlocked(studentId, storyId) {
  const { data: sequence, error: sequenceError } = await supabaseAdmin
    .from('stories')
    .select('id, unlock_after_previous')
    .eq('status', 'published')
    .order('sequence_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (sequenceError) throw sequenceError;
  const index = (sequence ?? []).findIndex((story) => story.id === storyId);
  if (index <= 0 || !sequence[index].unlock_after_previous) return;

  const previousStoryId = sequence[index - 1].id;
  const { data: completed, error: progressError } = await supabaseAdmin
    .from('game_sessions')
    .select('id')
    .eq('student_id', studentId)
    .eq('story_id', previousStoryId)
    .eq('status', 'completed')
    .limit(1);
  if (progressError) throw progressError;
  if (!completed?.length) throw new HttpError(403, 'Complete the previous story to unlock this one.');
}

function sessionPayload(session, content) {
  return {
    session: {
      id: session.id,
      story_id: session.story_id,
      status: session.status,
      current_scene_id: session.current_scene_id,
      started_at: session.started_at,
      completed_at: session.completed_at,
    },
    story: {
      title: content.story?.title ?? '',
      author: content.story?.author ?? '',
      full_story_text: storyBookText(content),
    },
    scene: publicScene(content, session.current_scene_id),
  };
}

/** GET /api/sessions/entry/:storyId - load the paused first scene and any saved run. */
router.get('/entry/:storyId', async (req, res, next) => {
  try {
    const { storyId } = req.params;
    assertUuid(storyId, 'story id');
    const { data: story, error } = await supabaseAdmin
      .from('stories')
      .select('id, status, published_version_id')
      .eq('id', storyId)
      .maybeSingle();
    if (error) throw error;
    if (!story || story.status !== 'published' || !story.published_version_id) {
      throw new HttpError(404, 'Story not found.');
    }
    await assertStoryUnlocked(req.profile.id, storyId);

    const publishedContent = await loadContent(story.published_version_id);
    const active = await findActive(req.profile.id, storyId);
    let saved = active;
    if (!saved) {
      const { data: completed, error: completedError } = await supabaseAdmin
        .from('game_sessions')
        .select('id, story_id, story_version_id, status, current_scene_id, started_at, completed_at')
        .eq('student_id', req.profile.id)
        .eq('story_id', storyId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (completedError) throw completedError;
      saved = completed;
    }

    const savedContent = saved ? await loadContent(saved.story_version_id) : null;
    const startId = publishedContent.starting_scene_id;
    if (!startId || !publishedContent.scenes?.[startId]) {
      throw new HttpError(409, 'This story is not ready to play yet.');
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      story: {
        id: storyId,
        title: publishedContent.story?.title ?? '',
        author: publishedContent.story?.author ?? '',
        full_story_text: storyBookText(publishedContent),
      },
      firstScene: publicScene(publishedContent, startId),
      savedGame: saved && savedContent ? sessionPayload(saved, savedContent) : null,
      tutorialSeen: req.profile.book_tutorial_seen === true,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sessions   body: { storyId, restart? }
 * Resumes the student's in-progress session for this story, or starts a new one.
 * restart: true abandons the active session (keeping its logs) and starts fresh.
 */
router.post('/', async (req, res, next) => {
  try {
    const { storyId, restart } = req.body ?? {};
    assertUuid(storyId, 'story id');
    const studentId = req.profile.id;

    const { data: story, error: storyError } = await supabaseAdmin
      .from('stories')
      .select('id, status, published_version_id')
      .eq('id', storyId)
      .maybeSingle();
    if (storyError) throw storyError;
    if (!story || story.status !== 'published' || !story.published_version_id) {
      throw new HttpError(404, 'Story not found.');
    }

    // Enforce progression even for a previously created incomplete session.
    await assertStoryUnlocked(studentId, storyId);

    if (!restart) {
      const existing = await findActive(studentId, storyId);
      if (existing) {
        const content = await loadContent(existing.story_version_id);
        return res.json({ ...sessionPayload(existing, content), resumed: true });
      }
    }

    if (restart) {
      const { error } = await supabaseAdmin
        .from('game_sessions')
        .update({ status: 'abandoned', last_activity_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('story_id', storyId)
        .eq('status', 'in_progress');
      if (error) throw error;
    }

    const content = await loadContent(story.published_version_id);
    const startId = content.starting_scene_id;
    if (!startId || !content.scenes?.[startId]) {
      throw new HttpError(409, 'This story is not ready to play yet.');
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('game_sessions')
      .insert({
        student_id: studentId,
        story_id: storyId,
        story_version_id: story.published_version_id,
        current_scene_id: startId,
      })
      .select('id, story_id, story_version_id, status, current_scene_id, started_at, completed_at')
      .single();

    if (insertError) {
      // Two simultaneous requests: the unique index let only one through.
      if (insertError.code === '23505') {
        const existing = await findActive(studentId, storyId);
        if (existing) {
          const c = await loadContent(existing.story_version_id);
          return res.json({ ...sessionPayload(existing, c), resumed: true });
        }
      }
      throw insertError;
    }

    res.status(201).json({ ...sessionPayload(created, content), resumed: false });
  } catch (err) {
    next(err);
  }
});

/** GET /api/sessions/:sessionId - restore a session (page refresh). */
router.get('/:sessionId', async (req, res, next) => {
  try {
    assertUuid(req.params.sessionId, 'session id');
    const session = await loadOwnedSession(req.params.sessionId, req.profile.id);
    const content = await loadContent(session.story_version_id);
    res.json(sessionPayload(session, content));
  } catch (err) {
    next(err);
  }
});

const RPC_ERRORS = {
  SESSION_NOT_FOUND: [404, 'Session not found.'],
  SESSION_NOT_ACTIVE: [409, 'This session is no longer active.'],
  CHOICE_NOT_IN_SCENE: [400, 'That choice is not available in this scene.'],
  BROKEN_STORY: [500, 'This story has a setup problem. Please tell your teacher.'],
};

/** POST /api/sessions/:sessionId/choices   body: { choiceId } */
router.post('/:sessionId/choices', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { choiceId, clientActionId, expectedSceneId } = req.body ?? {};
    assertUuid(sessionId, 'session id');
    assertUuid(choiceId, 'choice id');

    const rpcName = clientActionId ? 'submit_choice_idempotent' : 'submit_choice';
    if (clientActionId) {
      assertUuid(clientActionId, 'client action id');
      assertUuid(expectedSceneId, 'expected scene id');
    }

    const rpcArgs = {
      p_session_id: sessionId,
      p_student_id: req.profile.id,
      p_choice_id: choiceId,
    };
    if (clientActionId) {
      rpcArgs.p_action_id = clientActionId;
      rpcArgs.p_expected_scene_id = expectedSceneId;
    }

    const { data: result, error } = await supabaseAdmin.rpc(rpcName, rpcArgs);

    if (error) {
      if (error.message?.includes('OFFLINE_PROGRESS_CONFLICT')) {
        throw new HttpError(409, 'Hindi naisabay ang offline progress dahil nagbago na ang kasalukuyang eksena sa server. Nananatiling naka-save ang offline progress sa device na ito.');
      }
      if (error.message?.includes('OFFLINE_ACTION_MISMATCH') || error.message?.includes('OFFLINE_ACTION_INCOMPLETE')) {
        throw new HttpError(409, 'Hindi ligtas na maulit ang offline action. Nananatiling naka-save ang progress sa device na ito.');
      }
      for (const [key, [status, message]] of Object.entries(RPC_ERRORS)) {
        if (error.message?.includes(key)) throw new HttpError(status, message);
      }
      throw error;
    }

    const session = await loadOwnedSession(sessionId, req.profile.id);
    const content = await loadContent(session.story_version_id);

    res.json({
      ...sessionPayload(session, content),
      result: {
        correct: result.correct,
        advanced: result.advanced,
        completed: result.completed,
        attempt: result.attempt,
        feedback: result.feedback,
        failure_scene: publicScene(content, result.failure_scene_id),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/sessions/:sessionId/abandon */
router.post('/:sessionId/abandon', async (req, res, next) => {
  try {
    assertUuid(req.params.sessionId, 'session id');
    const { error } = await supabaseAdmin
      .from('game_sessions')
      .update({ status: 'abandoned', last_activity_at: new Date().toISOString() })
      .eq('id', req.params.sessionId)
      .eq('student_id', req.profile.id)
      .eq('status', 'in_progress');
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

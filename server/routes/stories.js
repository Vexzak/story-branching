import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { env } from '../env.js';

const router = Router();

// Public, read-only inventory used by the PWA's first-run asset downloader.
// URLs are sourced only from published story versions and the story media
// bucket, so drafts and unrelated storage objects are never exposed/cached.
router.get('/assets', async (_req, res, next) => {
  try {
    const { data: stories, error: storiesError } = await supabaseAdmin
      .from('stories')
      .select('published_version_id, cover_image_path')
      .eq('status', 'published')
      .not('published_version_id', 'is', null);
    if (storiesError) throw storiesError;

    const versionIds = [...new Set((stories ?? []).map((story) => story.published_version_id))];
    const versions = versionIds.length
      ? await supabaseAdmin.from('story_versions').select('content').in('id', versionIds)
      : { data: [], error: null };
    if (versions.error) throw versions.error;

    const storageBase = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/story-images/`;
    const assets = new Set();
    const addAsset = (value) => {
      if (typeof value !== 'string' || !value.startsWith(storageBase)) return;
      assets.add(value);
    };

    for (const story of stories ?? []) addAsset(story.cover_image_path);
    for (const version of versions.data ?? []) {
      for (const scene of Object.values(version.content?.scenes ?? {})) {
        addAsset(scene.background_image_path);
        addAsset(scene.sound_effect_path);
        for (const object of scene.character_config?.objects ?? []) addAsset(object.src);
      }
    }

    res.set('Cache-Control', 'no-store');
    res.json({ assets: [...assets] });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth);

// A student-only copy of the published story data enables local play when the
// service is unavailable. The offline client uses it only after API requests
// fail; normal online progression continues through the session endpoints.
router.get('/offline-pack', async (req, res, next) => {
  try {
    if (req.profile.role !== 'student') throw new HttpError(403, 'Only students can download story packs.');
    const { data: stories, error } = await supabaseAdmin
      .from('stories')
      .select('id, title, description, cover_image_path, sequence_order, unlock_after_previous, published_version_id')
      .eq('status', 'published')
      .order('sequence_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    const { data: completedSessions, error: progressError } = await supabaseAdmin
      .from('game_sessions')
      .select('story_id')
      .eq('student_id', req.profile.id)
      .eq('status', 'completed');
    if (progressError) throw progressError;
    const completedIds = new Set((completedSessions ?? []).map((session) => session.story_id));
    let previousStory = null;
    const studentStories = (stories ?? []).map((story) => {
      const completed = completedIds.has(story.id);
      const unlocked = completed || !previousStory || !story.unlock_after_previous || completedIds.has(previousStory.id);
      previousStory = story;
      return { ...story, completed, unlocked };
    });
    const ids = [...new Set((stories ?? []).map((story) => story.published_version_id).filter(Boolean))];
    const { data: versions, error: versionError } = ids.length
      ? await supabaseAdmin.from('story_versions').select('id, content').in('id', ids)
      : { data: [], error: null };
    if (versionError) throw versionError;
    const contents = new Map((versions ?? []).map((version) => [version.id, version.content]));
    res.set('Cache-Control', 'no-store');
    res.json({ stories: studentStories.map((story) => ({
      ...story,
      content: contents.get(story.published_version_id) ?? null,
    })) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stories
 * Published stories for students. Administrators additionally see drafts.
 */
router.get('/', async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('stories')
      .select('id, title, description, cover_image_path, status, sequence_order, unlock_after_previous, created_at, updated_at')
      .order('sequence_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (req.profile.role !== 'admin') {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;
    if (error) throw error;

    const stories = data ?? [];
    if (req.profile.role !== 'student') {
      res.json({ stories });
      return;
    }

    const { data: completedSessions, error: progressError } = await supabaseAdmin
      .from('game_sessions')
      .select('story_id')
      .eq('student_id', req.profile.id)
      .eq('status', 'completed');
    if (progressError) throw progressError;
    const completedIds = new Set((completedSessions ?? []).map((session) => session.story_id));
    let previousStory = null;
    const studentStories = stories.map((story) => {
      const completed = completedIds.has(story.id);
      const unlocked = completed || !previousStory || !story.unlock_after_previous || completedIds.has(previousStory.id);
      previousStory = story;
      return { ...story, completed, unlocked };
    });

    res.json({ stories: studentStories });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stories/:storyId
 * Returns the story metadata plus the immutable published version content that
 * gameplay renders from.
 */
router.get('/:storyId', async (req, res, next) => {
  try {
    const { storyId } = req.params;

    const { data: story, error } = await supabaseAdmin
      .from('stories')
      .select('id, title, description, cover_image_path, status, published_version_id')
      .eq('id', storyId)
      .maybeSingle();

    if (error) throw error;
    if (!story) throw new HttpError(404, 'Story not found.');

    if (story.status !== 'published' && req.profile.role !== 'admin') {
      throw new HttpError(404, 'Story not found.');
    }

    let content = null;
    if (story.published_version_id) {
      const { data: version, error: versionError } = await supabaseAdmin
        .from('story_versions')
        .select('id, version_number, content, published_at')
        .eq('id', story.published_version_id)
        .maybeSingle();

      if (versionError) throw versionError;
      content = version ?? null;
    }

    res.json({ story, version: content });
  } catch (err) {
    next(err);
  }
});

export default router;

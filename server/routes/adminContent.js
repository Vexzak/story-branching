import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCENE_TYPES = ['start', 'decision', 'narrative', 'failure', 'ending'];
const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

function assertUuid(value, label) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(400, `Invalid ${label}.`);
  }
}

function text(value, label, { max, required = false }) {
  const t = (value ?? '').toString().trim();
  if (required && !t) throw new HttpError(400, `${label} is required.`);
  if (t.length > max) throw new HttpError(400, `${label} is too long (max ${max} characters).`);
  return t;
}

async function audit(actorId, action, targetType, targetId, details) {
  const { error } = await supabaseAdmin
    .from('audit_logs')
    .insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, details });
  if (error) console.error('Audit log failed:', error.message);
}

async function sceneInStory(sceneId, storyId) {
  assertUuid(sceneId, 'scene id');
  const { data, error } = await supabaseAdmin
    .from('scenes')
    .select('id')
    .eq('id', sceneId)
    .eq('story_id', storyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(400, 'That scene does not belong to this story.');
  return data.id;
}

async function nextOrder(table, column, value) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('display_order')
    .eq(column, value)
    .order('display_order', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.display_order ?? -1) + 1;
}

// ---------------------------------------------------------------- stories
router.get('/stories', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('stories')
      .select('id, title, description, cover_image_path, status, sequence_order, unlock_after_previous, starting_scene_id, published_version_id, updated_at')
      .order('sequence_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ stories: data ?? [] });
  } catch (err) {
    next(err);
  }
});

// Save the full story order and each story's prerequisite setting together.
router.patch('/stories/sequence', async (req, res, next) => {
  try {
    const list = req.body?.stories;
    if (!Array.isArray(list) || list.length > 500) throw new HttpError(400, 'Invalid story sequence.');
    const seen = new Set();
    for (const [index, item] of list.entries()) {
      assertUuid(item?.id, `story ${index + 1} id`);
      if (seen.has(item.id)) throw new HttpError(400, 'A story appears more than once in the sequence.');
      if (typeof item.unlock_after_previous !== 'boolean') throw new HttpError(400, 'Invalid story unlock setting.');
      seen.add(item.id);
    }

    const { data: existing, error: listError } = await supabaseAdmin.from('stories').select('id');
    if (listError) throw listError;
    if ((existing ?? []).length !== seen.size || existing.some((story) => !seen.has(story.id))) {
      throw new HttpError(400, 'Refresh the story list and try again.');
    }

    for (const [sequence_order, item] of list.entries()) {
      const { error } = await supabaseAdmin
        .from('stories')
        .update({ sequence_order, unlock_after_previous: item.unlock_after_previous })
        .eq('id', item.id);
      if (error) throw error;
    }
    await audit(req.profile.id, 'story.sequence.update', 'story', null, { count: list.length });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/stories', async (req, res, next) => {
  try {
    const title = text(req.body?.title, 'Title', { max: 120, required: true });
    const description = text(req.body?.description, 'Description', { max: 1000 });

    const { data: lastStories, error: orderError } = await supabaseAdmin
      .from('stories')
      .select('sequence_order')
      .order('sequence_order', { ascending: false })
      .limit(1);
    if (orderError) throw orderError;

    const { data: story, error } = await supabaseAdmin
      .from('stories')
      .insert({
        title,
        description,
        status: 'draft',
        created_by: req.profile.id,
        sequence_order: (lastStories?.[0]?.sequence_order ?? -1) + 1,
      })
      .select('id, title, description, status')
      .single();
    if (error) throw error;

    const { data: scene, error: sceneError } = await supabaseAdmin
      .from('scenes')
      .insert({ story_id: story.id, title: 'Start', scene_type: 'start', narration: '', display_order: 0 })
      .select('id')
      .single();
    if (sceneError) throw sceneError;

    await supabaseAdmin.from('stories').update({ starting_scene_id: scene.id }).eq('id', story.id);
    await audit(req.profile.id, 'story.create', 'story', story.id, { title });
    res.status(201).json({ story });
  } catch (err) {
    next(err);
  }
});

router.get('/stories/:storyId', async (req, res, next) => {
  try {
    const { storyId } = req.params;
    assertUuid(storyId, 'story id');

    const { data: story, error } = await supabaseAdmin
      .from('stories')
      .select('id, title, author, full_story_text, description, cover_image_path, status, starting_scene_id, published_version_id')
      .eq('id', storyId)
      .maybeSingle();
    if (error) throw error;
    if (!story) throw new HttpError(404, 'Story not found.');

    const { data: scenes, error: sErr } = await supabaseAdmin
      .from('scenes')
      .select('id, story_id, title, scene_type, narration, dialogue, background_image_path, sound_effect_path, character_config, display_order')
      .eq('story_id', storyId)
      .order('display_order')
      .order('created_at');
    if (sErr) throw sErr;

    const { data: choices, error: cErr } = await supabaseAdmin
      .from('choices')
      .select('id, scene_id, story_id, text, destination_scene_id, failure_scene_id, is_correct, feedback, display_order')
      .eq('story_id', storyId)
      .order('display_order')
      .order('created_at');
    if (cErr) throw cErr;

    res.json({ story, scenes: scenes ?? [], choices: choices ?? [] });
  } catch (err) {
    next(err);
  }
});

router.patch('/stories/:storyId', async (req, res, next) => {
  try {
    const { storyId } = req.params;
    assertUuid(storyId, 'story id');
    const body = req.body ?? {};
    const patch = {};

    if (has(body, 'title')) patch.title = text(body.title, 'Title', { max: 120, required: true });
    if (has(body, 'author')) patch.author = text(body.author, 'Author', { max: 160 });
    if (has(body, 'full_story_text')) patch.full_story_text = text(body.full_story_text, 'Full story text', { max: 50000 });
    if (has(body, 'description')) patch.description = text(body.description, 'Description', { max: 1000 });
    if (has(body, 'starting_scene_id')) {
      patch.starting_scene_id = body.starting_scene_id
        ? await sceneInStory(body.starting_scene_id, storyId)
        : null;
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update.');

    const { data, error } = await supabaseAdmin
      .from('stories')
      .update(patch)
      .eq('id', storyId)
      .select('id, title, author, full_story_text, description, status, starting_scene_id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Story not found.');
    res.json({ story: data });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------- scenes
router.post('/stories/:storyId/scenes', async (req, res, next) => {
  try {
    const { storyId } = req.params;
    assertUuid(storyId, 'story id');
    const body = req.body ?? {};
    const sceneType = body.scene_type ?? 'narrative';
    if (!SCENE_TYPES.includes(sceneType)) throw new HttpError(400, 'Invalid scene type.');

    const { data: story } = await supabaseAdmin.from('stories').select('id').eq('id', storyId).maybeSingle();
    if (!story) throw new HttpError(404, 'Story not found.');

    const { data, error } = await supabaseAdmin
      .from('scenes')
      .insert({
        story_id: storyId,
        title: text(body.title ?? 'New scene', 'Title', { max: 120 }),
        scene_type: sceneType,
        narration: text(body.narration, 'Narration', { max: 4000 }),
        display_order: await nextOrder('scenes', 'story_id', storyId),
      })
      .select('id, story_id, title, scene_type, narration, dialogue, background_image_path, sound_effect_path, display_order')
      .single();
    if (error) throw error;
    res.status(201).json({ scene: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/scenes/:sceneId', async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    assertUuid(sceneId, 'scene id');
    const body = req.body ?? {};
    const patch = {};

    if (has(body, 'title')) patch.title = text(body.title, 'Title', { max: 120 });
    if (has(body, 'narration')) patch.narration = text(body.narration, 'Narration', { max: 4000 });
    if (has(body, 'dialogue')) patch.dialogue = text(body.dialogue, 'Dialogue', { max: 1000 }) || null;
    if (has(body, 'scene_type')) {
      if (!SCENE_TYPES.includes(body.scene_type)) throw new HttpError(400, 'Invalid scene type.');
      patch.scene_type = body.scene_type;
    }
    if (has(body, 'display_order')) {
      if (!Number.isInteger(body.display_order) || body.display_order < 0 || body.display_order > 100000) {
        throw new HttpError(400, 'Invalid display order.');
      }
      patch.display_order = body.display_order;
    }
    if (has(body, 'character_config')) {
      patch.character_config = await sanitizeLayout(body.character_config, sceneId);
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update.');

    const { data, error } = await supabaseAdmin
      .from('scenes')
      .update(patch)
      .eq('id', sceneId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Scene not found.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/scenes/:sceneId', async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    assertUuid(sceneId, 'scene id');

    const { data: scene, error } = await supabaseAdmin
      .from('scenes')
      .select('id, story_id, title')
      .eq('id', sceneId)
      .maybeSingle();
    if (error) throw error;
    if (!scene) throw new HttpError(404, 'Scene not found.');

    const problems = [];
    const { data: story } = await supabaseAdmin
      .from('stories')
      .select('starting_scene_id')
      .eq('id', scene.story_id)
      .maybeSingle();
    if (story?.starting_scene_id === scene.id) problems.push("it is the story's starting scene");

    const { data: refs, error: refError } = await supabaseAdmin
      .from('choices')
      .select('text, scene_id')
      .or(`destination_scene_id.eq.${scene.id},failure_scene_id.eq.${scene.id}`)
      .neq('scene_id', scene.id);
    if (refError) throw refError;

    if (refs?.length) {
      const ids = [...new Set(refs.map((r) => r.scene_id))];
      const { data: owners } = await supabaseAdmin.from('scenes').select('id, title').in('id', ids);
      const titles = new Map((owners ?? []).map((o) => [o.id, o.title]));
      for (const r of refs) {
        problems.push(`the choice "${r.text}" in "${titles.get(r.scene_id) || 'Untitled'}" points to it`);
      }
    }

    if (problems.length) {
      throw new HttpError(409, `Cannot delete "${scene.title}": ${problems.join('; ')}. Change those first.`);
    }

    // Remove this scene's own choices first, then the scene.
    const { error: delChoices } = await supabaseAdmin.from('choices').delete().eq('scene_id', scene.id);
    if (delChoices) throw delChoices;
    const { error: delScene } = await supabaseAdmin.from('scenes').delete().eq('id', scene.id);
    if (delScene) throw delScene;

    await audit(req.profile.id, 'scene.delete', 'scene', scene.id, { title: scene.title });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------- choices
router.post('/scenes/:sceneId/choices', async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    assertUuid(sceneId, 'scene id');

    const { data: scene } = await supabaseAdmin
      .from('scenes')
      .select('id, story_id')
      .eq('id', sceneId)
      .maybeSingle();
    if (!scene) throw new HttpError(404, 'Scene not found.');

    const { data, error } = await supabaseAdmin
      .from('choices')
      .insert({
        scene_id: scene.id,
        story_id: scene.story_id,
        text: text(req.body?.text ?? 'New choice', 'Choice text', { max: 300 }),
        display_order: await nextOrder('choices', 'scene_id', scene.id),
      })
      .select('id')
      .single();
    if (error) throw error;
    res.status(201).json({ choice: data });
  } catch (err) {
    next(err);
  }
});

router.patch('/choices/:choiceId', async (req, res, next) => {
  try {
    const { choiceId } = req.params;
    assertUuid(choiceId, 'choice id');
    const body = req.body ?? {};

    const { data: choice } = await supabaseAdmin
      .from('choices')
      .select('id, scene_id, story_id')
      .eq('id', choiceId)
      .maybeSingle();
    if (!choice) throw new HttpError(404, 'Choice not found.');

    const patch = {};
    if (has(body, 'text')) patch.text = text(body.text, 'Choice text', { max: 300 });
    if (has(body, 'feedback')) patch.feedback = text(body.feedback, 'Feedback', { max: 500 }) || null;
    if (has(body, 'is_correct')) patch.is_correct = body.is_correct === true;
    if (has(body, 'display_order')) {
      if (!Number.isInteger(body.display_order) || body.display_order < 0 || body.display_order > 100000) {
        throw new HttpError(400, 'Invalid display order.');
      }
      patch.display_order = body.display_order;
    }
    if (has(body, 'destination_scene_id')) {
      patch.destination_scene_id = body.destination_scene_id
        ? await sceneInStory(body.destination_scene_id, choice.story_id)
        : null;
    }
    if (has(body, 'failure_scene_id')) {
      patch.failure_scene_id = body.failure_scene_id
        ? await sceneInStory(body.failure_scene_id, choice.story_id)
        : null;
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update.');

    // Only one correct choice per scene: clear the others first.
    if (patch.is_correct === true) {
      const { error: clearError } = await supabaseAdmin
        .from('choices')
        .update({ is_correct: false })
        .eq('scene_id', choice.scene_id)
        .eq('is_correct', true)
        .neq('id', choice.id);
      if (clearError) throw clearError;
    }

    const { error } = await supabaseAdmin.from('choices').update(patch).eq('id', choiceId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/choices/:choiceId', async (req, res, next) => {
  try {
    assertUuid(req.params.choiceId, 'choice id');
    const { error } = await supabaseAdmin.from('choices').delete().eq('id', req.params.choiceId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------ validate + publish
async function validateStory(storyId) {
  const { data: story, error } = await supabaseAdmin
    .from('stories')
    .select('id, starting_scene_id')
    .eq('id', storyId)
    .maybeSingle();
  if (error) throw error;
  if (!story) throw new HttpError(404, 'Story not found.');

  const { data: scenes, error: sErr } = await supabaseAdmin
    .from('scenes')
    .select('id, title, scene_type, narration')
    .eq('story_id', storyId);
  if (sErr) throw sErr;
  const { data: choices, error: cErr } = await supabaseAdmin
    .from('choices')
    .select('id, scene_id, text, destination_scene_id, failure_scene_id, is_correct')
    .eq('story_id', storyId);
  if (cErr) throw cErr;

  const errors = [];
  const warnings = [];
  const byId = new Map(scenes.map((s) => [s.id, s]));
  const choicesByScene = new Map();
  for (const c of choices) {
    if (!choicesByScene.has(c.scene_id)) choicesByScene.set(c.scene_id, []);
    choicesByScene.get(c.scene_id).push(c);
  }
  const name = (s) => `"${s.title?.trim() || 'Untitled scene'}"`;

  if (!scenes.length) errors.push('The story has no scenes.');
  const start = story.starting_scene_id ? byId.get(story.starting_scene_id) : null;
  if (!start) errors.push('Choose a starting scene.');
  else if (start.scene_type === 'ending') errors.push('The starting scene cannot be an ending.');

  for (const s of scenes) {
    const list = choicesByScene.get(s.id) ?? [];
    if (!s.title?.trim()) errors.push(`A ${s.scene_type} scene has no title.`);
    if (!s.narration?.trim()) errors.push(`Scene ${name(s)}: narration is empty.`);
    for (const c of list) {
      if (!c.text?.trim()) errors.push(`Scene ${name(s)}: a choice has no text.`);
    }

    if (s.scene_type === 'decision') {
      if (list.length < 2) errors.push(`Decision ${name(s)} needs at least two choices.`);
      const correct = list.filter((c) => c.is_correct);
      if (correct.length !== 1) {
        errors.push(`Decision ${name(s)} must have exactly one correct choice (it has ${correct.length}).`);
      }
      for (const c of list) {
        if (c.is_correct && !c.destination_scene_id) {
          errors.push(`Decision ${name(s)}: the correct choice "${c.text}" has no destination.`);
        }
        if (!c.is_correct) {
          const fail = c.failure_scene_id ? byId.get(c.failure_scene_id) : null;
          if (!fail) {
            warnings.push(`Decision ${name(s)}: wrong choice "${c.text}" has no failure scene, so students see a generic message.`);
          } else if (fail.scene_type !== 'failure') {
            warnings.push(`Decision ${name(s)}: the failure scene for "${c.text}" is not of type "failure".`);
          }
        }
      }
    } else if (s.scene_type === 'ending') {
      if (list.length) warnings.push(`Ending ${name(s)} has choices; they are ignored.`);
    } else if (s.scene_type !== 'failure') {
      if (!list.length) errors.push(`Scene ${name(s)} is a dead end: add a choice that leads somewhere.`);
      for (const c of list) {
        if (!c.destination_scene_id) errors.push(`Scene ${name(s)}: the choice "${c.text}" has no destination.`);
      }
    }
  }

  // Reachability from the starting scene.
  if (start) {
    const seen = new Set([start.id]);
    const queue = [start.id];
    while (queue.length) {
      const id = queue.shift();
      for (const c of choicesByScene.get(id) ?? []) {
        for (const next of [c.destination_scene_id, c.failure_scene_id]) {
          if (next && byId.has(next) && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
    }
    if (![...seen].some((id) => byId.get(id).scene_type === 'ending')) {
      errors.push('No ending is reachable from the starting scene.');
    }
    for (const s of scenes) {
      if (!seen.has(s.id)) warnings.push(`Scene ${name(s)} cannot be reached from the start.`);
    }
  }

  return { errors, warnings };
}

router.post('/stories/:storyId/validate', async (req, res, next) => {
  try {
    assertUuid(req.params.storyId, 'story id');
    res.json(await validateStory(req.params.storyId));
  } catch (err) {
    next(err);
  }
});

router.post('/stories/:storyId/publish', async (req, res, next) => {
  try {
    const { storyId } = req.params;
    assertUuid(storyId, 'story id');

    const { errors, warnings } = await validateStory(storyId);
    if (errors.length) {
      return res.status(400).json({
        error: 'Fix these problems before publishing.',
        details: { errors, warnings },
      });
    }

    const { data: versionId, error } = await supabaseAdmin.rpc('publish_story_version', {
      p_story_id: storyId,
      p_user_id: req.profile.id,
    });
    if (error) throw error;

    await audit(req.profile.id, 'story.publish', 'story', storyId, { version_id: versionId });
    res.json({ ok: true, versionId, warnings });
  } catch (err) {
    next(err);
  }
});

router.post('/stories/:storyId/unpublish', async (req, res, next) => {
  try {
    const { storyId } = req.params;
    assertUuid(storyId, 'story id');
    const { error } = await supabaseAdmin.from('stories').update({ status: 'draft' }).eq('id', storyId);
    if (error) throw error;
    await audit(req.profile.id, 'story.unpublish', 'story', storyId, null);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------- images
const BUCKET = 'story-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function looksLikeImage(buf, mime) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  if (mime === 'image/png') {
    return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/webp') {
    return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

async function resolveImageTarget(storyId, kind, sceneId) {
  assertUuid(storyId, 'story id');
  if (kind === 'cover') {
    const { data } = await supabaseAdmin.from('stories').select('id').eq('id', storyId).maybeSingle();
    if (!data) throw new HttpError(404, 'Story not found.');
    return { table: 'stories', id: storyId, column: 'cover_image_path' };
  }
  if (kind === 'background') {
    await sceneInStory(sceneId, storyId);
    return { table: 'scenes', id: sceneId, column: 'background_image_path' };
  }
  // "asset" = a character/object picture for the visual scene editor. It is only
  // stored in the bucket; the scene layout (character_config) references it.
  if (kind === 'asset') {
    const { data } = await supabaseAdmin.from('stories').select('id').eq('id', storyId).maybeSingle();
    if (!data) throw new HttpError(404, 'Story not found.');
    return { table: null, id: null, column: null };
  }
  throw new HttpError(400, 'kind must be "cover", "background" or "asset".');
}

// POST /stories/:storyId/images?kind=cover   or   ?kind=background&sceneId=<uuid>
//                                            or   ?kind=asset
// The request body is the raw image file.
router.post(
  '/stories/:storyId/images',
  express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_IMAGE_BYTES }),
  async (req, res, next) => {
    try {
      const mime = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const ext = IMAGE_TYPES[mime];
      if (!ext) throw new HttpError(415, 'Only PNG, JPEG or WebP images are allowed.');
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'No image received.');
      if (!looksLikeImage(req.body, mime)) throw new HttpError(400, 'That file is not a valid image.');

      const { storyId } = req.params;
      const { kind, sceneId } = req.query;
      const target = await resolveImageTarget(storyId, kind, sceneId);

      const path = `${storyId}/${kind}-${randomUUID()}.${ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, req.body, { contentType: mime, upsert: false, cacheControl: '31536000' });
      if (uploadError) throw uploadError;

      const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      if (target.table) {
        const { error } = await supabaseAdmin.from(target.table).update({ [target.column]: url }).eq('id', target.id);
        if (error) throw error;
        await audit(req.profile.id, 'image.upload', target.table === 'stories' ? 'story' : 'scene', target.id, { path });
      }
      res.status(201).json({ url });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /stories/:storyId/images?kind=cover   or   ?kind=background&sceneId=<uuid>
// Clears the reference only. The file stays in storage because published
// versions and old reports may still use it.
router.delete('/stories/:storyId/images', async (req, res, next) => {
  try {
    const target = await resolveImageTarget(req.params.storyId, req.query.kind, req.query.sceneId);
    if (!target.table) throw new HttpError(400, 'Nothing to clear for this kind of image.');
    const { error } = await supabaseAdmin.from(target.table).update({ [target.column]: null }).eq('id', target.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// MP3 scene sound effects use the existing Supabase Storage bucket. Only the
// scene stores a URL; the audio bytes remain in object storage.
router.post('/stories/:storyId/audio', express.raw({ type: ['audio/mpeg', 'audio/mp3', 'application/octet-stream'], limit: MAX_AUDIO_BYTES }), async (req, res, next) => {
  try {
    const { storyId } = req.params;
    const { sceneId } = req.query;
    await sceneInStory(sceneId, storyId);
    const mime = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length < 4) throw new HttpError(400, 'No audio received.');
    if (!['audio/mpeg', 'audio/mp3', 'application/octet-stream'].includes(mime)) {
      throw new HttpError(415, 'Choose an MP3 audio file.');
    }
    // MP3 streams commonly start with an ID3 header or an MPEG audio frame.
    const hasId3 = body.subarray(0, 3).toString('ascii') === 'ID3';
    const hasFrame = body[0] === 0xff && (body[1] & 0xe0) === 0xe0;
    if (!hasId3 && !hasFrame) throw new HttpError(400, 'That file is not a valid MP3.');

    const path = `${storyId}/scene-audio-${randomUUID()}.mp3`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET)
      .upload(path, body, { contentType: 'audio/mpeg', upsert: false, cacheControl: '31536000' });
    if (uploadError) throw uploadError;
    const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { error } = await supabaseAdmin.from('scenes').update({ sound_effect_path: url }).eq('id', sceneId);
    if (error) throw error;
    await audit(req.profile.id, 'audio.upload', 'scene', sceneId, { path });
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
});

router.delete('/stories/:storyId/audio', async (req, res, next) => {
  try {
    const { storyId } = req.params;
    const { sceneId } = req.query;
    await sceneInStory(sceneId, storyId);
    const { error } = await supabaseAdmin.from('scenes').update({ sound_effect_path: null }).eq('id', sceneId);
    if (error) throw error;
    await audit(req.profile.id, 'audio.remove', 'scene', sceneId, {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------- scene layouts
// Scene layouts (characters and objects placed on a scene) are stored in
// scenes.character_config. Everything is validated here, on the server.
const MAX_LAYOUT_OBJECTS = 100;
const clampNum = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round4 = (n) => Math.round(n * 10000) / 10000;

function finiteNumber(value, label) {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) throw new HttpError(400, `Invalid ${label}.`);
  return n;
}

function storyAssetPrefix(storyId) {
  // ".../storage/v1/object/public/story-images/" + "<storyId>/"
  const base = supabaseAdmin.storage.from(BUCKET).getPublicUrl('x').data.publicUrl.slice(0, -1);
  return `${base}${storyId}/`;
}

async function sanitizeLayout(raw, sceneId) {
  if (raw === null) return null;
  if (typeof raw !== 'object' || !Array.isArray(raw.objects)) {
    throw new HttpError(400, 'Invalid scene layout.');
  }
  if (raw.objects.length > MAX_LAYOUT_OBJECTS) {
    throw new HttpError(400, `A scene can hold up to ${MAX_LAYOUT_OBJECTS} pictures.`);
  }

  const { data: scene, error } = await supabaseAdmin
    .from('scenes')
    .select('story_id')
    .eq('id', sceneId)
    .maybeSingle();
  if (error) throw error;
  if (!scene) throw new HttpError(404, 'Scene not found.');

  const prefix = storyAssetPrefix(scene.story_id);
  const seen = new Set();

  const objects = raw.objects.map((o, i) => {
    if (!o || typeof o !== 'object') throw new HttpError(400, `Picture ${i + 1} is invalid.`);
    const id = String(o.id ?? '');
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || seen.has(id)) {
      throw new HttpError(400, `Picture ${i + 1} has an invalid id.`);
    }
    seen.add(id);

    const src = typeof o.src === 'string' ? o.src : '';
    if (!src.startsWith(prefix) || src.length > 500 || /[\s"'<>]/.test(src)) {
      throw new HttpError(400, 'Pictures can only come from images uploaded to this story.');
    }

    return {
      id,
      src,
      x: round4(clampNum(finiteNumber(o.x, 'x position'), -0.5, 1.5)),
      y: round4(clampNum(finiteNumber(o.y, 'y position'), -0.5, 1.5)),
      w: round4(clampNum(finiteNumber(o.w, 'width'), 0.01, 2)),
      h: round4(clampNum(finiteNumber(o.h, 'height'), 0.01, 2)),
      rotation: round4(clampNum(finiteNumber(o.rotation ?? 0, 'rotation'), -360, 360)),
      opacity: round4(clampNum(finiteNumber(o.opacity ?? 1, 'opacity'), 0, 1)),
      flipX: o.flipX === true,
      flipY: o.flipY === true,
      intro: ['none', 'fade', 'left', 'right', 'top', 'bottom', 'zoom', 'bounce'].includes(o.intro) ? o.intro : 'none',
      duration: round4(clampNum(finiteNumber(o.duration ?? 0.6, 'animation duration'), 0.1, 10)),
      delay: round4(clampNum(finiteNumber(o.delay ?? 0, 'animation delay'), 0, 10)),
    };
  });

  return objects.length ? { version: 1, objects } : null;
}

// GET /stories/:storyId/assets - pictures uploaded for this story's scenes.
router.get('/stories/:storyId/assets', async (req, res, next) => {
  try {
    const { storyId } = req.params;
    assertUuid(storyId, 'story id');
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(storyId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;

    const assets = (data ?? [])
      .filter((f) => f.name.startsWith('asset-'))
      .map((f) => ({
        name: f.name,
        url: supabaseAdmin.storage.from(BUCKET).getPublicUrl(`${storyId}/${f.name}`).data.publicUrl,
      }));
    res.json({ assets });
  } catch (err) {
    next(err);
  }
});

export default router;

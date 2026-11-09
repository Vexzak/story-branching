import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

// Every route here requires a valid session.
router.use(requireAuth);

/** GET /api/me - the signed-in user's profile. */
router.get('/', (req, res) => {
  res.json({ profile: req.profile });
});

// Record that a student has seen the storybook tutorial on this account.
router.patch('/book-tutorial', async (req, res, next) => {
  try {
    if (req.profile.role !== 'student') throw new HttpError(403, 'Only students can update this setting.');
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ book_tutorial_seen: true })
      .eq('id', req.profile.id)
      .select('book_tutorial_seen')
      .single();
    if (error) throw error;
    res.json({ bookTutorialSeen: data.book_tutorial_seen });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username must be 30 characters or fewer.')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Use only letters, numbers, dots, dashes, and underscores.')
    .optional(),
  displayName: z.string().trim().min(1, 'Display name is required.').max(60).optional(),
});

/**
 * PATCH /api/me/profile
 * Students may update their own username / display name. The role is never
 * editable here (or anywhere else reachable by a student).
 */
router.patch('/profile', async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the form.', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const updates = {};
    if (parsed.data.displayName !== undefined) {
      updates.display_name = parsed.data.displayName;
    }

    if (parsed.data.username !== undefined) {
      const { data: existing, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('username', parsed.data.username)
        .neq('id', req.profile.id)
        .maybeSingle();

      if (error) throw error;
      if (existing) {
        throw new HttpError(409, 'That username is already taken.', {
          fields: { username: ['That username is already taken.'] },
        });
      }
      updates.username = parsed.data.username;
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ profile: req.profile });
    }

    const { data: profile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.profile.id)
      .select('id, username, display_name, role, created_at, updated_at')
      .single();

    if (updateError) {
      if (updateError.code === '23505') {
        throw new HttpError(409, 'That username is already taken.');
      }
      throw updateError;
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

export default router;

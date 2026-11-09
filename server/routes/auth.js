import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabaseAdmin } from '../supabase.js';
import { HttpError } from '../middleware/error.js';

const router = Router();

// Slow down repeated registration / availability probing.
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

const usernamePattern = /^[A-Za-z0-9_.-]+$/;

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username must be 30 characters or fewer.')
    .regex(usernamePattern, 'Use only letters, numbers, dots, dashes, and underscores.'),
  displayName: z.string().trim().max(60).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be 72 characters or fewer.'),
});

/**
 * POST /api/auth/signup
 * Public registration. ALWAYS creates a student. The role can never be chosen
 * by the caller. Creates the Supabase Auth user and the matching profile.
 */
router.post('/signup', signupLimiter, async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the form.', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, username, displayName, password } = parsed.data;

    // Case-insensitive username uniqueness check (the DB index is the backstop).
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) {
      throw new HttpError(409, 'That username is already taken.', {
        fields: { username: ['That username is already taken.'] },
      });
    }

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, display_name: displayName || username },
      });

    if (createError) {
      if (/already|exists|registered/i.test(createError.message)) {
        throw new HttpError(409, 'That email address is already registered.', {
          fields: { email: ['That email address is already registered.'] },
        });
      }
      throw createError;
    }

    const userId = created.user.id;

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      username,
      display_name: displayName || username,
      role: 'student',
    });

    if (profileError) {
      // Roll back the orphaned auth user so the email can be reused.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      if (profileError.code === '23505') {
        throw new HttpError(409, 'That username is already taken.', {
          fields: { username: ['That username is already taken.'] },
        });
      }
      throw profileError;
    }

    res.status(201).json({
      user: { id: userId, email, username, role: 'student' },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/username-available?username=...
 * Lightweight live-validation helper for the signup form.
 */
router.get('/username-available', signupLimiter, async (req, res, next) => {
  try {
    const username = String(req.query.username || '').trim();
    if (username.length < 3 || username.length > 30 || !usernamePattern.test(username)) {
      return res.json({ available: false, valid: false });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (error) throw error;

    res.json({ available: !data, valid: true });
  } catch (err) {
    next(err);
  }
});

export default router;

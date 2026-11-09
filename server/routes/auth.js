import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { supabaseAdmin } from '../supabase.js';
import { HttpError } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many recovery attempts. Please try again later.' },
});
const recoveryStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const hashRecoveryKey = (key) => createHash('sha256').update(key).digest('hex');

// Start recovery using the student's username. A tracking key lets this browser
// check the decision; the actual reset link is sent to the registered email.
router.post('/password-recovery', recoveryLimiter, async (req, res, next) => {
  try {
    const parsed = z.object({
      username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_.-]+$/),
    }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Enter your account username.');

    const trackingKey = randomBytes(32).toString('hex');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .ilike('username', parsed.data.username.replace(/[\\%_]/g, '\\$&'))
      .maybeSingle();
    if (profileError) throw profileError;

    if (profile?.role === 'student') {
      const { error } = await supabaseAdmin.from('password_reset_requests').insert({
        student_id: profile.id,
        tracking_key_hash: hashRecoveryKey(trackingKey),
      });
      if (error?.code === '23505') {
        const { error: refreshError } = await supabaseAdmin
          .from('password_reset_requests')
          .update({ tracking_key_hash: hashRecoveryKey(trackingKey), requested_at: new Date().toISOString() })
          .eq('student_id', profile.id)
          .eq('status', 'pending');
        if (refreshError) throw refreshError;
      } else if (error) throw error;
    }

    // Same response shape for unknown users and duplicate requests.
    res.status(202).json({ trackingKey, message: 'If this username belongs to a student account, the request has been sent to an administrator.' });
  } catch (err) {
    next(err);
  }
});

router.get('/password-recovery/:trackingKey', recoveryStatusLimiter, async (req, res, next) => {
  try {
    const key = String(req.params.trackingKey || '');
    if (!/^[a-f0-9]{64}$/.test(key)) throw new HttpError(404, 'Recovery request not found.');
    const { data, error } = await supabaseAdmin
      .from('password_reset_requests')
      .select('status, requested_at, reviewed_at, expires_at')
      .eq('tracking_key_hash', hashRecoveryKey(key))
      .maybeSingle();
    if (error) throw error;
    // Unknown usernames get an indistinguishable waiting state, avoiding an
    // account-existence oracle through the status endpoint.
    res.json({ request: data || { status: 'pending' } });
  } catch (err) {
    next(err);
  }
});

router.post('/password-recovery/complete', requireAuth, async (req, res, next) => {
  try {
    const key = String(req.body?.trackingKey || '');
    if (!/^[a-f0-9]{64}$/.test(key)) throw new HttpError(400, 'Invalid recovery request.');
    const { data, error } = await supabaseAdmin
      .from('password_reset_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('tracking_key_hash', hashRecoveryKey(key))
      .eq('student_id', req.authUser.id)
      .eq('status', 'approved')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'Approved recovery request not found.');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

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

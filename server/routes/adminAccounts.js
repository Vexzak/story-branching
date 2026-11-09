import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../supabase.js';
import { requireAuth, requireAdminManager } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth, requireAdminManager);

const accountSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  username: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_.-]+$/),
  displayName: z.string().trim().min(1).max(60),
  password: z.string().min(12).max(72),
  canManageAdmins: z.boolean().default(false),
});

async function emailFor(userId) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data?.user?.email ?? '';
}

router.get('/', async (_req, res, next) => {
  try {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, can_manage_admins, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const admins = await Promise.all((profiles ?? []).map(async (profile) => ({
      ...profile,
      email: await emailFor(profile.id),
    })));
    res.json({ admins });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  let createdUserId = null;
  try {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the account details.', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const { email, username, displayName, password, canManageAdmins } = parsed.data;

    const { data: existingUsername, error: usernameError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();
    if (usernameError) throw usernameError;
    if (existingUsername) throw new HttpError(409, 'That username is already in use.');

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
    });
    if (createError) {
      if (/already|exists|registered/i.test(createError.message)) {
        throw new HttpError(409, 'That email address is already registered.');
      }
      throw createError;
    }
    createdUserId = created.user.id;

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: createdUserId,
      username,
      display_name: displayName,
      role: 'admin',
      can_manage_admins: canManageAdmins,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      createdUserId = null;
      if (profileError.code === '23505') throw new HttpError(409, 'That username is already in use.');
      throw profileError;
    }

    const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.profile.id,
      action: 'admin.account.create',
      target_type: 'admin',
      target_id: createdUserId,
      details: { email, username, can_manage_admins: canManageAdmins },
    });
    if (auditError) console.error('Audit log failed:', auditError.message);

    res.status(201).json({
      admin: { id: createdUserId, email, username, display_name: displayName, can_manage_admins: canManageAdmins },
    });
  } catch (err) {
    if (createdUserId) await supabaseAdmin.auth.admin.deleteUser(createdUserId);
    next(err);
  }
});

export default router;

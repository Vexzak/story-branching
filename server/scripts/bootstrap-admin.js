// ============================================================================
// Secure first-administrator bootstrap.
//
// The first admin is NEVER created through public signup. Run this script once
// after configuring .env:
//
//   cd server
//   npm run bootstrap-admin
//
// It is idempotent: re-running promotes/updates the same account rather than
// creating duplicates. The password is read from the environment and is never
// printed or stored anywhere in plaintext by this script.
// ============================================================================
import { supabaseAdmin } from '../supabase.js';
import { env } from '../env.js';

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_USERNAME in .env first.`
    );
  }
  return value;
}

async function main() {
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD');
  const username = requireEnv('ADMIN_USERNAME');
  const displayName = (process.env.ADMIN_DISPLAY_NAME || username).trim();

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.');
  }

  console.log(`Bootstrapping administrator "${username}" <${email}> ...`);

  // Find an existing auth user with this email (page through admin.listUsers).
  let existingUser = null;
  let page = 1;
  while (!existingUser) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    existingUser = data.users.find((u) => (u.email || '').toLowerCase() === email) || null;
    if (data.users.length < 200) break;
    page += 1;
  }

  let userId;
  if (existingUser) {
    userId = existingUser.id;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    console.log('Existing auth user found - password refreshed and email confirmed.');
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log('Auth user created.');
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    {
      id: userId,
      username,
      display_name: displayName,
      role: 'admin',
      can_manage_admins: true,
    },
    { onConflict: 'id' }
  );

  if (profileError) throw profileError;

  console.log(`Administrator ready: ${username} (${email})`);
  console.log('Sign in at the app login page and you will be routed to the admin dashboard.');
  console.log(`(API origin: ${env.SUPABASE_URL})`);
}

main().catch((err) => {
  console.error('Bootstrap failed:', err.message);
  process.exit(1);
});

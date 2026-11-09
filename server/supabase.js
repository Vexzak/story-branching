// Single privileged Supabase client for the backend.
//
// IMPORTANT: this client uses the service-role key. It must never be imported
// into client-side code and the key must never be exposed to the browser.
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

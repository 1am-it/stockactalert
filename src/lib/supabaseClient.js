// 1AM-181: Supabase client singleton for browser-side use.
//
// Different from api/trades.js's server-side client (which uses the service
// role key and bypasses RLS). This client uses the anon key — RLS policies
// from 1AM-180 protect each user's data. The anon key is safe to ship in the
// browser bundle.
//
// Vite exposes only env vars prefixed VITE_*. Both must be set in:
//   - .env.local for local dev
//   - Vercel Environment Variables for Production + Preview deploys
//
// USAGE:
//   import { supabase } from './lib/supabaseClient';
//   const { data, error } = await supabase.from('users').select('*');

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loud at boot rather than at first auth attempt. Helps catch the
  // common mistake of forgetting to add env vars to a new environment.
  // eslint-disable-next-line no-console
  console.error(
    '1AM-181: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars. ' +
      'Auth features will not work. Add them to .env.local (local dev) or ' +
      'Vercel Environment Variables (deploys).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist session in localStorage across page reloads.
    persistSession: true,
    // Auto-refresh expired tokens before they cause API call failures.
    autoRefreshToken: true,
    // Detect access_token in URL hash after magic-link callback and
    // automatically establish session. We clean up the URL hash separately
    // in App.jsx after detection.
    detectSessionInUrl: true,
  },
});

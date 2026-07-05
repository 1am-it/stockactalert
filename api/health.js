// 1AM-78: minimum-viable health endpoint. Reports whether the FMP-fetch
// cron is actually running (not just whether Supabase is reachable) — a
// cron that silently stops would otherwise look identical to "no news
// today" until someone notices stale data by hand.
//
// Deliberately does NOT report push-notification dispatch/backlog metrics
// (per the 1AM-78 spec): that infra doesn't exist yet (1AM-72 is still
// Backlog). Add those fields when the dispatch pipeline ships instead of
// faking them now.

import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

// Cron runs daily (.github/workflows/refresh-archive.yml); allow a day of
// slack before treating a missing run as unhealthy rather than "just
// hasn't fired yet today".
const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

export default async function handler() {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ status: 'error', error: 'Supabase not configured' }),
      { status: 500, headers }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const checks = {};
  let healthy = true;

  // ── Database connectivity ──────────────────────────────────────────────
  try {
    const { error } = await supabase.from('filings').select('id', { head: true, count: 'exact' });
    checks.database = error ? { ok: false, error: error.message } : { ok: true };
    if (error) healthy = false;
  } catch (err) {
    checks.database = { ok: false, error: err.message };
    healthy = false;
  }

  // ── Last fetch-trades cron run ─────────────────────────────────────────
  try {
    const { data, error } = await supabase
      .from('cron_runs')
      .select('status, ran_at, detail')
      .eq('job_name', 'fetch-trades')
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      checks.fetchTradesCron = { ok: false, error: error.message };
      healthy = false;
    } else if (!data) {
      checks.fetchTradesCron = { ok: false, error: 'No cron runs recorded yet' };
      healthy = false;
    } else {
      const ageMs = Date.now() - new Date(data.ran_at).getTime();
      const stale = ageMs > STALE_AFTER_MS;
      const ok = data.status !== 'failure' && !stale;
      checks.fetchTradesCron = {
        ok,
        lastStatus: data.status,
        lastRanAt: data.ran_at,
        stale,
        detail: data.detail,
      };
      if (!ok) healthy = false;
    }
  } catch (err) {
    checks.fetchTradesCron = { ok: false, error: err.message };
    healthy = false;
  }

  return new Response(
    JSON.stringify({
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    }),
    { status: healthy ? 200 : 503, headers }
  );
}

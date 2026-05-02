import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

const ARCHIVE_ACTIVATION_DATE = '2026-05-01';
const CACHE_CONTROL_SUCCESS = 'public, s-maxage=3600, stale-while-revalidate=7200';
const CACHE_CONTROL_ERROR = 'no-store';

export default async function handler(req) {
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  const okHeaders = { ...baseHeaders, 'Cache-Control': CACHE_CONTROL_SUCCESS };
  const errHeaders = { ...baseHeaders, 'Cache-Control': CACHE_CONTROL_ERROR };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: errHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { count, error } = await supabase
      .from('filings')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return new Response(
        JSON.stringify({
          error: 'Archive temporarily unavailable',
          details: error.message,
        }),
        { status: 503, headers: errHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        total: count || 0,
        archiveStartDate: ARCHIVE_ACTIVATION_DATE,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: okHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers: errHeaders }
    );
  }
}

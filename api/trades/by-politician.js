// 1AM-30 / 1AM-158: Vercel Edge Function /api/trades/by-politician
//
// Returns historical trades for ONE politician. Used by PoliticianDetailScreen
// (1AM-69) for the deep-history view that goes beyond what the latest-50 feed
// shows.
//
// 1AM-158 (2026-05-09): Migrated FROM FMP per-politician endpoints TO the
// Supabase archive. FMP moved /stable/senate-trades-by-name and
// /stable/house-trades-by-name behind a paid tier (HTTP 402), making both
// chamber calls fail and surfacing as 502 to clients. Same pattern as 1AM-37
// (sp500-constituent paywall). The Supabase archive (1AM-114) already holds
// all filings since May 2026 with politician_name indexed for ilike queries —
// purpose-built for exactly this read pattern.
//
// External contract unchanged:
//   GET /api/trades/by-politician?name=<name>&limit=<n>
//   Response: { name, count, trades: Trade[] }
//
// Consumers (useTradesByPolitician hook + PoliticianDetailScreen) need no
// changes. CDN cache headers identical to the previous version.
//
// Trade-off accepted: archive depth is bounded by the May 2026 backfill date.
// The previous FMP-based version was bounded by FMP_PER_CHAMBER_LIMIT (25)
// per chamber, so practical depth is similar — and grows over time as the
// archive accumulates rather than being capped by a per-call limit.
//
// Free-tier discipline: zero FMP calls per request. Supabase pricing is read-
// dominated and well within the free tier at current scale (1AM-49).

import { createClient } from '@supabase/supabase-js';
import { normaliseFMPTrade, CHAMBERS } from '../../src/data/schema.js';

export const config = {
  runtime: 'edge',
};

// Default + max trades returned to caller. 200 chosen as the sweet spot:
// covers ~1-2 years of history for most politicians, well within the archive,
// without inflating bundle size or memory in the frontend.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 200;

// 24h fresh, 48h stale-while-revalidate. STOCK Act filings refresh daily at
// most; 24h is well within usefulness. Popular politicians become shared
// cache entries across all users via the URL-encoded name in the cache key.
const CACHE_CONTROL_SUCCESS =
  'public, s-maxage=86400, stale-while-revalidate=172800';

const CACHE_CONTROL_ERROR = 'no-store';

// Map archive's lowercase chamber values to the frontend's enum (matches
// /api/trades.js — kept in sync).
const CHAMBER_MAP = {
  senate: CHAMBERS.SENATE,
  house: CHAMBERS.HOUSE,
};

export default async function handler(req) {
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  const okHeaders = { ...baseHeaders, 'Cache-Control': CACHE_CONTROL_SUCCESS };
  const errHeaders = { ...baseHeaders, 'Cache-Control': CACHE_CONTROL_ERROR };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get('name') || '').trim();
    const limitParam = parseInt(searchParams.get('limit') || '', 10);
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, MAX_LIMIT)
        : DEFAULT_LIMIT;

    if (!name) {
      return new Response(
        JSON.stringify({
          error: "Query parameter 'name' is required",
          example: '/api/trades/by-politician?name=Nancy%20Pelosi',
        }),
        { status: 400, headers: errHeaders }
      );
    }

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

    // Escape postgres LIKE wildcards in the user-supplied name before passing
    // it as an ilike pattern. Without this, a name containing '%' or '_'
    // would match unrelated rows (defensive against future edge cases — current
    // congress.json has no such names but cheap to guard).
    const escaped = name.replace(/[%_]/g, '\\$&');

    const { data, error } = await supabase
      .from('filings')
      .select('chamber, raw_data')
      .ilike('politician_name', `%${escaped}%`)
      .order('trade_date', { ascending: false })
      .range(0, limit - 1);

    if (error) {
      return new Response(
        JSON.stringify({
          error: 'Archive temporarily unavailable',
          name,
          details: error.message,
        }),
        { status: 503, headers: errHeaders }
      );
    }

    // Normalise each archive row into the internal Trade schema. raw_data
    // is the original FMP payload kept verbatim in the archive — running it
    // through normaliseFMPTrade guarantees schema parity with /api/trades.
    const trades = (data || []).map((row) => {
      const frontendChamber = CHAMBER_MAP[row.chamber] || row.chamber;
      return normaliseFMPTrade(row.raw_data, frontendChamber);
    });

    return new Response(
      JSON.stringify({
        name,
        count: trades.length,
        trades,
      }),
      { status: 200, headers: okHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'Server error',
        message: err && err.message ? err.message : String(err),
      }),
      { status: 500, headers: errHeaders }
    );
  }
}

// 1AM-113: Vercel Edge Function /api/trades — reads from Supabase archive
//
// Predecessor: this endpoint used to call FMP /senate-latest + /house-latest
// directly on every request. As of v0.15.0 it reads from the Supabase
// `filings` archive populated by the daily cron (refresh-archive.yml).
//
// Why this change:
//   - User-visible: archive depth grows beyond the 50-trade FMP window over
//     time, enabling Browse `Load more` and date-range filter (1AM-114).
//   - Backend: removes per-request FMP API-key exposure from the Edge fn,
//     reduces FMP credit consumption to one daily cron call vs. one per
//     unique CDN cache miss.
//
// Response shape is byte-identical to the FMP-direct version, achieved by
// reusing normaliseFMPTrade on the preserved raw_data jsonb column. Frontend
// requires no changes for the basic feed.
//
// 1AM-114 prep: the new `offset` and `since` query params are accepted but
// optional — frontend can ignore them today, opt in when Browse Load more +
// date-range chip ship in 1AM-114.
//
// FALLBACK: hard 503 if Supabase fails. No fallback to FMP — see decision
// 4 in 1AM-113 Session Plan: pre-launch the dwell time on a clean failure
// signal beats hidden degradation. Revisit before 1AM-50 launch.
//
// GET /api/trades
// Query params (all optional):
//   ticker      filter by stock symbol, exact match, case-insensitive (e.g. NVDA)
//   politician  filter by politician name, case-insensitive substring
//   since       earliest filing date YYYY-MM-DD (inclusive)
//   limit       max results, default 50, hard cap 500
//   offset      skip N results for pagination, default 0

import { createClient } from '@supabase/supabase-js';
import {
  normaliseFMPTrade,
  deduplicateTrades,
  sortTradesByDate,
  CHAMBERS,
} from '../src/data/schema.js';

export const config = {
  runtime: 'edge',
};

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500; // sanity cap on a single response

// CDN cache: 1h fresh + 2h stale-while-revalidate. Same as v0.14.x —
// Supabase rewire doesn't change cache semantics. Daily cron updates the
// archive once per day, so 1h CDN hit-rate is fine.
const CACHE_CONTROL_SUCCESS =
  'public, s-maxage=3600, stale-while-revalidate=7200';
const CACHE_CONTROL_ERROR = 'no-store';

// DB stores chamber lowercase ('senate' | 'house') for Postgres-conventional
// reasons. The frontend (via CHAMBERS) expects Title Case ('Senate' | 'House').
// This map is the only place that translates between the two conventions.
const CHAMBER_MAP = {
  senate: CHAMBERS.SENATE,
  house: CHAMBERS.HOUSE,
};

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req) {
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  const okHeaders = { ...baseHeaders, 'Cache-Control': CACHE_CONTROL_SUCCESS };
  const errHeaders = { ...baseHeaders, 'Cache-Control': CACHE_CONTROL_ERROR };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders });
  }

  try {
    // ── Parse query params ───────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get('ticker') || '').trim();
    const politician = (searchParams.get('politician') || '').trim();
    const since = (searchParams.get('since') || '').trim();
    const limitRaw = parseInt(
      searchParams.get('limit') || String(DEFAULT_LIMIT),
      10
    );
    const offsetRaw = parseInt(searchParams.get('offset') || '0', 10);

    // Sanity caps
    const limit = Math.min(
      Math.max(1, isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw),
      MAX_LIMIT
    );
    const offset = Math.max(0, isNaN(offsetRaw) ? 0 : offsetRaw);

    // Validate `since` format if provided (Supabase will accept many shapes,
    // but we want predictable input for callers).
    if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      return new Response(
        JSON.stringify({ error: 'Param `since` must be YYYY-MM-DD format' }),
        { status: 400, headers: errHeaders }
      );
    }

    // ── Config validation ────────────────────────────────────────────────────
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // 500 (not 503) — server is misconfigured, not Service Unavailable.
      // Caller cannot recover by retrying.
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: errHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // ── Build query ──────────────────────────────────────────────────────────
    // We only select chamber + raw_data because normaliseFMPTrade reconstructs
    // the full trade shape from raw_data. The normalized columns
    // (politician_name, ticker, etc.) are used for filtering/ordering only.
    let query = supabase
      .from('filings')
      .select('chamber, raw_data')
      .order('filed_date', { ascending: false });

    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase());
    }
    if (politician) {
      // ilike = case-insensitive LIKE; %X% = substring match.
      // Escape % and _ in the user input to prevent unintended matches.
      const escaped = politician.replace(/[%_]/g, '\\$&');
      query = query.ilike('politician_name', `%${escaped}%`);
    }
    if (since) {
      query = query.gte('filed_date', since);
    }

    // Supabase range is inclusive on both ends, so [offset, offset+limit-1]
    // returns exactly `limit` rows.
    query = query.range(offset, offset + limit - 1);

    // ── Execute query ────────────────────────────────────────────────────────
    const { data, error } = await query;

    if (error) {
      // Hard 503: archive is unreachable. Caller should retry shortly.
      return new Response(
        JSON.stringify({
          error: 'Archive temporarily unavailable',
          details: error.message,
        }),
        { status: 503, headers: errHeaders }
      );
    }

    // ── Normalise to legacy shape ────────────────────────────────────────────
    // Map the lowercase DB chamber back to the Title Case the frontend expects,
    // then run normaliseFMPTrade — same function the FMP-direct version used.
    // This guarantees byte-identical response shape across the migration.
    const trades = (data || []).map((row) => {
      const frontendChamber = CHAMBER_MAP[row.chamber] || row.chamber;
      return normaliseFMPTrade(row.raw_data, frontendChamber);
    });

    // Defensive: dedup + sort. Both should be no-ops because the DB has a
    // unique index and we already ordered by filed_date desc, but keeping
    // them costs nothing and protects against schema drift in raw_data.
    const finalTrades = sortTradesByDate(deduplicateTrades(trades));

    // ── Response ─────────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        trades: finalTrades,
        source: 'fmp', // upstream provider unchanged — only the read path differs
        count: finalTrades.length,
        filters: { ticker, politician, since, limit, offset },
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

// 1AM-30: Vercel Edge Function /api/trades/by-politician
//
// Returns historical trades for ONE politician, beyond what the latest-50 feed
// shows. Built to support the PoliticianDetailScreen (1AM-69) which needs more
// data depth than the generic /api/trades endpoint provides.
//
// Strategy: query FMP's per-politician endpoints (senate-trades-by-name +
// house-trades-by-name) directly — far more credit-efficient than paginating
// the generic latest endpoints and filtering server-side.
//
// FMP endpoint reference (verified 2026-04-28 against FMP docs):
//   https://financialmodelingprep.com/stable/senate-trades-by-name?name=X
//   https://financialmodelingprep.com/stable/house-trades-by-name?name=X
//
// Query strategy: pass lastName only as the FMP `name` parameter. FMP's docs
// example uses first-name (`?name=Jerry`) without explaining how the query
// matches. Last name is far more unique across Congress (one "Pelosi" vs
// multiple "Mike"s) so it minimises false positives. We then double-filter
// server-side on the original full name to drop any remaining noise.
//
// Caching: 24h CDN TTL with 48h stale-while-revalidate. Cache key includes
// politician name (URL-encoded), so popular politicians become shared cache
// entries across all users.
//
// Free-tier discipline:
// - One call per chamber per politician (Senate + House in parallel)
// - Up to FMP_PER_CHAMBER_LIMIT (25) trades per chamber per call
// - Most politicians sit in only one chamber → typically 2 calls per request,
//   sometimes 1 (when one chamber returns immediately empty)
//
// GET /api/trades/by-politician
// Query params:
//   name  (required) — politician display name e.g. "Nancy Pelosi"
//   limit (optional) — max trades returned, default 200, capped at 200

import {
  normaliseFMPTrade,
  deduplicateTrades,
  sortTradesByDate,
  CHAMBERS,
} from '../../src/data/schema.js';

export const config = {
  runtime: 'edge',
};

// FMP per-politician endpoints. URL pattern verified against FMP's STOCK Act
// docs; if FMP changes paths these constants are the only place to update.
const FMP_BASE = 'https://financialmodelingprep.com/stable';
const FMP_SENATE_BY_NAME = `${FMP_BASE}/senate-trades-by-name`;
const FMP_HOUSE_BY_NAME = `${FMP_BASE}/house-trades-by-name`;

// Free-tier limit per call. Two parallel calls (Senate + House) per request.
const FMP_PER_CHAMBER_LIMIT = 25;

// Default + max trades returned to caller. 200 chosen as the sweet spot:
// covers ~1-2 years of history for most politicians, well within FMP's depth,
// without inflating bundle size or memory in the frontend.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 200;

// 24h fresh, 48h stale-while-revalidate. STOCK Act filings refresh daily at
// most; 24h is well within usefulness while keeping FMP-call rate low.
const CACHE_CONTROL_SUCCESS =
  'public, s-maxage=86400, stale-while-revalidate=172800';

const CACHE_CONTROL_ERROR = 'no-store';

// Extract last name from a "First Last" or "First Middle Last" string.
// Handles hyphenated last names (e.g. "Alexandria Ocasio-Cortez" → "Ocasio-Cortez").
// Returns empty string for unparseable input. Used to build the FMP query —
// last name is more unique than first name across Congress (one "Pelosi"
// vs multiple "Mike"s).
function extractLastName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  return parts[parts.length - 1];
}

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
    const limit = Number.isFinite(limitParam) && limitParam > 0
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

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'FMP_API_KEY not configured' }),
        { status: 500, headers: errHeaders }
      );
    }

    // ── Build FMP URLs (Senate + House) ──────────────────────────────────────
    // Calling both chambers in parallel; one will typically return empty for
    // a given politician (they sit in one chamber), but checking both keeps
    // the endpoint chamber-agnostic at the call site.
    //
    // FMP query strategy: pass lastName only (more unique than firstName in
    // Congress — multiple "Marks" exist, only one "Pelosi"). We then filter
    // server-side on the full name to drop any false positives.
    // Reference: https://site.financialmodelingprep.com/developer/docs/stable/senate-trading-by-name
    //            https://site.financialmodelingprep.com/developer/docs/stable/house-trading-by-name
    const lastName = extractLastName(name);
    const queryName = lastName || name; // Fall back to full name if extraction fails
    const encodedName = encodeURIComponent(queryName);
    const senateUrl =
      `${FMP_SENATE_BY_NAME}?name=${encodedName}` +
      `&page=0&limit=${FMP_PER_CHAMBER_LIMIT}&apikey=${apiKey}`;
    const houseUrl =
      `${FMP_HOUSE_BY_NAME}?name=${encodedName}` +
      `&page=0&limit=${FMP_PER_CHAMBER_LIMIT}&apikey=${apiKey}`;

    // Optional debug logging — set FMP_DEBUG=1 in Vercel env temporarily.
    if (process.env.FMP_DEBUG === '1') {
      // Mask the apikey portion in logs
      const maskUrl = (u) => u.replace(/apikey=[^&]+/, 'apikey=***');
      console.log('[1AM-30] FMP senate URL:', maskUrl(senateUrl));
      console.log('[1AM-30] FMP house URL:', maskUrl(houseUrl));
    }

    const [senateRes, houseRes] = await Promise.allSettled([
      fetch(senateUrl),
      fetch(houseUrl),
    ]);

    // ── Parse responses, tolerate per-chamber failure ───────────────────────
    // If one chamber 200s and the other 404s, we still serve whatever we got.
    // Both failing → escalate to error response (no useful data to return).
    const senateOk =
      senateRes.status === 'fulfilled' && senateRes.value.ok;
    const houseOk =
      houseRes.status === 'fulfilled' && houseRes.value.ok;

    if (!senateOk && !houseOk) {
      const senateStatus =
        senateRes.status === 'fulfilled' ? senateRes.value.status : 'rejected';
      const houseStatus =
        houseRes.status === 'fulfilled' ? houseRes.value.status : 'rejected';
      return new Response(
        JSON.stringify({
          error: 'FMP API error (both chambers failed)',
          name,
          senateStatus,
          houseStatus,
          hint:
            'Verify FMP_API_KEY is valid and the per-politician endpoint URL ' +
            'matches FMP docs. See top of api/trades/by-politician.js.',
        }),
        { status: 502, headers: errHeaders }
      );
    }

    const senateRaw = senateOk ? await senateRes.value.json() : [];
    const houseRaw = houseOk ? await houseRes.value.json() : [];

    // FMP sometimes returns `{ Error: "..." }` instead of an array on free-tier
    // edge cases (e.g. unrecognised endpoint). Treat non-array as empty.
    const senateArr = Array.isArray(senateRaw) ? senateRaw : [];
    const houseArr = Array.isArray(houseRaw) ? houseRaw : [];

    // ── Normalise to internal Trade schema ──────────────────────────────────
    const senateTrades = senateArr.map((raw) =>
      normaliseFMPTrade(raw, CHAMBERS.SENATE)
    );
    const houseTrades = houseArr.map((raw) =>
      normaliseFMPTrade(raw, CHAMBERS.HOUSE)
    );

    // Defensive: filter to trades that actually match the requested politician.
    // FMP's by-name endpoint might return loose matches; we want exact (or at
    // least case-insensitive substring) matches only.
    const lowerName = name.toLowerCase();
    const filtered = [...senateTrades, ...houseTrades].filter((t) =>
      (t.politician || '').toLowerCase().includes(lowerName)
    );

    // Dedupe + sort + cap at limit
    const deduped = deduplicateTrades(filtered);
    const sorted = sortTradesByDate(deduped);
    const trades = sorted.slice(0, limit);

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

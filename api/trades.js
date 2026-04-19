// SAA-11: Vercel Edge Function /api/trades
// Fetches congressional trading data from Financial Modeling Prep (FMP)
// Calls Senate + House endpoints in parallel, normalises to internal schema
// Runs server-side — keeps API key secure, handles CORS
//
// GET /api/trades
// Query params:
//   ticker     (optional) — filter by stock ticker e.g. NVDA
//   politician (optional) — filter by politician name substring
//   limit      (optional) — number of results, default 20

import {
  normaliseFMPTrade,
  deduplicateTrades,
  sortTradesByDate,
  CHAMBERS,
} from '../src/data/schema.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // ── CORS headers ────────────────────────────────────────────────────────────
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker') || '';
    const politician = searchParams.get('politician') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'FMP_API_KEY not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // ── Build FMP URLs ───────────────────────────────────────────────────────
    // Always pull /latest for both chambers; filter ticker client-side below.
    // Simpler than swapping endpoints and fine for MVP (~200 recent trades).
    const base = 'https://financialmodelingprep.com/stable';
    const senateUrl = `${base}/senate-latest?page=0&limit=100&apikey=${apiKey}`;
    const houseUrl = `${base}/house-latest?page=0&limit=100&apikey=${apiKey}`;

    // ── Fetch Senate + House in parallel ─────────────────────────────────────
    const [senateRes, houseRes] = await Promise.all([
      fetch(senateUrl),
      fetch(houseUrl),
    ]);

    // If both failed, return error
    if (!senateRes.ok && !houseRes.ok) {
      const senateText = await senateRes.text();
      const houseText = await houseRes.text();
      return new Response(
        JSON.stringify({
          error: 'FMP API error (both chambers failed)',
          senateStatus: senateRes.status,
          houseStatus: houseRes.status,
          senateDetails: senateText,
          houseDetails: houseText,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    // Parse responses (handle partial failure gracefully)
    const senateData = senateRes.ok ? await senateRes.json() : [];
    const houseData = houseRes.ok ? await houseRes.json() : [];

    // ── Normalise ─────────────────────────────────────────────────────────────
    const senateTrades = (Array.isArray(senateData) ? senateData : []).map(
      (raw) => normaliseFMPTrade(raw, CHAMBERS.SENATE)
    );
    const houseTrades = (Array.isArray(houseData) ? houseData : []).map(
      (raw) => normaliseFMPTrade(raw, CHAMBERS.HOUSE)
    );

    let trades = [...senateTrades, ...houseTrades];

    // ── Filter by ticker ──────────────────────────────────────────────────────
    if (ticker) {
      const t = ticker.toUpperCase();
      trades = trades.filter((trade) => trade.ticker.toUpperCase() === t);
    }

    // ── Filter by politician name ────────────────────────────────────────────
    if (politician) {
      const search = politician.toLowerCase();
      trades = trades.filter((t) =>
        t.politician.toLowerCase().includes(search)
      );
    }

    // ── Deduplicate and sort ─────────────────────────────────────────────────
    trades = deduplicateTrades(trades);
    trades = sortTradesByDate(trades);

    // ── Apply limit ──────────────────────────────────────────────────────────
    trades = trades.slice(0, limit);

    // ── Return response ──────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        trades,
        source: 'fmp',
        count: trades.length,
        filters: { ticker, politician, limit },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

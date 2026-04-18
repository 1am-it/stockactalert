// SAA-11: Vercel Edge Function /api/trades
// Fetches congressional trading data from Finnhub
// Normalises response to internal trade schema
// Runs server-side — keeps API key secure, handles CORS
//
// GET /api/trades
// Query params:
//   ticker     (optional) — filter by stock ticker e.g. NVDA
//   politician (optional) — filter by politician name
//   limit      (optional) — number of results, default 20

import {
  normaliseFinnhubTrade,
  deduplicateTrades,
  sortTradesByDate,
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

    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'FINNHUB_API_KEY not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // ── Fetch from Finnhub ───────────────────────────────────────────────────
    // Finnhub congressional trading endpoint
    // Docs: https://finnhub.io/docs/api/congressional-trading
    const finnhubUrl = new URL(
      'https://finnhub.io/api/v1/stock/congressional-trading'
    );
    finnhubUrl.searchParams.set('token', apiKey);

    // Add symbol filter if ticker provided
    if (ticker) {
      finnhubUrl.searchParams.set('symbol', ticker.toUpperCase());
    }

    const finnhubRes = await fetch(finnhubUrl.toString());

    if (!finnhubRes.ok) {
      const errorText = await finnhubRes.text();
      return new Response(
        JSON.stringify({
          error: 'Finnhub API error',
          status: finnhubRes.status,
          details: errorText,
        }),
        { status: finnhubRes.status, headers: corsHeaders }
      );
    }

    const finnhubData = await finnhubRes.json();

    // ── Normalise response ───────────────────────────────────────────────────
    // Finnhub returns { data: [...trades] }
    const rawTrades = finnhubData?.data || [];

    let trades = rawTrades.map(normaliseFinnhubTrade);

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
        source: 'finnhub',
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

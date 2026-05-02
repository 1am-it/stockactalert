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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

const CACHE_CONTROL_SUCCESS = 'public, s-maxage=3600, stale-while-revalidate=7200';
const CACHE_CONTROL_ERROR = 'no-store';

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

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: baseHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get('ticker') || '').trim();
    const politician = (searchParams.get('politician') || '').trim();
    const since = (searchParams.get('since') || '').trim();
    const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const offsetRaw = parseInt(searchParams.get('offset') || '0', 10);

    const limit = Math.min(
      Math.max(1, isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw),
      MAX_LIMIT
    );
    const offset = Math.max(0, isNaN(offsetRaw) ? 0 : offsetRaw);

    if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      return new Response(
        JSON.stringify({ error: 'Param `since` must be YYYY-MM-DD format' }),
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

    let query = supabase
      .from('filings')
      .select('chamber, raw_data')
      .order('filed_date', { ascending: false });

    if (ticker) {
      query = query.eq('ticker', ticker.toUpperCase());
    }
    if (politician) {
      const escaped = politician.replace(/[%_]/g, '\\$&');
      query = query.ilike('politician_name', `%${escaped}%`);
    }
    if (since) {
      query = query.gte('trade_date', since);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({
          error: 'Archive temporarily unavailable',
          details: error.message,
        }),
        { status: 503, headers: errHeaders }
      );
    }

    const trades = (data || []).map((row) => {
      const frontendChamber = CHAMBER_MAP[row.chamber] || row.chamber;
      return normaliseFMPTrade(row.raw_data, frontendChamber);
    });

    const finalTrades = sortTradesByDate(deduplicateTrades(trades));

    return new Response(
      JSON.stringify({
        trades: finalTrades,
        source: 'fmp',
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

// 1AM-113: shared helpers for seeding and daily cron of the filings archive.
//
// Both scripts/seed-archive.mjs (one-time seed) and scripts/cron-fetch-trades.mjs
// (daily cron) import from this module so FMP-fetch + mapping + Supabase-upsert
// logic lives in exactly one place.
//
// EXPORTS:
//   loadConfig()            - validate + return env vars; exits process on missing
//   getSupabaseClient(cfg)  - construct Supabase client from config
//   fetchChamber(...)       - fetch latest trades for one chamber from FMP
//   mapToRow(raw, chamber)  - transform FMP trade into Supabase row
//   upsertTrades(supa, rows) - bulk insert with dedup; returns insert/skip counts
//   getArchiveCount(supa)   - return total row count in filings table
//
// All functions are pure where possible; Supabase client is passed in explicitly
// so callers control lifecycle.

import { createClient } from '@supabase/supabase-js';
import { findByName } from '../../src/lib/congress.js';

// ── Config ────────────────────────────────────────────────────────────────────

export const FMP_PER_CHAMBER_LIMIT = 25;
export const FMP_BASE = 'https://financialmodelingprep.com/stable';

/**
 * Read + validate required env vars. Exits the process with a clear error
 * message if anything is missing — callers don't need to wrap in try/catch.
 *
 * @returns {{ apiKey: string, supabaseUrl: string, supabaseKey: string }}
 */
export function loadConfig() {
  const apiKey = process.env.FMP_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [];
  if (!apiKey) missing.push('FMP_API_KEY');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    console.error(
      `ERROR: missing required env vars: ${missing.join(', ')}.\n` +
        '  Local: add to .env.local and run with `node --env-file=.env.local ...`\n' +
        '  GitHub Actions: configure as repository secrets.'
    );
    process.exit(1);
  }

  return { apiKey, supabaseUrl, supabaseKey };
}

/**
 * Construct a Supabase client suited for server-side scripts:
 * service_role key, no session persistence.
 */
export function getSupabaseClient({ supabaseUrl, supabaseKey }) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

// ── Amount range parser ──────────────────────────────────────────────────────

/**
 * FMP returns "$50,001 - $100,000" (or similar). We extract numeric low/high
 * for query-friendly storage. Returns nullable values on parse failure so we
 * never drop a trade just because the amount string is unusual.
 */
export function parseAmountRange(amountStr) {
  if (!amountStr || typeof amountStr !== 'string') {
    return { low: null, high: null };
  }

  const cleaned = amountStr.replace(/[$,]/g, '').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(/\s*[–\-—]\s*/);

  if (parts.length === 0) return { low: null, high: null };

  const low = parseInt(parts[0], 10);
  const high = parts.length > 1 ? parseInt(parts[1], 10) : low;

  return {
    low: isNaN(low) ? null : low,
    high: isNaN(high) ? null : high,
  };
}

// ── Resolve bioguideId via findByName cascade ────────────────────────────────

/**
 * Returns null if the name can't be resolved; the row is still inserted with
 * politician_name set, just without bioguide_id. Future enrichment ticket can
 * backfill missing bioguide_ids by re-running findByName.
 */
export function resolveBioguide(rawName) {
  if (!rawName) return null;
  const matches = findByName(rawName);
  if (matches.length === 0) return null;
  return matches[0].bioguideId; // first = highest-confidence (exact > prefix > substring)
}

// ── Fetch from FMP ────────────────────────────────────────────────────────────

/**
 * Fetch latest trades for a single chamber. On HTTP failure, logs a warning
 * and returns an empty array — caller decides whether to treat that as fatal
 * (cron) or continue with what's available (seed).
 *
 * @param {'senate'|'house'} chamber
 * @param {string} apiKey
 * @returns {Promise<{trades: Array, ok: boolean, error?: string}>}
 */
export async function fetchChamber(chamber, apiKey) {
  const endpoint = chamber === 'senate' ? 'senate-latest' : 'house-latest';
  const url = `${FMP_BASE}/${endpoint}?page=0&limit=${FMP_PER_CHAMBER_LIMIT}&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return {
        trades: [],
        ok: false,
        error: `FMP ${chamber} returned HTTP ${res.status}`,
      };
    }
    const data = await res.json();
    return {
      trades: Array.isArray(data) ? data : [],
      ok: true,
    };
  } catch (err) {
    return {
      trades: [],
      ok: false,
      error: `FMP ${chamber} threw: ${err.message}`,
    };
  }
}

// ── Map FMP raw trade → Supabase row ─────────────────────────────────────────

/**
 * Mirror the field-extraction logic from src/data/schema.js normaliseFMPTrade.
 * Output shape matches the public.filings table schema in Supabase.
 */
export function mapToRow(raw, chamber) {
  const firstName = raw.firstName || '';
  const lastName = raw.lastName || '';
  const fullName =
    raw.representative ||
    raw.office ||
    `${firstName} ${lastName}`.trim();

  const ticker = raw.symbol || null;
  const tradeDate = raw.transactionDate || null;
  const filedDate =
    raw.disclosureDate ||
    raw.dateRecieved || // FMP's actual spelling (sic)
    raw.filingDate ||
    null;

  const { low, high } = parseAmountRange(raw.amount || '');
  const bioguideId = resolveBioguide(fullName);

  return {
    politician_name: fullName || 'Unknown',
    bioguide_id: bioguideId,
    chamber, // 'senate' | 'house' (lowercase per DB constraint)
    ticker,
    action: raw.type || null,
    amount_low: low,
    amount_high: high,
    trade_date: tradeDate || null,
    filed_date: filedDate, // not-null in DB; callers should drop rows missing this
    owner: raw.owner || raw.ownerType || raw.owner_type || null,
    raw_data: raw,
  };
}

// ── Upsert into Supabase ──────────────────────────────────────────────────────

/**
 * Bulk insert with dedup. The composite unique index
 * (politician_name, ticker, trade_date, amount_low, amount_high) is what
 * makes this idempotent — re-running with the same data inserts 0 rows.
 *
 * @returns {Promise<{ inserted: number, skipped: number }>}
 * @throws on Supabase error
 */
export async function upsertTrades(supabase, rows) {
  if (rows.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const { data, error } = await supabase
    .from('filings')
    .upsert(rows, {
      onConflict: 'politician_name,ticker,trade_date,amount_low,amount_high',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) {
    throw new Error(`Supabase upsert failed: ${JSON.stringify(error)}`);
  }

  const inserted = data?.length || 0;
  const skipped = rows.length - inserted;
  return { inserted, skipped };
}

// ── Archive count ─────────────────────────────────────────────────────────────

export async function getArchiveCount(supabase) {
  const { count, error } = await supabase
    .from('filings')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Supabase count failed: ${JSON.stringify(error)}`);
  }

  return count;
}

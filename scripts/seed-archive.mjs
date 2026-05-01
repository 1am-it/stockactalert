// 1AM-113: Initial seed of the Supabase filings archive
//
// One-time script. Fetches the current latest Senate + House trades from FMP
// (same call /api/trades makes today) and inserts them into Supabase so the
// archive isn't empty when /api/trades cuts over to reading from Supabase.
//
// Subsequent additions happen via the daily cron (separate script, next ticket
// step). This script and the cron share the same insert logic but live as
// separate entry points so the seed can be re-run safely without changing
// cron schedule.
//
// Idempotent by design: if the script runs twice, the composite unique index
// on (politician_name, ticker, trade_date, amount_low, amount_high) blocks
// duplicates at the database level. We use upsert with ignoreDuplicates:true
// so re-runs are safe and report meaningful counts.
//
// USAGE:
//   node --env-file=.env.local scripts/seed-archive.mjs
//
//   Required env vars:
//     FMP_API_KEY                  — same as production
//     SUPABASE_URL                 — https://<project-id>.supabase.co
//     SUPABASE_SERVICE_ROLE_KEY    — service_role key (NOT anon)
//
// EXPECTED OUTPUT:
//   Fetched 25 senate + 25 house trades from FMP (50 total)
//   Mapped 50 trades to Supabase rows
//   Inserted: 50 new, 0 skipped (duplicates)
//
// SAFETY:
//   This script ONLY inserts. It never updates, deletes, or truncates.
//   Running it twice produces 0 new rows the second time.

import { createClient } from '@supabase/supabase-js';
import { findByName } from '../src/lib/congress.js';

// ── Config ───────────────────────────────────────────────────────────────────
const FMP_PER_CHAMBER_LIMIT = 25;
const FMP_BASE = 'https://financialmodelingprep.com/stable';

const apiKey = process.env.FMP_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!apiKey) {
  console.error('ERROR: FMP_API_KEY missing in env. Add it to .env.local.');
  process.exit(1);
}
if (!supabaseUrl) {
  console.error('ERROR: SUPABASE_URL missing in env. Add it to .env.local.');
  process.exit(1);
}
if (!supabaseKey) {
  console.error(
    'ERROR: SUPABASE_SERVICE_ROLE_KEY missing in env. Add it to .env.local.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ── Amount range parser ──────────────────────────────────────────────────────
// FMP returns "$50,001 - $100,000" (or similar). We extract numeric low/high
// for query-friendly storage. Stays nullable on parse failure so we never
// drop a trade just because the amount string is unusual.
function parseAmountRange(amountStr) {
  if (!amountStr || typeof amountStr !== 'string') {
    return { low: null, high: null };
  }

  // Strip "$" and "," from numeric tokens, then split on any dash variant
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
// Returns null if the name can't be resolved; the row is still inserted with
// politician_name set, just without bioguide_id. Future enrichment ticket can
// backfill missing bioguide_ids by re-running findByName.
function resolveBioguide(rawName) {
  if (!rawName) return null;
  const matches = findByName(rawName);
  if (matches.length === 0) return null;
  return matches[0].bioguideId; // first = highest-confidence (exact > prefix > substring)
}

// ── Fetch + map FMP trades ───────────────────────────────────────────────────
async function fetchChamber(chamber) {
  const endpoint = chamber === 'senate' ? 'senate-latest' : 'house-latest';
  const url = `${FMP_BASE}/${endpoint}?page=0&limit=${FMP_PER_CHAMBER_LIMIT}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(
      `WARNING: FMP ${chamber} returned ${res.status}. Continuing with empty list.`
    );
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function mapToRow(raw, chamber) {
  // Mirror the field-extraction logic from src/data/schema.js normaliseFMPTrade
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
    filed_date: filedDate, // not-null in DB; we drop rows without this below
    owner: raw.owner || raw.ownerType || raw.owner_type || null,
    raw_data: raw,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('1AM-113: seeding Supabase filings archive from FMP latest\n');

  // Fetch both chambers in parallel
  console.log('Fetching FMP senate-latest + house-latest...');
  const [senateRaw, houseRaw] = await Promise.all([
    fetchChamber('senate'),
    fetchChamber('house'),
  ]);
  console.log(
    `Fetched ${senateRaw.length} senate + ${houseRaw.length} house trades from FMP (${senateRaw.length + houseRaw.length} total)`
  );

  // Map to DB rows
  const senateRows = senateRaw.map((r) => mapToRow(r, 'senate'));
  const houseRows = houseRaw.map((r) => mapToRow(r, 'house'));
  let allRows = [...senateRows, ...houseRows];

  // Drop rows missing the not-null filed_date (very rare; safety net)
  const beforeDrop = allRows.length;
  allRows = allRows.filter((r) => r.filed_date);
  const dropped = beforeDrop - allRows.length;
  if (dropped > 0) {
    console.log(`Dropped ${dropped} rows with missing filed_date`);
  }

  // Diagnostic counts
  const withBioguide = allRows.filter((r) => r.bioguide_id).length;
  const withoutBioguide = allRows.length - withBioguide;
  console.log(
    `Mapped ${allRows.length} trades to Supabase rows (${withBioguide} with bioguide_id, ${withoutBioguide} without)`
  );

  if (allRows.length === 0) {
    console.log('No rows to insert. Exiting.');
    return;
  }

  // Insert with upsert + ignoreDuplicates
  // The composite unique index (politician_name, ticker, trade_date,
  // amount_low, amount_high) is what makes this idempotent.
  console.log('\nInserting into Supabase...');
  const { data, error } = await supabase
    .from('filings')
    .upsert(allRows, {
      onConflict: 'politician_name,ticker,trade_date,amount_low,amount_high',
      ignoreDuplicates: true,
    })
    .select('id');

  if (error) {
    console.error('Supabase upsert error:', error);
    process.exit(1);
  }

  const inserted = data?.length || 0;
  const skipped = allRows.length - inserted;
  console.log(
    `Inserted: ${inserted} new, ${skipped} skipped (duplicates already in archive)`
  );

  // Final sanity: total row count in archive
  const { count } = await supabase
    .from('filings')
    .select('*', { count: 'exact', head: true });
  console.log(`\nArchive now contains ${count} total rows.`);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

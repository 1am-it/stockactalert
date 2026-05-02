// 1AM-113: Initial seed of the Supabase filings archive.
//
// One-time script. Fetches the current latest Senate + House trades from FMP
// (same call /api/trades makes today) and inserts them into Supabase so the
// archive isn't empty when /api/trades cuts over to reading from Supabase.
//
// Idempotent: re-running with the same data inserts 0 rows thanks to the
// composite unique index on (politician_name, ticker, trade_date, amount_low,
// amount_high).
//
// USAGE:
//   node --env-file=.env.local scripts/seed-archive.mjs
//
//   Required env vars:
//     FMP_API_KEY                  — same as production
//     SUPABASE_URL                 — https://<project-id>.supabase.co
//     SUPABASE_SERVICE_ROLE_KEY    — service_role key (NOT anon)
//
// SAFETY: this script ONLY inserts. It never updates, deletes, or truncates.

import {
  loadConfig,
  getSupabaseClient,
  fetchChamber,
  mapToRow,
  upsertTrades,
  getArchiveCount,
} from './lib/archive-helpers.mjs';

async function main() {
  console.log('1AM-113: seeding Supabase filings archive from FMP latest\n');

  const config = loadConfig();
  const supabase = getSupabaseClient(config);

  // Fetch both chambers in parallel
  console.log('Fetching FMP senate-latest + house-latest...');
  const [senateResult, houseResult] = await Promise.all([
    fetchChamber('senate', config.apiKey),
    fetchChamber('house', config.apiKey),
  ]);

  if (!senateResult.ok) console.warn(`WARNING: ${senateResult.error}`);
  if (!houseResult.ok) console.warn(`WARNING: ${houseResult.error}`);

  console.log(
    `Fetched ${senateResult.trades.length} senate + ${houseResult.trades.length} house trades from FMP (${senateResult.trades.length + houseResult.trades.length} total)`
  );

  // Map to DB rows
  const senateRows = senateResult.trades.map((r) => mapToRow(r, 'senate'));
  const houseRows = houseResult.trades.map((r) => mapToRow(r, 'house'));
  let allRows = [...senateRows, ...houseRows];

  // Drop rows missing the not-null filed_date (rare; safety net)
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

  // Upsert with dedup
  console.log('\nInserting into Supabase...');
  const { inserted, skipped } = await upsertTrades(supabase, allRows);
  console.log(
    `Inserted: ${inserted} new, ${skipped} skipped (duplicates already in archive)`
  );

  // Final sanity: total row count
  const total = await getArchiveCount(supabase);
  console.log(`\nArchive now contains ${total} total rows.`);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

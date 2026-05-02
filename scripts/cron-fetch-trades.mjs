// 1AM-113: daily cron — fetch latest congressional trades from FMP and append
// to Supabase archive.
//
// Designed for GitHub Actions. Logs are timestamped and structured so the
// Actions runner output is readable. Exit codes signal success/failure to the
// runner so failed runs are visible in the Actions UI.
//
// EXIT CODES:
//   0 — success (or partial success: one chamber failed but the other worked)
//   1 — total failure: both chambers failed, or Supabase write failed
//
// The "partial success" path is intentional: if the Senate endpoint flakes
// for one day, we still want House trades archived. We re-fetch missing data
// the next day automatically (dedup makes re-runs free).
//
// USAGE:
//   node --env-file=.env.local scripts/cron-fetch-trades.mjs   (local test)
//   node scripts/cron-fetch-trades.mjs                          (GitHub Actions, env from secrets)
//
// SCHEDULE: daily 06:00 UTC (~02:00 ET, ~08:00 NL) via .github/workflows/refresh-archive.yml

import {
  loadConfig,
  getSupabaseClient,
  fetchChamber,
  mapToRow,
  upsertTrades,
  getArchiveCount,
} from './lib/archive-helpers.mjs';

// ── Structured logging ───────────────────────────────────────────────────────
// Prefix every line with ISO timestamp so GitHub Actions output is correlatable
// across multiple runs when grepping logs.

function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  if (level === 'ERROR' || level === 'WARN') {
    console.error(line);
  } else {
    console.log(line);
  }
}

const info = (msg) => log('INFO', msg);
const warn = (msg) => log('WARN', msg);
const error = (msg) => log('ERROR', msg);

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  info('1AM-113 cron: starting daily archive refresh');

  const config = loadConfig();
  const supabase = getSupabaseClient(config);

  // Fetch both chambers in parallel — partial success is acceptable
  info('Fetching FMP senate-latest + house-latest in parallel...');
  const [senateResult, houseResult] = await Promise.all([
    fetchChamber('senate', config.apiKey),
    fetchChamber('house', config.apiKey),
  ]);

  // Track per-chamber success for exit-code decision
  const senateOk = senateResult.ok;
  const houseOk = houseResult.ok;

  if (!senateOk) warn(senateResult.error);
  if (!houseOk) warn(houseResult.error);

  // Total failure: both chambers down. Don't write anything; signal failure.
  if (!senateOk && !houseOk) {
    error('Both FMP chambers failed; no data fetched. Exiting with code 1.');
    process.exit(1);
  }

  info(
    `Fetched ${senateResult.trades.length} senate + ${houseResult.trades.length} house trades`
  );

  // Map to rows
  const senateRows = senateResult.trades.map((r) => mapToRow(r, 'senate'));
  const houseRows = houseResult.trades.map((r) => mapToRow(r, 'house'));
  let allRows = [...senateRows, ...houseRows];

  // Drop rows missing required filed_date
  const beforeDrop = allRows.length;
  allRows = allRows.filter((r) => r.filed_date);
  const dropped = beforeDrop - allRows.length;
  if (dropped > 0) {
    warn(`Dropped ${dropped} rows with missing filed_date`);
  }

  if (allRows.length === 0) {
    info('No rows to insert (FMP returned empty). Exiting with code 0.');
    return;
  }

  const withBioguide = allRows.filter((r) => r.bioguide_id).length;
  const withoutBioguide = allRows.length - withBioguide;
  info(
    `Mapped ${allRows.length} rows (${withBioguide} with bioguide_id, ${withoutBioguide} without)`
  );

  // Upsert
  let upsertResult;
  try {
    upsertResult = await upsertTrades(supabase, allRows);
  } catch (err) {
    error(`Supabase write failed: ${err.message}`);
    process.exit(1);
  }

  info(
    `Upsert: ${upsertResult.inserted} new, ${upsertResult.skipped} skipped (duplicates)`
  );

  // Final state
  let total;
  try {
    total = await getArchiveCount(supabase);
    info(`Archive now contains ${total} total rows`);
  } catch (err) {
    // Non-fatal: write succeeded, count failed. Log + exit 0.
    warn(`Could not read final archive count: ${err.message}`);
  }

  // Partial-success signal in logs (still exits 0)
  if (!senateOk || !houseOk) {
    warn(
      `Partial success: ${!senateOk ? 'senate' : 'house'} chamber failed but ${
        senateOk ? 'senate' : 'house'
      } succeeded. Will retry next run.`
    );
  }

  info('Cron completed successfully');
}

main().catch((err) => {
  error(`Unhandled error: ${err.stack || err.message || err}`);
  process.exit(1);
});

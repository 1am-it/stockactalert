#!/usr/bin/env node
// scripts/query-top-tickers.mjs — 1AM-37 phase 0
//
// One-shot query against Supabase `filings` to determine the top-200 most-
// traded tickers in the past 12 months. Output is committed as
// scripts/top-tickers.json so phase 1 (FMP profile fetch) is reproducible.
//
// Run periodically (every few months) when the sectors.json refresh comes
// up in maintenance.
//
// Usage:
//   npm run query:top-tickers
// or:
//   node --env-file=.env.local scripts/query-top-tickers.mjs
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// 12-month window per design decision (1AM-37 phase 0). Anything wider drags
// in stale bulk-disclosure spikes (Pelosi 2021 NVDA-spam etc.) and skews the
// top-N toward old archive trades. 12m is the maturity window where the mix
// reflects current trading patterns.
const WINDOW_MONTHS = 12;
const TOP_N = 200;

// Match leading 1-5 alpha chars to strip option-chain symbols. Examples:
//   NVDA250117C00150000 → NVDA  (option contract)
//   BRK.B               → BRK   (class-suffix; we drop the .B for grouping)
//   ABCDE               → ABCDE (regular ticker, unchanged)
// Tickers under 1 char or non-alpha are dropped — they're either bad data
// or non-equity instruments we don't care about.
function stripToUnderlying(rawTicker) {
  if (!rawTicker || typeof rawTicker !== 'string') return null;
  const match = rawTicker.trim().toUpperCase().match(/^([A-Z]{1,5})/);
  return match ? match[1] : null;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'ERROR: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
        '  Run with: node --env-file=.env.local scripts/query-top-tickers.mjs'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - WINDOW_MONTHS);
  const sinceISO = sinceDate.toISOString().slice(0, 10);

  console.log(`Querying filings since ${sinceISO} (${WINDOW_MONTHS}-month window)…`);

  // Pull all (ticker, filed_date) tuples in the window. We don't aggregate in
  // SQL because we need to strip option-chains client-side first — Supabase
  // PostgREST doesn't expose a regex-substring expression we can group by.
  // 50k filings/year × 1y = 50k rows max, well within JSON-payload limits.
  // Use range pagination since PostgREST caps at 1000 rows per request.
  const PAGE_SIZE = 1000;
  let allRows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('filings')
      .select('ticker')
      .gte('filed_date', sinceISO)
      .not('ticker', 'is', null)
      .neq('ticker', '')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Supabase query failed:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Fetched ${allRows.length} filings.`);

  // Aggregate underlying tickers
  const counts = new Map();
  let stripped = 0;
  for (const row of allRows) {
    const underlying = stripToUnderlying(row.ticker);
    if (!underlying) {
      stripped += 1;
      continue;
    }
    counts.set(underlying, (counts.get(underlying) || 0) + 1);
  }

  if (stripped > 0) {
    console.log(`Skipped ${stripped} rows with unparseable tickers.`);
  }

  // Sort by count desc, alphabetic tiebreak for determinism
  const ranked = Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, TOP_N);

  // Two outputs: array of strings (consumed by fetch-sectors.mjs), and a
  // detailed report for human review (counts visible).
  const tickersOnly = ranked.map(([t]) => t);
  const detailed = ranked.map(([ticker, count]) => ({ ticker, count }));

  const outPath = join(REPO_ROOT, 'scripts', 'top-tickers.json');
  const reportPath = join(REPO_ROOT, 'scripts', 'top-tickers.report.json');

  writeFileSync(outPath, JSON.stringify(tickersOnly, null, 2) + '\n');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        windowMonths: WINDOW_MONTHS,
        sinceDate: sinceISO,
        totalFilings: allRows.length,
        uniqueUnderlyings: counts.size,
        topN: TOP_N,
        tickers: detailed,
      },
      null,
      2
    ) + '\n'
  );

  console.log(`\nWrote ${TOP_N} tickers to:`);
  console.log(`  ${outPath}`);
  console.log(`  ${reportPath} (with counts for review)`);
  console.log(`\nTop 10:`);
  for (const { ticker, count } of detailed.slice(0, 10)) {
    console.log(`  ${ticker.padEnd(8)} ${count}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

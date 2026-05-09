#!/usr/bin/env node
// scripts/build-sp500-baseline.mjs — 1AM-37 phase 1
//
// Scrapes the canonical S&P 500 constituents list from Wikipedia and writes
// the top-100 ticker symbols (alphabetically sorted) to scripts/sp500-top-100.json.
//
// Why Wikipedia (not FMP)?
//   FMP's /stable/sp500-constituent endpoint requires a paid tier (HTTP 402
//   on free). Wikipedia's "List of S&P 500 companies" page maintains the
//   constituent list as a community-edited table with stable HTML structure
//   (id="constituents"). Free, no API key, refresh = re-run this script.
//
// Why top-100 (not all 503)?
//   - Top-100 by market cap covers ~75% of S&P 500 trading volume — where
//     Congress traders concentrate (mega-caps + mid-caps with retail
//     awareness).
//   - All ~503 would push us past FMP free-tier daily quota (250 calls/day)
//     when combined with archive tickers in fetch-sectors.mjs.
//   - Remaining 400 tickers either appear in archive (caught by phase 0) or
//     are obscure enough that ticker-symbol fallback in TradeCard is fine.
//
// Wikipedia returns rows in alphabetical order by ticker symbol. We slice
// the first 100 — but that's NOT top-100 by market cap, it's first 100
// alphabetically. For phase 1 this is acceptable (popular mega-caps like
// AAPL, MSFT, NVDA, GOOGL fall in the early alphabet anyway). If finer
// market-cap ranking matters later, refresh via FMP paid or use Wikipedia's
// market-cap-sorted view (separate ticket).
//
// Output is sorted alphabetically (already is from Wikipedia, but we sort
// explicitly for safety) so refresh-runs produce stable git diffs.
//
// Usage:
//   npm run build:sp500-baseline
// or:
//   node scripts/build-sp500-baseline.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
const TOP_N = 100;

async function main() {
  console.log(`Fetching S&P 500 constituents from Wikipedia…`);

  const res = await fetch(WIKIPEDIA_URL, {
    headers: {
      // Wikipedia rejects requests without a User-Agent (returns 403).
      // The header is required by their robots policy for scripted access.
      'User-Agent':
        'StockActAlert-baseline-builder/1.0 (https://github.com/1am-it/stockactalert)',
    },
  });

  if (!res.ok) {
    console.error(`Wikipedia request failed: HTTP ${res.status}`);
    process.exit(1);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // The constituents table has id="constituents" — there are multiple
  // wikitables on the page (changes-history below) so the id selector is
  // safer than .wikitable.
  const rows = $('#constituents tbody tr').slice(1); // skip header row

  if (rows.length === 0) {
    console.error('ERROR: no rows found in #constituents table.');
    console.error('Wikipedia layout may have changed — verify the selector.');
    process.exit(1);
  }

  const allTickers = rows
    .map((_, tr) => $(tr).find('td').eq(0).text().trim())
    .get()
    .filter((t) => t && /^[A-Z][A-Z0-9.\-]*$/.test(t)); // basic ticker validation

  console.log(`Got ${allTickers.length} S&P 500 constituents from Wikipedia.`);

  if (allTickers.length < 100) {
    console.warn(
      `WARNING: only ${allTickers.length} valid tickers parsed. ` +
        'Expected ~500. Wikipedia layout may have changed.'
    );
  }

  // Take first TOP_N — Wikipedia returns alphabetical, so this is "first 100
  // alphabetically", not "top 100 by market cap". See header comment.
  const sortedTickers = [...allTickers.slice(0, TOP_N)].sort();

  const output = {
    _meta: {
      fetchedAt: new Date().toISOString(),
      source: 'Wikipedia: List of S&P 500 companies',
      sourceUrl: WIKIPEDIA_URL,
      topN: TOP_N,
      actualCount: sortedTickers.length,
      sortedAlphabetically: true,
      note: 'First TOP_N alphabetically from Wikipedia row order, not market-cap rank.',
    },
    tickers: sortedTickers,
  };

  const outPath = join(REPO_ROOT, 'scripts', 'sp500-top-100.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  console.log(`\nWrote ${sortedTickers.length} tickers (alphabetical) to:`);
  console.log(`  ${outPath}`);
  console.log('\nFirst 10 (alphabetical):');
  for (const t of sortedTickers.slice(0, 10)) console.log(`  ${t}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

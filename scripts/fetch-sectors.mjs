#!/usr/bin/env node
// scripts/fetch-sectors.mjs — 1AM-37 phase 1
//
// Reads scripts/top-tickers.json (archive-derived) and scripts/sp500-top-100.json
// (S&P 500 baseline), merges with dedup, hits FMP /stable/profile per unique
// ticker, writes sector + companyName to src/data/sectors.json.
//
// Idempotent + resumable: re-running picks up where it left off — already-
// fetched tickers are skipped unless --force is passed. This matters because
// FMP free-tier caps at 250 calls/day, so a crash at ticker #140 shouldn't
// require re-running #1-139.
//
// Tier-aware rate limiting:
//   FMP_TIER=free (default) → 350ms between calls (≈ 170/min, well under
//                             free's 250/day with margin)
//   FMP_TIER=paid           → no sleep (300/min limit, fetch-loop is slower
//                             than that anyway)
// Detected automatically on 429 responses too — switches to backoff if FMP
// rate-limits the script mid-run.
//
// Usage:
//   npm run fetch:sectors                  # resume mode (skip already-fetched)
//   npm run fetch:sectors -- --force       # re-fetch everything
//   FMP_TIER=paid npm run fetch:sectors    # no rate-limit sleep
//
// Logs to stdout: archive: N, baseline: M, overlap: K, total: T (per design
// decision in 1AM-37 phase 1).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const FMP_BASE = 'https://financialmodelingprep.com/stable';
const TOP_TICKERS_PATH = join(REPO_ROOT, 'scripts', 'top-tickers.json');
const SP500_PATH = join(REPO_ROOT, 'scripts', 'sp500-top-100.json');
const SECTORS_OUT = join(REPO_ROOT, 'src', 'data', 'sectors.json');

const FREE_TIER_SLEEP_MS = 350;
const RATE_LIMIT_BACKOFF_MS = 60_000; // wait 1min on 429

// 1AM-37 phase 1 (per design decision): normalise FMP sector strings to
// short-form GICS-like labels used on chips. FMP mixes formal GICS names
// ("Information Technology") with their own shorthand ("Technology") across
// endpoints. Without normalisation, the same logical sector renders as two
// distinct chips in Browse filter UI — user-visible bug.
//
// 10-entry mapping covers every observed FMP variant. Unmapped sectors pass
// through unchanged (forward-compat: if FMP adds a new sector label we don't
// silently drop it).
const SECTOR_ALIAS_MAP = {
  'Information Technology': 'Technology',
  'Health Care': 'Healthcare',
  'Communication Services': 'Communication Services', // already short
  'Consumer Cyclical': 'Consumer Discretionary',
  'Consumer Defensive': 'Consumer Staples',
  'Financial Services': 'Financials',
  'Basic Materials': 'Materials',
  'Industrials': 'Industrials',
  'Real Estate': 'Real Estate',
  'Energy': 'Energy',
  'Utilities': 'Utilities',
};

function normaliseSector(rawSector) {
  if (!rawSector || typeof rawSector !== 'string') return '';
  const trimmed = rawSector.trim();
  return SECTOR_ALIAS_MAP[trimmed] || trimmed;
}

function loadJson(path) {
  if (!existsSync(path)) {
    console.error(`Required file not found: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadExistingSectors() {
  if (!existsSync(SECTORS_OUT)) return {};
  try {
    const parsed = JSON.parse(readFileSync(SECTORS_OUT, 'utf8'));
    return parsed.tickers || {};
  } catch (err) {
    console.warn(`Could not parse existing sectors.json (${err.message}); starting fresh.`);
    return {};
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchProfile(ticker, apiKey) {
  const url = `${FMP_BASE}/profile?symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
  const res = await fetch(url);

  if (res.status === 429) {
    return { rateLimited: true };
  }
  if (!res.ok) {
    return { error: `HTTP ${res.status}` };
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    return { miss: true };
  }

  const entry = data[0];
  return {
    sector: normaliseSector(entry.sector || ''),
    companyName: (entry.companyName || '').trim(),
  };
}

async function main() {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    console.error(
      'ERROR: missing FMP_API_KEY.\n' +
        '  Run with: node --env-file=.env.local scripts/fetch-sectors.mjs'
    );
    process.exit(1);
  }

  const force = process.argv.includes('--force');
  const tier = (process.env.FMP_TIER || 'free').toLowerCase();
  const sleepMs = tier === 'paid' ? 0 : FREE_TIER_SLEEP_MS;

  console.log(`Tier: ${tier} (sleep ${sleepMs}ms between calls)`);
  console.log(`Force re-fetch: ${force}`);

  // ── Merge inputs with dedup ──────────────────────────────────────────────
  const archiveData = loadJson(TOP_TICKERS_PATH);
  const sp500Data = loadJson(SP500_PATH);

  // archiveData is array; sp500Data has _meta + tickers
  const archiveSet = new Set(archiveData);
  const baselineSet = new Set(sp500Data.tickers || []);

  const overlap = new Set();
  for (const t of archiveSet) {
    if (baselineSet.has(t)) overlap.add(t);
  }

  const merged = new Set([...archiveSet, ...baselineSet]);
  const sortedMerged = Array.from(merged).sort();

  console.log(`\nArchive: ${archiveSet.size}`);
  console.log(`Baseline: ${baselineSet.size}`);
  console.log(`Overlap: ${overlap.size}`);
  console.log(`Total unique: ${sortedMerged.size}`);

  // ── Resume mode: skip already-fetched ────────────────────────────────────
  const existing = force ? {} : loadExistingSectors();
  const toFetch = sortedMerged.filter((t) => !existing[t]);
  const skipped = sortedMerged.length - toFetch.length;

  if (skipped > 0) {
    console.log(`\nResume mode: ${skipped} already in sectors.json, skipping. ${toFetch.length} to fetch.`);
  } else {
    console.log(`\nFetching ${toFetch.length} tickers from FMP…\n`);
  }

  // ── Fetch loop ───────────────────────────────────────────────────────────
  const results = { ...existing };
  const misses = [];
  const errors = [];
  let currentSleep = sleepMs;

  for (let i = 0; i < toFetch.length; i++) {
    const ticker = toFetch[i];
    const progress = `[${i + 1}/${toFetch.length}]`.padEnd(10);

    let attempt = 0;
    let result;
    while (attempt < 3) {
      result = await fetchProfile(ticker, apiKey);
      if (result.rateLimited) {
        console.warn(`${progress} ${ticker}: rate-limited, backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s…`);
        await sleep(RATE_LIMIT_BACKOFF_MS);
        // Promote sleep duration if we hit limits at "free"
        if (currentSleep < FREE_TIER_SLEEP_MS) currentSleep = FREE_TIER_SLEEP_MS;
        attempt += 1;
        continue;
      }
      break;
    }

    if (result.error) {
      console.warn(`${progress} ${ticker}: ${result.error}`);
      errors.push({ ticker, error: result.error });
    } else if (result.miss) {
      console.log(`${progress} ${ticker}: no FMP data (skipped)`);
      misses.push(ticker);
    } else {
      results[ticker] = {
        sector: result.sector,
        companyName: result.companyName,
      };
      console.log(`${progress} ${ticker}: ${result.sector || '(no sector)'} · ${result.companyName || '(no name)'}`);
    }

    // Persist after each successful fetch so a crash mid-run is safe
    if (results[ticker]) {
      writeOutput(results);
    }

    if (currentSleep > 0 && i < toFetch.length - 1) {
      await sleep(currentSleep);
    }
  }

  // ── Final write + summary ────────────────────────────────────────────────
  writeOutput(results);

  console.log(`\n──── Summary ────`);
  console.log(`Tickers in sectors.json: ${Object.keys(results).length}`);
  console.log(`Misses (no FMP data): ${misses.length}`);
  if (misses.length > 0) console.error('  Misses:', misses.join(', '));
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`  ${e.ticker}: ${e.error}`);
  }
}

function writeOutput(tickers) {
  // Ensure deterministic key order for stable git diffs
  const sortedKeys = Object.keys(tickers).sort();
  const sortedTickers = {};
  for (const k of sortedKeys) sortedTickers[k] = tickers[k];

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: 'FMP /stable/profile',
      tickerCount: sortedKeys.length,
      sectorAliases: 'See SECTOR_ALIAS_MAP in scripts/fetch-sectors.mjs',
    },
    tickers: sortedTickers,
  };

  // Make sure output dir exists
  mkdirSync(dirname(SECTORS_OUT), { recursive: true });
  writeFileSync(SECTORS_OUT, JSON.stringify(output, null, 2) + '\n');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

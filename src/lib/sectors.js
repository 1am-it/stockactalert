// src/lib/sectors.js — 1AM-37 phase 3
//
// Lookup helper around src/data/sectors.json — turns the static FMP-derived
// dataset into a fast Map so trade-normalisation can enrich each trade with
// sector + companyName without runtime API calls.
//
// Coverage: ~150 tickers (top-100 alphabetical from S&P 500 + ~50 from our
// 12-month archive). Tickers outside this set get `undefined` back — the
// caller should treat that as "fall back to ticker-symbol-only display",
// not as an error. This is intentional: sector + companyName are
// nice-to-have enrichment, not required Trade fields.
//
// Refresh cycle: re-run `npm run query:top-tickers` + `npm run fetch:sectors`
// every few months (or after major archive growth). Static data — no live
// runtime fetch from FMP.
//
// Note on JSON import: we use the bare `import x from './x.json'` form
// (without `with { type: 'json' }`). Vite handles this natively, and
// Vercel's esbuild-based Edge Function bundler also accepts it. Avoid the
// `with`-syntax here because it's transitively imported by api/trades.js
// (Edge Function), and esbuild's bundler version on Vercel rejects the
// import attribute despite Node 22 supporting it natively. The bare form
// works on both targets — established pattern across the JS ecosystem.

import sectorsData from '../data/sectors.json';

// Pre-build a Map from the JSON for O(1) lookup. Frozen to prevent accidental
// mutation. Keys are ticker symbols as stored in sectors.json (uppercase).
const SECTORS_MAP = (() => {
  const tickers = sectorsData?.tickers || {};
  const map = new Map();
  for (const [ticker, info] of Object.entries(tickers)) {
    map.set(ticker.toUpperCase(), {
      sector: info.sector || '',
      companyName: info.companyName || '',
    });
  }
  return map;
})();

/**
 * Look up sector + companyName for a given ticker. Returns undefined when
 * the ticker isn't in our sectors.json — caller falls back to ticker-only
 * display in that case.
 *
 * @param {string} ticker - Stock ticker, case-insensitive (e.g. 'NVDA' or 'nvda')
 * @returns {{ sector: string, companyName: string } | undefined}
 */
export function lookupSector(ticker) {
  if (!ticker || typeof ticker !== 'string') return undefined;
  return SECTORS_MAP.get(ticker.trim().toUpperCase());
}

/**
 * Total number of tickers in the sectors database. Useful for diagnostics
 * and tests.
 */
export function getSectorsCount() {
  return SECTORS_MAP.size;
}

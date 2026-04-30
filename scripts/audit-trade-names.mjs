// 1AM-109: Audit trade-data politicus names against the Congress directory
//
// Fetches recent trades and runs findByName for each unique politicus name,
// then writes a structured report to unmatched-trades.json at the repo root.
//
// Two fetch modes (auto-selected, or set AUDIT_MODE explicitly):
//
//   1. via-api  — fetch from {AUDIT_BASE_URL}/api/trades?limit=N
//                 reflects exactly what users see; recommended for prod audits
//                 needs deployment-protection OFF or a session cookie
//
//   2. direct-fmp — call FMP /stable/senate-latest + /stable/house-latest
//                   directly. Works without a running deployment but requires
//                   FMP_API_KEY in env. Reuses the same schema normaliser as
//                   the live API so output matches.
//
// USAGE:
//   node scripts/audit-trade-names.mjs                                          # try via-api first, fall back to direct-fmp
//   AUDIT_MODE=via-api AUDIT_BASE_URL=http://localhost:3000 node scripts/audit-trade-names.mjs
//   AUDIT_MODE=direct-fmp FMP_API_KEY=... node scripts/audit-trade-names.mjs
//   AUDIT_LIMIT=200 node scripts/audit-trade-names.mjs
//
// OUTPUT FILE:
//   unmatched-trades.json — per-name report of unmatched / matched counts,
//   plus a sample tradeId per unmatched name for debugging.
//
// NEXT STEPS WHEN AN UNMATCHED NAME IS FOUND:
//   1. Look up the canonical bioguideId in src/data/congress.json
//   2. Add an entry to src/data/name-overrides.json under "_overrides"
//   3. Re-run this script — name should disappear from "unmatched"
//
// SCOPE NOTE:
//   The script reads only — does NOT mutate name-overrides.json. Manual
//   curation only, by design (1AM-109). Auto-resolving via fuzzy matching is
//   explicitly out-of-scope to avoid false-positive aliases.

import { writeFile } from 'node:fs/promises';
import { findByName } from '../src/lib/congress.js';
import { normaliseFMPTrade } from '../src/data/schema.js';

const MODE = process.env.AUDIT_MODE ?? 'auto';
const BASE_URL = process.env.AUDIT_BASE_URL ?? 'https://stockactalert.vercel.app';
const LIMIT = Number(process.env.AUDIT_LIMIT ?? 50);
const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_PER_CHAMBER = Math.min(25, Math.ceil(LIMIT / 2)); // FMP free-tier max
const OUTPUT_PATH = new URL('../unmatched-trades.json', import.meta.url);

// ── Fetch strategies ─────────────────────────────────────────────────────────

async function fetchViaApi() {
  console.log(`[audit] mode: via-api → ${BASE_URL}/api/trades?limit=${LIMIT}`);
  const res = await fetch(`${BASE_URL}/api/trades?limit=${LIMIT}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} from ${BASE_URL}/api/trades`);
  }
  const json = await res.json();
  return json.trades ?? [];
}

async function fetchDirectFromFMP() {
  if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY env var is required for direct-fmp mode');
  }
  console.log(`[audit] mode: direct-fmp → senate-latest + house-latest (${FMP_PER_CHAMBER} each)`);

  const endpoints = [
    `https://financialmodelingprep.com/stable/senate-latest?limit=${FMP_PER_CHAMBER}&apikey=${FMP_API_KEY}`,
    `https://financialmodelingprep.com/stable/house-latest?limit=${FMP_PER_CHAMBER}&apikey=${FMP_API_KEY}`,
  ];

  const responses = await Promise.all(endpoints.map((url) => fetch(url)));
  for (const res of responses) {
    if (!res.ok) {
      throw new Error(`FMP HTTP ${res.status} ${res.statusText}`);
    }
  }

  const [senate, house] = await Promise.all(responses.map((r) => r.json()));
  const rawCombined = [
    ...(Array.isArray(senate) ? senate.map((t) => ({ ...t, _chamber: 'Senate' })) : []),
    ...(Array.isArray(house) ? house.map((t) => ({ ...t, _chamber: 'House' })) : []),
  ];
  return rawCombined.map(normaliseFMPTrade).filter(Boolean);
}

// ── Strategy selection ───────────────────────────────────────────────────────

let trades;
try {
  if (MODE === 'via-api') {
    trades = await fetchViaApi();
  } else if (MODE === 'direct-fmp') {
    trades = await fetchDirectFromFMP();
  } else {
    // auto: try via-api, fall back to direct-fmp on failure
    try {
      trades = await fetchViaApi();
    } catch (err) {
      console.warn(`[audit] via-api failed: ${err.message}`);
      console.warn(`[audit] falling back to direct-fmp ...`);
      trades = await fetchDirectFromFMP();
    }
  }
} catch (err) {
  console.error(`[audit] fetch failed: ${err.message}`);
  console.error('');
  console.error('Hints:');
  console.error('  - Production URL auth-blocked? Disable deployment protection or use direct-fmp');
  console.error('  - direct-fmp needs FMP_API_KEY in env (check .env.local)');
  console.error('  - Run "vercel dev" and set AUDIT_BASE_URL=http://localhost:3000');
  process.exit(1);
}

console.log(`[audit] received ${trades.length} trades`);

// ── Group trades by politicus name ──────────────────────────────────────────
// Map<rawName, { occurrences, sampleTradeId, firstSeenAt, lastSeenAt }>
const nameStats = new Map();

for (const trade of trades) {
  const rawName = trade.politician;
  if (!rawName) continue;

  const existing = nameStats.get(rawName);
  const tradeDate = trade.tradeDate ?? trade.filedDate ?? null;

  if (existing) {
    existing.occurrences += 1;
    if (tradeDate) {
      if (!existing.firstSeenAt || tradeDate < existing.firstSeenAt) {
        existing.firstSeenAt = tradeDate;
      }
      if (!existing.lastSeenAt || tradeDate > existing.lastSeenAt) {
        existing.lastSeenAt = tradeDate;
      }
    }
  } else {
    nameStats.set(rawName, {
      occurrences: 1,
      sampleTradeId: trade.id ?? null,
      firstSeenAt: tradeDate,
      lastSeenAt: tradeDate,
    });
  }
}

console.log(`[audit] ${nameStats.size} unique politicus names`);

// ── Resolve each unique name ────────────────────────────────────────────────
// findByName returns:
//   - exact-match via override → resolved (length 1, came from NAME_OVERRIDES)
//   - cascade match → resolved (length ≥ 1)
//   - no match → unmatched (length 0)
//
// The lib doesn't expose whether a result came via override vs cascade. For
// the report we treat any successful resolution as "matched"; the override
// path is observable indirectly because adding an override moves a name from
// "unmatched" to "matched" between runs.

const matched = [];
const unmatched = [];

for (const [rawName, stats] of nameStats) {
  const results = findByName(rawName);
  if (results.length > 0) {
    matched.push({
      rawName,
      resolvedAs: results[0].name,
      bioguideId: results[0].bioguideId,
      occurrences: stats.occurrences,
    });
  } else {
    unmatched.push({
      rawName,
      ...stats,
    });
  }
}

// Sort unmatched by occurrences (most frequent first — biggest impact)
unmatched.sort((a, b) => b.occurrences - a.occurrences);

// ── Write report ─────────────────────────────────────────────────────────────
const report = {
  generatedAt: new Date().toISOString(),
  source: BASE_URL,
  totalTrades: trades.length,
  uniqueNames: nameStats.size,
  matchedCount: matched.length,
  unmatchedCount: unmatched.length,
  unmatched,
  matched,
};

await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

// ── Console summary ─────────────────────────────────────────────────────────
console.log('');
console.log(`[audit] ── Summary ──────────────────────────────────────`);
console.log(`[audit] Trades fetched:    ${trades.length}`);
console.log(`[audit] Unique names:      ${nameStats.size}`);
console.log(`[audit] Matched:           ${matched.length}`);
console.log(`[audit] Unmatched:         ${unmatched.length}`);
console.log(`[audit] Report written to: ${OUTPUT_PATH.pathname}`);

if (unmatched.length > 0) {
  console.log('');
  console.log(`[audit] Top unmatched names (add to name-overrides.json):`);
  for (const u of unmatched.slice(0, 10)) {
    console.log(`[audit]   - "${u.rawName}" (${u.occurrences}x)`);
  }
  process.exit(0); // not an error — unmatched names are expected, this is observability
} else {
  console.log('');
  console.log(`[audit] ✓ All names resolved.`);
  process.exit(0);
}

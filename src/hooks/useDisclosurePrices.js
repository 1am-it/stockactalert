// 1AM-163: useDisclosurePrices — single swap-point for the three price values
// rendered by DisclosureTimeline. Currently returns deterministic mock-data
// derived from ticker+tradeDate, will be replaced with real historical-price
// + latest-quote fetch when 1AM-174 commercial-data-source decision lands.
//
// Why a hook and not inline data: keeps the rendering component data-agnostic.
// When real data comes online, only this hook changes — DisclosureTimeline and
// TradeDetailDrawer integration stay identical. Same pattern as useTrades /
// useActivePoliticians.
//
// Why deterministic mock: lets the same trade open repeatedly with the same
// prices (no random jitter per render). This is essential for the visual
// neutrality-test workflow — a developer or designer reviewing a specific
// trade sees stable output, not different prices every page-load.
//
// Why no loading state in mock: prices are synchronous in mock-mode. Real
// implementation WILL have loading/error states matching useTrades. The
// hook signature is forward-compatible: { tradePrice, filedPrice, todayPrice,
// todayTimestamp, loading, error }. In mock-mode loading is always false and
// error is always null.
//
// Conditional rendering responsibility: hook may return null prices when real
// data is unavailable (FMP 402, ticker not in universe, etc.). Consumer
// (TradeDetailDrawer) must check and hide the section when any price is null.
// In mock-mode all three prices are always populated — but consumers MUST
// implement the null-check pattern so it works correctly when real data lands.
//
// USAGE:
//   const { tradePrice, filedPrice, todayPrice, todayTimestamp, loading, error } =
//     useDisclosurePrices(trade);
//   if (loading || error || !tradePrice || !filedPrice || !todayPrice) return null;
//   return <DisclosureTimeline ... />;

import { useMemo } from 'react';

// FNV-1a-ish hash — fast deterministic seed generator. Not cryptographic;
// good enough to spread inputs across the output space.
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

// Mulberry32 PRNG — deterministic, seed-driven, returns [0, 1).
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Derive a plausible base price from ticker — different tickers feel different
// (small-cap vs blue-chip range). Hash-bucket → range $20 to $600.
function basePriceForTicker(ticker) {
  const h = hashSeed(ticker || 'UNKNOWN');
  const range = (h % 580) + 20;
  return range;
}

// Format the timestamp string. Basic market-hours awareness: weekday during
// US market hours (9:30-16:00 ET, approximated as 14:30-21:00 UTC) → live;
// otherwise market-closed annotation. No DST, no partial trading days, no
// timezone library — full polish deferred to real-data implementation.
function formatTodayTimestamp(now) {
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();

  // Approximate ET as UTC-5 (ignoring DST for mock purposes).
  // Market hours 9:30-16:00 ET ≈ 14:30-21:00 UTC.
  const utcMinutes = hour * 60 + minute;
  const marketOpen = 14 * 60 + 30; // 14:30 UTC
  const marketClose = 21 * 60;     // 21:00 UTC
  const isWeekday = day >= 1 && day <= 5;
  const isMarketHours = isWeekday && utcMinutes >= marketOpen && utcMinutes < marketClose;

  // Convert UTC time to approximate ET for display (UTC - 5h).
  const etHour = (hour + 24 - 5) % 24;
  const etMinute = minute;
  const hh = String(etHour).padStart(2, '0');
  const mm = String(etMinute).padStart(2, '0');

  if (isMarketHours) {
    return `as of ${hh}:${mm} ET`;
  }
  const dayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
  return `as of ${dayLabel} ${hh}:${mm} ET (market closed)`;
}

/**
 * @typedef {Object} DisclosurePricesResult
 * @property {number|null} tradePrice - Closing price on trade.tradeDate (null when unavailable)
 * @property {number|null} filedPrice - Closing price on trade.filedDate (null when unavailable)
 * @property {number|null} todayPrice - Current/intraday price (null when unavailable)
 * @property {string} todayTimestamp - Display string for "as of HH:MM ET"
 * @property {boolean} loading - True while real-data fetch is in flight (always false in mock-mode)
 * @property {Error|null} error - Fetch error (always null in mock-mode)
 */

/**
 * 1AM-163: returns the three price datapoints for a trade's Disclosure Timeline.
 *
 * Mock implementation. Real implementation will:
 *   - Fetch historical close from FMP/Quiver for trade.tradeDate
 *   - Fetch historical close for trade.filedDate
 *   - Fetch current quote for trade.ticker
 *   - Server-side cache (15min TTL per ticker) per ticket spec
 *
 * @param {Object} trade - Trade object from useTrades
 * @returns {DisclosurePricesResult}
 */
export function useDisclosurePrices(trade) {
  return useMemo(() => {
    if (!trade || !trade.ticker || !trade.tradeDate || !trade.filedDate) {
      return {
        tradePrice: null,
        filedPrice: null,
        todayPrice: null,
        todayTimestamp: '',
        loading: false,
        error: null,
      };
    }

    // Deterministic seed: same ticker + tradeDate → same prices on every render.
    const seed = hashSeed(`${trade.ticker}-${trade.tradeDate}`);
    const rand = mulberry32(seed);

    const base = basePriceForTicker(trade.ticker);

    // Three price points within ±15% of base. Each independently drawn so
    // the trajectory (up/down/V/inverted-V) emerges naturally from the seed
    // — no artificial pattern injection.
    const variance = 0.15;
    const tradePrice = base * (1 + (rand() - 0.5) * 2 * variance);
    const filedPrice = base * (1 + (rand() - 0.5) * 2 * variance);
    const todayPrice = base * (1 + (rand() - 0.5) * 2 * variance);

    return {
      tradePrice: Math.round(tradePrice * 100) / 100,
      filedPrice: Math.round(filedPrice * 100) / 100,
      todayPrice: Math.round(todayPrice * 100) / 100,
      todayTimestamp: formatTodayTimestamp(new Date()),
      loading: false,
      error: null,
    };
  }, [trade?.ticker, trade?.tradeDate, trade?.filedDate]);
}

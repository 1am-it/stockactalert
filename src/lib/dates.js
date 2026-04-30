// src/lib/dates.js — 1AM-86
//
// Date utilities for trade-card display. Pure functions, no side effects,
// safe to call on malformed input (returns null on bad data).

/**
 * Computes the number of full days between two YYYY-MM-DD strings.
 *
 * Returns null if either input is missing or unparseable. Uses UTC midnight
 * to avoid DST and timezone drift — STOCK Act filing dates have no time
 * component so anchoring at UTC 00:00 is correct.
 *
 * @param {string} laterDate   YYYY-MM-DD (typically the filing date)
 * @param {string} earlierDate YYYY-MM-DD (typically the trade/transaction date)
 * @returns {number|null}      Whole days between the two dates, or null on bad input
 */
export function daysBetween(laterDate, earlierDate) {
  if (!laterDate || !earlierDate) return null;

  const later = Date.parse(`${laterDate}T00:00:00Z`);
  const earlier = Date.parse(`${earlierDate}T00:00:00Z`);

  if (Number.isNaN(later) || Number.isNaN(earlier)) return null;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((later - earlier) / MS_PER_DAY);
}

/**
 * Formats the filing-delta as human-readable text.
 *
 *   filedDate < tradeDate   → null  (data error — caller should fall back)
 *   delta === 0             → "same day"
 *   delta === 1             → "1 day after trade"
 *   delta >= 2              → "N days after trade"
 *   missing/invalid input   → null
 *
 * @param {string} filedDate YYYY-MM-DD
 * @param {string} tradeDate YYYY-MM-DD
 * @returns {string|null}
 */
export function formatFiledDelta(filedDate, tradeDate) {
  const delta = daysBetween(filedDate, tradeDate);
  if (delta === null || delta < 0) return null;
  if (delta === 0) return 'same day';
  if (delta === 1) return '1 day after trade';
  return `${delta} days after trade`;
}

/**
 * Threshold for "late filing" visual cue, per STOCK Act context.
 *
 * STOCK Act gives Congress 45 days to disclose. We flag at >30 days as a
 * leading indicator — not technically late, but unusual enough to surface.
 * Adjust here if the threshold ever changes.
 */
export const LATE_FILING_THRESHOLD_DAYS = 30;

/**
 * @param {string} filedDate YYYY-MM-DD
 * @param {string} tradeDate YYYY-MM-DD
 * @returns {boolean} true when delta strictly exceeds the threshold
 */
export function isLateFiling(filedDate, tradeDate) {
  const delta = daysBetween(filedDate, tradeDate);
  if (delta === null) return false;
  return delta > LATE_FILING_THRESHOLD_DAYS;
}

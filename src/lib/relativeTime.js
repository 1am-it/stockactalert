// 1AM-38: relative-time + staleness helpers
//
// Used by FreshnessIndicator (and potentially other UI surfaces later) to
// turn a timestamp into a human-friendly "5 min ago" string and classify
// data age into fresh / stale / old buckets.
//
// Decision: dot indicator only renders when staleness !== 'fresh'.
// - fresh (≤ 4h)   → no dot, no warning
// - stale (4–24h)  → amber dot, soft "may want to refresh" signal
// - old   (> 24h)  → grey dot, signals likely CDN/network problem
//
// Thresholds chosen to match Vercel CDN cache (s-maxage=3600, swr=7200).
// A 4-hour fresh window absorbs cache-miss + revalidate jitter without
// flickering the indicator on every refetch.

export const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours
export const OLD_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * @param {number|null|undefined} timestamp - Date.now()-style ms epoch
 * @returns {string|null} human-friendly relative time, or null if no timestamp
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return null;

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'just now'; // clock-skew safeguard

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 min ago';
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return '1 hour ago';
  if (diffHr < 24) return `${diffHr} hours ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  // Older than a week — fall back to a date. Locale-aware so it picks up
  // the user's preferred date format.
  return new Date(timestamp).toLocaleDateString();
}

/**
 * @param {number|null|undefined} timestamp
 * @returns {'fresh' | 'stale' | 'old' | 'unknown'}
 */
export function getStaleness(timestamp) {
  if (!timestamp) return 'unknown';
  const ageMs = Date.now() - timestamp;
  if (ageMs < 0) return 'fresh'; // clock-skew safeguard
  if (ageMs <= STALE_THRESHOLD_MS) return 'fresh';
  if (ageMs <= OLD_THRESHOLD_MS) return 'stale';
  return 'old';
}

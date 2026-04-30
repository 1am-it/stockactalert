// 1AM-38: FreshnessIndicator — at-a-glance signal of feed freshness
//
// Renders below the page title and above the FilterBar on Personal feed.
// Three pieces of info, layout right-aligned to balance content:
//
//   [● ] Latest publicly available filings  [N new]              [Updated 5 min ago]
//    ^                                       ^                    ^
//    only when stale/old                    only when count > 0   always (when timestamp known)
//
// Auto-ticks every 60 seconds so the relative-time string ("5 min ago" →
// "6 min ago") updates without user interaction. setInterval is cleaned up
// on unmount.
//
// Per design decision (chat 2026-04-30, option C): dot indicator is OPT-IN
// — only renders when data is stale (4-24h) or old (>24h). Fresh data shows
// no dot. This keeps the indicator quiet 95% of the time and makes the
// dot itself a meaningful signal when it appears.
//
// Props:
//   lastUpdatedAt   — ms epoch of last successful API fetch (from useTrades)
//   newTradeCount   — count of trades in current fetch that weren't in previous
//                     fetch. Defaults to 0. Badge hidden when 0.

import { useState, useEffect } from 'react';
import { formatRelativeTime, getStaleness } from '../lib/relativeTime';

// Dot palette by staleness. Fresh → null = no dot rendered.
const DOT_COLORS = {
  fresh: null,
  stale: '#D97706', // amber — warm warning
  old: '#9CA3AF',   // grey — signals likely connectivity issue
  unknown: null,
};

const TICK_INTERVAL_MS = 60_000;

export default function FreshnessIndicator({ lastUpdatedAt, newTradeCount = 0 }) {
  // Re-render trigger so relative-time recomputes as time passes.
  // Setting the same value would skip re-render; using a counter ensures it.
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (!lastUpdatedAt) return null;

  const staleness = getStaleness(lastUpdatedAt);
  const dotColor = DOT_COLORS[staleness];
  const relativeTime = formatRelativeTime(lastUpdatedAt);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {dotColor && (
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}

      <span style={{ fontSize: 12, color: '#0D1B2A' }}>
        Latest publicly available filings
      </span>

      {newTradeCount > 0 && (
        <span
          style={{
            background: '#ECFDF5',
            color: '#065F46',
            fontSize: 10,
            fontWeight: 500,
            padding: '2px 7px',
            borderRadius: 10,
          }}
          aria-label={`${newTradeCount} new ${newTradeCount === 1 ? 'filing' : 'filings'} since last refresh`}
        >
          {newTradeCount} new
        </span>
      )}

      <span
        style={{
          background: '#F3F4F6',
          color: '#6B7280',
          fontSize: 10,
          padding: '2px 7px',
          borderRadius: 10,
          marginLeft: 'auto',
        }}
      >
        Updated {relativeTime}
      </span>
    </div>
  );
}

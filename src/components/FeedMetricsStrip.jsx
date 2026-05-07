// 1AM-145: FeedMetricsStrip
// Three-column metrics display rendered inside the Feed-tab empty-state hero.
// Provides at-a-glance signal that the system is working: how many follows
// the user has, what time window is being checked, and how recently the data
// was refreshed.
//
// Lovable v2 mockup decision: this strip lives BETWEEN the HeaderBar and the
// hero card, replacing the "x trades from the y politicians you follow"
// monospace count + the inline FreshnessIndicator pill in the empty state.
// Both pieces of data are absorbed into the strip — no information loss.
//
// Display rules:
//   - Following: shows "—" (em-dash) when count is 0, otherwise shows the
//     literal count. Em-dash convention from the mockup: 0 feels like
//     "failed", em-dash feels like "to be set".
//   - Window: hardcoded "30d" for v1. Future ticket may make it dynamic
//     based on a user preference or actual data-staleness window.
//   - Last check: relative time string from `lastUpdatedAt`. Fall back to
//     "—" if no timestamp (e.g. very first load before any fetch resolves).
//
// Visual: matching the editorial pattern from Browse-tab — warm-white panel
// background, subtle separators between columns, Playfair labels at top in
// uppercase tracking, large value below in serif.
//
// Props:
//   followingCount  — number, count of followed politicians
//   windowLabel     — string (default '30d')
//   lastUpdatedAt   — number|null, ms epoch timestamp from useTrades

import { formatRelativeTime } from '../lib/relativeTime';

export default function FeedMetricsStrip({
  followingCount,
  windowLabel = '30d',
  lastUpdatedAt = null,
}) {
  // 1AM-145: em-dash for zero-follows. See header comment.
  const followingDisplay = followingCount > 0 ? String(followingCount) : '—';

  // formatRelativeTime returns 'just now' / 'X min ago' / 'X hr ago' / etc.
  // Compress to short form for the strip ("1m ago" / "2h ago") to keep the
  // column width tight. Falls back to em-dash when no timestamp yet.
  const lastCheckRaw = formatRelativeTime(lastUpdatedAt);
  const lastCheckDisplay = lastCheckRaw
    ? lastCheckRaw
        .replace(' min ago', 'm ago')
        .replace(' hr ago', 'h ago')
        .replace(' min', 'm')
        .replace(' hr', 'h')
    : '—';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        background: '#FFFFFF',
        border: '1px solid #E8E5D8',
        borderRadius: 12,
        padding: '14px 0',
        marginBottom: 16,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <Cell label="FOLLOWING" value={followingDisplay} />
      <Cell label="WINDOW" value={windowLabel} bordered />
      <Cell label="LAST CHECK" value={lastCheckDisplay} bordered />
    </div>
  );
}

// Single-cell renderer. Bordered cells get a left-border separator —
// keeps the visual rhythm tight without overusing dividers.
function Cell({ label, value, bordered = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderLeft: bordered ? '1px solid #E8E5D8' : 'none',
      }}
    >
      <span
        style={{
          fontFamily: "'Playfair Display', 'Lora', serif",
          fontSize: 22,
          fontWeight: 500,
          color: '#0D1B2A',
          letterSpacing: '-0.3px',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: '#9CA3AF',
          letterSpacing: '0.6px',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  );
}

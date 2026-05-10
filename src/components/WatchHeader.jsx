// 1AM-168: WatchHeader
// Watch-tab header that consolidates window-selector, last-update, following
// pill, and settings access into one component. Replaces the previous
// HeaderBar + FeedMetricsStrip + FilterBar + FreshnessIndicator combo.
//
// Why this exists: in the v0.22.x Feed-tab implementation the time-window
// label, the follow-count, and the freshness timestamp lived across three
// separate components (FeedMetricsStrip, FilterBar, FreshnessIndicator).
// Window was hardcoded, last-check was rendered twice, and "Show all" had
// nowhere good to go after 1AM-112 routed it to Browse-tab. The Lovable
// Watch-redesign mockup (2026-05-10) collapses this into a single header
// with one window-selector as single source of truth.
//
// Visual layout (per Lovable active-state mockup):
//
//   ┌─ Watch ─────────────────────────  [👥 Following 3] [⚙] ─┐
//   │  Activity from the people you follow.                    │
//   │                                                          │
//   │  [24h] [7d] [30d] [90d]            🕐 Last update 4m ago │
//   └──────────────────────────────────────────────────────────┘
//
// The clock-icon left of "Last update" doubles as a tap-to-refresh
// affordance — there is no separate refresh button anymore. This is
// documented here because the mockup doesn't surface it explicitly.
//
// Window selector (24h/7d/30d/90d) drives all Watch-secties — Phase 3
// scopes Most Active, Phase 4 drives Sector Heatmap, this phase wires
// the empty-state copy and the visible-trades filter to it.
//
// Following-pill stays in this header in BOTH active and empty states
// per epic-decision (1AM-166 — Lovable rationale: status-indicator vs
// uitbreiden-intentie are different concerns; jitter-prevention between
// state-flips). Don't move it to the Politici-CTA blok in Phase 3.
//
// Props:
//   followingCount         — number, count for the people-pill badge
//   onManageFollowingClick — callback when people-pill is tapped
//   onSettingsClick        — callback when gear icon is tapped
//   watchWindow            — '24h' | '7d' | '30d' | '90d', current window
//   onWindowChange         — callback(window) when a chip is tapped
//   lastUpdatedAt          — number|null, ms epoch timestamp from useTrades
//   onRefresh              — callback when clock-icon is tapped (refresh)

import { formatRelativeTime } from '../lib/relativeTime';

const WINDOWS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

export default function WatchHeader({
  followingCount = 0,
  onManageFollowingClick,
  onSettingsClick,
  watchWindow = '30d',
  onWindowChange,
  lastUpdatedAt = null,
  onRefresh,
}) {
  // Format "Last update N min ago" with a short-form fallback when
  // we don't have a timestamp yet (very first load before fetch resolves).
  const lastUpdateRaw = formatRelativeTime(lastUpdatedAt);
  const lastUpdateDisplay = lastUpdateRaw
    ? `Last update ${lastUpdateRaw}`
    : 'Last update —';

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Top row: title + subtitle (left), people-pill + gear (right). */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontSize: 32,
              margin: 0,
              color: '#0D1B2A',
              fontFamily: "'Playfair Display', 'Lora', serif",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: '-0.5px',
            }}
          >
            Watch
          </h1>
          <div
            style={{
              fontSize: 13,
              color: '#6B7280',
              fontFamily: "'DM Sans', sans-serif",
              marginTop: 6,
            }}
          >
            Activity from the people you follow.
          </div>
        </div>

        {/* Right cluster: people-pill (with badge) + gear. Both 36px circles. */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onManageFollowingClick}
            aria-label={`Manage following (${followingCount} ${followingCount === 1 ? 'politician' : 'politicians'})`}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid #E5E7EB',
              background: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F9FAFB';
              e.currentTarget.style.borderColor = '#D1D5DB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.borderColor = '#E5E7EB';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="8" r="3.2" stroke="#6B7280" strokeWidth="2" />
              <path
                d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
                stroke="#6B7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="16.5" cy="9.5" r="2.4" stroke="#6B7280" strokeWidth="2" />
              <path
                d="M15 14.5c2.5 0.4 4.5 2.5 4.5 5"
                stroke="#6B7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {followingCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 8,
                  background: '#0D1B2A',
                  color: '#FAFAF7',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  boxSizing: 'border-box',
                }}
              >
                {followingCount > 99 ? '99+' : followingCount}
              </span>
            )}
          </button>

          <button
            onClick={onSettingsClick}
            aria-label="Open settings"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid #E5E7EB',
              background: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F9FAFB';
              e.currentTarget.style.borderColor = '#D1D5DB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.borderColor = '#E5E7EB';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="#6B7280" strokeWidth="2" />
              <path
                d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                stroke="#6B7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom row: window-selector chips (left) + Last update (right) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          role="radiogroup"
          aria-label="Time window"
          style={{
            display: 'flex',
            gap: 6,
          }}
        >
          {WINDOWS.map((w) => {
            const selected = w.value === watchWindow;
            return (
              <button
                key={w.value}
                role="radio"
                aria-checked={selected}
                onClick={() => onWindowChange?.(w.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: selected ? '1px solid #0D1B2A' : '1px solid #E5E7EB',
                  background: selected ? '#0D1B2A' : '#FFFFFF',
                  color: selected ? '#FAFAF7' : '#374151',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>

        {/* Last update — clock icon doubles as tap-to-refresh.
            Title attr communicates the refresh affordance for keyboard/desktop. */}
        <button
          onClick={onRefresh}
          aria-label="Refresh trades"
          title="Tap to refresh"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#6B7280',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0D1B2A';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#6B7280';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 7v5l3 2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {lastUpdateDisplay}
        </button>
      </div>
    </div>
  );
}

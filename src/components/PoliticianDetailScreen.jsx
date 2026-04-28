// 1AM-69: Politician detail page (drilldown)
//
// Full-screen overlay reached from any clickable politician name (TradeCard
// in feed, MemberListRow in Politicians-tab). Renders header + action buttons +
// stats card + net positions + full trade history for one specific politician.
//
// Routing: not a route. Rendered conditionally by App.jsx when
// `detailPolitician` state is non-null. "← Back" cleans the state.
//
// Out of scope (per ticket):
//   - Spouse-only toggle (1AM-73)
//   - Active-sectors text (1AM-37 dependency, shows "No sector data yet")
//   - Photos (1AM-74)
//   - Sharing button (deferred)
//   - Pagination (max ~50 trades feed-total, single politician rarely >5-10)
//
// "Net positions" naming chosen over "Estimated holdings" — STOCK Act data
// is range-based, so calling it "holdings" overclaims. "Net positions" is
// honest: opgetelde handelsactiviteit per ticker, midpoint as estimate.

import { useMemo } from 'react';
import TradeCard from './TradeCard';
import { findByName } from '../lib/congress';
import { ACTIONS } from '../data/schema';

// Range-string → numeric midpoint estimate. Best effort; FMP amounts come
// in formats like "$50K - $100K" or "$1M - $5M" or sometimes "$1,001 - $15,000".
// Returns 0 when unparseable so cumulative math doesn't silently break.
function parseAmountMidpoint(amountStr) {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  // Strip $ and commas, normalise dash variants
  const cleaned = amountStr.replace(/[$,]/g, '').replace(/–|—/g, '-');
  const parts = cleaned.split('-').map((s) => s.trim());
  if (parts.length !== 2) {
    // Single-value formats like "$1M+" — best effort: parse the number
    return parseAmountSingle(parts[0]);
  }
  const lo = parseAmountSingle(parts[0]);
  const hi = parseAmountSingle(parts[1]);
  return (lo + hi) / 2;
}

function parseAmountSingle(s) {
  if (!s) return 0;
  const trimmed = s.trim().toUpperCase();
  // Handle "+" suffix → treat as the number
  const num = parseFloat(trimmed);
  if (isNaN(num)) return 0;
  if (trimmed.includes('M')) return num * 1_000_000;
  if (trimmed.includes('K')) return num * 1_000;
  return num;
}

// Format a numeric estimate back to a friendly label
function formatMidpointLabel(midpoint) {
  if (midpoint <= 0) return '—';
  if (midpoint >= 1_000_000) return `~$${(midpoint / 1_000_000).toFixed(1)}M`;
  if (midpoint >= 1_000) return `~$${Math.round(midpoint / 1_000)}K`;
  return `~$${Math.round(midpoint)}`;
}

// ── Compute net positions ───────────────────────────────────────────────────
// For each ticker: cumulatieve buys minus sells (using midpoint estimates).
// Returns only entries where net > 0 — "negatieve holding" maakt geen sense.
// Sorted descending by net midpoint (largest position first).
function computeNetPositions(trades) {
  const byTicker = new Map();
  for (const t of trades) {
    if (!t.ticker) continue;
    const mid = parseAmountMidpoint(t.amount);
    const sign =
      t.action === ACTIONS.PURCHASE ? 1 : t.action === ACTIONS.SALE ? -1 : 0;
    if (sign === 0) continue; // Skip exchanges
    const prev = byTicker.get(t.ticker) || 0;
    byTicker.set(t.ticker, prev + sign * mid);
  }
  return [...byTicker.entries()]
    .filter(([, net]) => net > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([ticker, net]) => ({ ticker, netMidpoint: net }));
}

// ── Compute weekly trade counts for sparkline ───────────────────────────────
// 13 weeks × count of trades filed that week. Rightmost bar = most recent week.
function computeWeeklyActivity(trades) {
  const now = new Date();
  const buckets = new Array(13).fill(0);
  for (const t of trades) {
    if (!t.tradeDate) continue;
    const d = new Date(t.tradeDate);
    if (isNaN(d.getTime())) continue;
    const daysAgo = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (daysAgo < 0 || daysAgo > 91) continue;
    const weekIdx = 12 - Math.floor(daysAgo / 7);
    if (weekIdx >= 0 && weekIdx < 13) buckets[weekIdx]++;
  }
  return buckets;
}

// ── 90-day filter ───────────────────────────────────────────────────────────
function isWithin90Days(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= 90;
}

// ════════════════════════════════════════════════════════════════════════════

export default function PoliticianDetailScreen({
  politicianName,
  trades,
  isFollowing,
  isMuted,
  onToggleFollow,
  onToggleMute,
  onBack,
}) {
  // Resolve member metadata from the directory.
  // findByName returns ranked array; first result is the best match.
  const member = useMemo(() => {
    const matches = findByName(politicianName);
    return matches.length > 0 ? matches[0] : null;
  }, [politicianName]);

  // Filter trades to this politician (case-insensitive defensive match)
  const politicianTrades = useMemo(() => {
    const lower = politicianName.toLowerCase();
    return trades
      .filter((t) => (t.politician || '').toLowerCase() === lower)
      .sort((a, b) => new Date(b.filedDate) - new Date(a.filedDate));
  }, [trades, politicianName]);

  const trades90d = useMemo(
    () => politicianTrades.filter((t) => isWithin90Days(t.tradeDate)),
    [politicianTrades]
  );

  const weeklyActivity = useMemo(
    () => computeWeeklyActivity(politicianTrades),
    [politicianTrades]
  );

  const netPositions = useMemo(
    () => computeNetPositions(politicianTrades),
    [politicianTrades]
  );

  const districtSuffix =
    member && member.chamber === 'House' && member.district !== undefined
      ? `-${member.district}`
      : '';

  const metaLine = member
    ? `${member.chamber} · ${member.party} · ${member.state}${districtSuffix}`
    : 'Member metadata unavailable';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '24px 24px 100px',
        }}
      >
        {/* ── Back link ──────────────────────────────────────────────── */}
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            fontSize: 13,
            color: '#6B7280',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 14,
          }}
        >
          ← Back
        </button>

        {/* ── Header ────────────────────────────────────────────────── */}
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            fontWeight: 700,
            color: '#0D1B2A',
            lineHeight: 1.1,
            margin: 0,
            marginBottom: 6,
          }}
        >
          {politicianName}
        </h1>
        <div
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#6B7280',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 18,
          }}
        >
          {metaLine}
        </div>

        {/* ── Action buttons ────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          <button
            onClick={onToggleFollow}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              borderRadius: 10,
              border: isFollowing
                ? '1px solid rgba(220, 38, 38, 0.3)'
                : '1px solid #0D1B2A',
              background: '#FFFFFF',
              color: isFollowing ? '#DC2626' : '#0D1B2A',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
          <button
            onClick={onToggleMute}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              borderRadius: 10,
              border: '1px solid #E5E7EB',
              background: isMuted ? '#F3F4F6' : '#FFFFFF',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            {isMuted ? 'Alerts muted' : 'Mute alerts'}
          </button>
        </div>

        {/* ── Stats card ────────────────────────────────────────────── */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 22,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 22,
                fontWeight: 700,
                color: '#0D1B2A',
              }}
            >
              {trades90d.length}
            </span>
            <span style={{ fontSize: 11, color: '#6B7280' }}>
              {trades90d.length === 1 ? 'trade · 90d' : 'trades · 90d'}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#9CA3AF',
              fontStyle: 'italic',
              marginBottom: 10,
            }}
          >
            No sector data yet
          </div>
          <ActivitySparkline weeks={weeklyActivity} />
        </div>

        {/* ── Net positions ─────────────────────────────────────────── */}
        <SectionHeader>Net positions</SectionHeader>
        {netPositions.length === 0 ? (
          <EmptyCard>
            No open positions detected from trades visible in the feed.
          </EmptyCard>
        ) : (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            {netPositions.map(({ ticker, netMidpoint }, idx) => (
              <div
                key={ticker}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom:
                    idx < netPositions.length - 1 ? '1px solid #F3F4F6' : 'none',
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 700, color: '#0D1B2A' }}>{ticker}</span>
                <span style={{ color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>
                  {formatMidpointLabel(netMidpoint)}
                </span>
              </div>
            ))}
          </div>
        )}
        <p
          style={{
            fontSize: 10,
            color: '#9CA3AF',
            fontStyle: 'italic',
            margin: '0 0 22px',
            lineHeight: 1.4,
          }}
        >
          Calculated from disclosed trades using midpoint estimates. Actual
          portfolio not disclosed.
        </p>

        {/* ── Trade history ─────────────────────────────────────────── */}
        <SectionHeader>Trade history</SectionHeader>
        {politicianTrades.length === 0 ? (
          <EmptyCard>No trades visible in the current feed.</EmptyCard>
        ) : (
          politicianTrades.map((trade) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              following={isFollowing}
              owner={trade.owner}
              onSetAlert={() => {}}
              onViewProfile={() => {}}
              onViewTicker={() => {}}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#9CA3AF',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 10,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

// ── Empty state card ───────────────────────────────────────────────────────
function EmptyCard({ children }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 22,
      }}
    >
      {children}
    </div>
  );
}

// ── Activity sparkline ─────────────────────────────────────────────────────
// 13-bar inline visualisation of weekly trade-frequency. Bar height scales to
// the max value so a quiet politician's pattern is still readable. Gray when
// the week has zero trades.
function ActivitySparkline({ weeks }) {
  const max = Math.max(1, ...weeks);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 30,
      }}
      aria-label={`Trade activity over the last ${weeks.length} weeks`}
    >
      {weeks.map((count, i) => {
        const heightPct = count === 0 ? 6 : (count / max) * 100;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${heightPct}%`,
              background: count === 0 ? '#E5E7EB' : '#0F6E56',
              opacity: count === 0 ? 0.5 : 0.75,
              borderRadius: 1,
              minHeight: 2,
            }}
          />
        );
      })}
    </div>
  );
}

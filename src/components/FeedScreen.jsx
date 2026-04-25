// SAA-12 / SAA-16 / SAA-18.1: FeedScreen component
// Renders the live congressional trade feed with client-side filtering by
// followed politicians (from onboarding) and a toggle to temporarily show
// all trades.
//
// SAA-18.1: When the filter is active but no followed politicians have
// recent trades, the empty state now shows *which* politicians the user
// follows as a chip-grid (with "Show all" toggle if there are more than 6).
// This confirms the user's picks at a glance without leaving the screen.
//
// Filter behaviour:
//   - Default: filter trades by `followedPoliticians` (personalised view)
//   - Toggle "Show all": show unfiltered trades for current session
//   - Empty state distinguishes between "no data" vs "no matches in filter"
//
// Session-only state: refresh resets `showAll` back to false (= filtered).
//
// Props:
//   followedPoliticians — array of politician names the user follows

import { useState } from 'react';
import TradeCard from './TradeCard';
import { useTrades } from '../hooks/useTrades';

const CHIPS_INITIAL = 6;

export default function FeedScreen({ followedPoliticians = [] }) {
  const { trades, loading, error, refetch } = useTrades();

  // Whether to bypass the followed-filter for the current session
  const [showAll, setShowAll] = useState(false);

  const hasFollowed = followedPoliticians.length > 0;
  const filterActive = hasFollowed && !showAll;

  // Apply the filter client-side
  const visibleTrades = filterActive
    ? trades.filter((t) => followedPoliticians.includes(t.politician))
    : trades;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          padding: '40px 0',
          textAlign: 'center',
          color: '#9CA3AF',
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Loading trades…
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 16,
          color: '#B91C1C',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
          Couldn't load trades
        </div>
        <div style={{ fontSize: 12, color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
        <button
          onClick={refetch}
          style={{
            padding: '8px 20px',
            background: '#0D1B2A',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ── No data at all (API returned zero trades) ──────────────────────────────
  if (!trades.length) {
    return (
      <div
        style={{
          padding: '40px 16px',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        No trades to show right now.
      </div>
    );
  }

  // ── Success state (with or without matches) ────────────────────────────────
  return (
    <div>
      {/* Filter indicator + toggle */}
      <FilterBar
        filterActive={filterActive}
        hasFollowed={hasFollowed}
        followedCount={followedPoliticians.length}
        visibleCount={visibleTrades.length}
        onToggleShowAll={() => setShowAll((v) => !v)}
        onRefresh={refetch}
      />

      {/* Filter active but zero matches in current data */}
      {filterActive && visibleTrades.length === 0 ? (
        <FilterEmptyState
          followedPoliticians={followedPoliticians}
          onShowAll={() => setShowAll(true)}
        />
      ) : (
        visibleTrades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            onSetAlert={(t) => console.log('alert', t)}
            onViewProfile={(t) => console.log('profile', t)}
            onViewTicker={(t) => console.log('ticker', t)}
          />
        ))
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
// Shows the current filter state and lets the user toggle.
function FilterBar({
  filterActive,
  hasFollowed,
  followedCount,
  visibleCount,
  onToggleShowAll,
  onRefresh,
}) {
  const label = filterActive
    ? `${visibleCount} OF ${followedCount} FOLLOWED`
    : hasFollowed
      ? 'SHOWING ALL TRADES'
      : `${visibleCount} RECENT TRADES`;

  const toggleLabel = filterActive ? 'Show all' : 'Show followed';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '0 2px',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#9CA3AF',
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {hasFollowed && (
          <button
            onClick={onToggleShowAll}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#6B7280',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {toggleLabel}
          </button>
        )}
        <button
          onClick={onRefresh}
          style={{
            padding: '4px 10px',
            background: 'transparent',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            color: '#6B7280',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}

// ── Filter empty state ────────────────────────────────────────────────────────
// Shown when filter is active but no followed politicians have recent trades.
// SAA-18.1: now includes a chip-grid showing *who* the user follows, with
// a "Show all" toggle when the list exceeds CHIPS_INITIAL (6).
function FilterEmptyState({ followedPoliticians, onShowAll }) {
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const totalCount = followedPoliticians.length;
  const showExpandToggle = totalCount > CHIPS_INITIAL;

  const visibleChips = chipsExpanded
    ? followedPoliticians
    : followedPoliticians.slice(0, CHIPS_INITIAL);

  return (
    <div
      style={{
        padding: '28px 24px',
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 16,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#0D1B2A',
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        None of your followed politicians have recent filings.
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#6B7280',
          lineHeight: 1.5,
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        Filings come in batches — check back in a day or two, or browse all
        recent trades for now.
      </div>

      {/* ── Followed politicians chips ── */}
      <div
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#9CA3AF',
          marginBottom: 10,
        }}
      >
        Following {totalCount} {totalCount === 1 ? 'politician' : 'politicians'}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: showExpandToggle ? 12 : 20,
        }}
      >
        {visibleChips.map((name) => (
          <span
            key={name}
            style={{
              padding: '6px 10px',
              background: '#F3F4F6',
              color: '#374151',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
        ))}
      </div>

      {showExpandToggle && (
        <button
          onClick={() => setChipsExpanded((v) => !v)}
          style={{
            display: 'block',
            margin: '0 auto 20px',
            padding: '4px 10px',
            background: 'transparent',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            color: '#6B7280',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          {chipsExpanded ? 'Show fewer' : `Show all ${totalCount}`}
        </button>
      )}

      {/* ── Escape hatch ── */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={onShowAll}
          style={{
            padding: '10px 20px',
            background: '#0D1B2A',
            color: '#FAFAF7',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          Show all trades
        </button>
      </div>
    </div>
  );
}

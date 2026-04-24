// SAA-12 / SAA-16: FeedScreen component
// Renders the live congressional trade feed with client-side filtering by
// followed politicians (from onboarding) and a toggle to temporarily show
// all trades.
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
        <FilterEmptyState onShowAll={() => setShowAll(true)} />
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
function FilterEmptyState({ onShowAll }) {
  return (
    <div
      style={{
        padding: '32px 24px',
        textAlign: 'center',
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
          marginBottom: 8,
        }}
      >
        None of your followed politicians have recent filings.
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#6B7280',
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        Filings come in batches — check back in a day or two, or browse all
        recent trades for now.
      </div>
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
  );
}

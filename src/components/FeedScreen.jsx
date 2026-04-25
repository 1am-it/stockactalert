// SAA-12 / SAA-16 / SAA-18.1 / 1AM-25 / 1AM-26: FeedScreen component
// Renders the live congressional trade feed with client-side filtering by
// followed politicians (from onboarding) and a toggle to temporarily show
// all trades.
//
// 1AM-26: When the filter is active and at least one followed politician has
// a recent trade, the feed now also shows a collapsible "No recent activity"
// section listing followed politicians without recent activity, with their
// last-known trade date if available. This makes the feed feel complete:
// users see the active news first, with the rest one tap away.
//
// Active vs no-activity logic:
//   - Active = followed politician with at least one trade in current data
//   - Inactive = followed politician with zero trades in current data
//   - No-activity section only shown when there's at least 1 active politician;
//     when 0 active, the existing FilterEmptyState (chip-grid) handles it.
//   - List collapsed by default — expand via "Show N without recent activity".
//
// Copy intentionally avoids the word "quiet" (jargon, sounds like a
// person's behaviour) and "no trades in current snapshot" (sounds like
// "no trades today"). "No recent activity" is neutral and describes
// the data, not the politician.
//
// Filter behaviour:
//   - Default: filter trades by `followedPoliticians` (personalised view)
//   - Toggle "Show all": show unfiltered trades for current session
//
// Session-only state: refresh resets `showAll` and section to collapsed.
//
// Props:
//   followedPoliticians — array of politician names the user follows

import { useState, useMemo } from 'react';
import TradeCard from './TradeCard';
import { useTrades } from '../hooks/useTrades';

// How many chips to show in the empty state before requiring "View all"
const CHIPS_INITIAL = 3;

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

  // ── Compute active vs inactive split (1AM-26) ──────────────────────────────
  // For each followed politician: active if they have ≥1 trade in `trades`,
  // inactive otherwise. Last-trade date is best-effort from current data only.
  const { inactivePoliticians } = useMemo(() => {
    if (!filterActive) {
      return { inactivePoliticians: [] };
    }

    // Build a map of politician → most recent filed date in current data
    const lastFiledByPolitician = new Map();
    for (const trade of trades) {
      const existing = lastFiledByPolitician.get(trade.politician);
      if (!existing || trade.filedDate > existing) {
        lastFiledByPolitician.set(trade.politician, trade.filedDate);
      }
    }

    const inactive = [];
    for (const name of followedPoliticians) {
      if (!lastFiledByPolitician.has(name)) {
        inactive.push({ name, lastFiled: null });
      }
    }

    return { inactivePoliticians: inactive };
  }, [filterActive, trades, followedPoliticians]);

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
  const filterHasMatches = filterActive && visibleTrades.length > 0;
  const filterHasNoMatches = filterActive && visibleTrades.length === 0;

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

      {/* Filter active but zero matches → chip-grid empty state */}
      {filterHasNoMatches && (
        <FilterEmptyState
          followedPoliticians={followedPoliticians}
          onShowAll={() => setShowAll(true)}
        />
      )}

      {/* Filter inactive OR filter active with matches → render trades */}
      {!filterHasNoMatches &&
        visibleTrades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            onSetAlert={(t) => console.log('alert', t)}
            onViewProfile={(t) => console.log('profile', t)}
            onViewTicker={(t) => console.log('ticker', t)}
          />
        ))}

      {/* 1AM-26: no-recent-activity section
         Only shown when filter is active AND there's at least 1 active match. */}
      {filterHasMatches && inactivePoliticians.length > 0 && (
        <NoRecentActivitySection inactivePoliticians={inactivePoliticians} />
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
  const tradeWord = visibleCount === 1 ? 'TRADE' : 'TRADES';

  const label = filterActive
    ? `${visibleCount} RECENT ${tradeWord} FROM YOUR ${followedCount}`
    : hasFollowed
      ? 'SHOWING ALL RECENT TRADES'
      : `${visibleCount} RECENT ${tradeWord}`;

  const toggleLabel = filterActive ? 'Show all' : 'Show followed';

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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

      {/* Subtle scope subtitle — tells the user what "recent" means */}
      <div
        style={{
          fontSize: 11,
          color: '#9CA3AF',
          fontFamily: 'monospace',
          fontStyle: 'italic',
          marginTop: 4,
          padding: '0 2px',
        }}
      >
        Latest 50 STOCK Act filings from Senate + House
      </div>
    </div>
  );
}

// ── 1AM-26: No-recent-activity section ───────────────────────────────────────
// Collapsible list of followed politicians without trades in current data.
// Default collapsed; expand via toggle button.
function NoRecentActivitySection({ inactivePoliticians }) {
  const [expanded, setExpanded] = useState(false);
  const count = inactivePoliticians.length;
  const followingWord = count === 1 ? 'politician' : 'politicians';

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: '1px dashed #E5E7EB',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 600,
          color: '#6B7280',
          fontFamily: "'DM Sans', sans-serif",
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        {expanded
          ? 'Hide ↑'
          : `Show ${count} without recent activity ↓`}
      </button>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* Section heading */}
          <div
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#9CA3AF',
              marginBottom: 8,
              padding: '0 2px',
            }}
          >
            No recent activity
          </div>

          {/* Compact list of politicians */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {inactivePoliticians.map((p, i) => (
              <div
                key={p.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid #F3F4F6',
                  fontFamily: "'DM Sans', sans-serif",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0D1B2A',
                  }}
                >
                  {p.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: '#9CA3AF',
                    fontFamily: 'monospace',
                    textAlign: 'right',
                  }}
                >
                  {p.lastFiled
                    ? `last filed ${p.lastFiled}`
                    : 'no recent activity'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter empty state ────────────────────────────────────────────────────────
// Shown when filter is active but no followed politicians have recent trades.
// Includes a chip-grid showing *who* the user follows, with a "View all"
// toggle when the list exceeds CHIPS_INITIAL (3).
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
        Filings appear when they're submitted. None of the politicians you
        follow have a recent one — that's normal.
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
          {chipsExpanded ? 'View fewer' : `View all ${totalCount}`}
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
          Browse all trades
        </button>
      </div>
    </div>
  );
}

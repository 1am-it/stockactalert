// SAA-12 / SAA-16 / SAA-18.1 / 1AM-25 / 1AM-26 / 1AM-52: FeedScreen component
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
// 1AM-52: Filter-bar label clarified — replaced "FROM YOUR <count>" with
// "FROM POLITICIANS YOU FOLLOW". The previous label combined two numbers
// with different units (visible trades vs followed politicians) and read
// like a ratio. Singular handling preserved via the existing tradeWord
// ternary. The followedCount prop is left in place but unused in the
// label; the upcoming v6 redesign (1AM-66) replaces this filter-bar
// entirely so wider cleanup is deferred.
//
// Filter behaviour:
//   - Default: filter trades by `followedPoliticians` (personalised view)
//   - Toggle "Show all": show unfiltered trades for current session
//
// Session-only state: refresh resets `showAll` and section to collapsed.
//
// Props:
//   followedPoliticians     — array of politician names the user follows
//   onUnfollow              — callback (name) for chip × in FilterEmptyState (1AM-80)
//   onNavigateToPoliticians — callback to switch active tab (1AM-42 banner, 1AM-80 manage link)

import { useState, useMemo } from 'react';
import TradeCard from './TradeCard';
import FreshnessIndicator from './FreshnessIndicator';
import CapitolIllustration from './CapitolIllustration';
import { useTrades } from '../hooks/useTrades';

// How many chips to show in the empty state before requiring "View all"
const CHIPS_INITIAL = 3;

export default function FeedScreen({
  followedPoliticians = [],
  onUnfollow,
  onNavigateToPoliticians,
  onShowPoliticianDetail,
}) {
  const { trades, loading, error, refetch, lastUpdatedAt, newTradeCount } = useTrades();

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
      {/* 1AM-42: 0-follow recovery banner — shown above the feed when the
          user has nobody followed (e.g. after unfollowing all in Politicians
          tab). Doesn't replace the feed: "browse mode" trades still render
          below so the user can explore while deciding. */}
      {!hasFollowed && (
        <EmptyFollowedListBanner
          onNavigateToPoliticians={onNavigateToPoliticians}
        />
      )}

      {/* 1AM-38: Freshness indicator — dot only when stale, label, optional 'N new' badge,
          and "Updated X ago" pill. Tracks per-fetch state from useTrades. */}
      <FreshnessIndicator
        lastUpdatedAt={lastUpdatedAt}
        newTradeCount={newTradeCount}
      />

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
          onUnfollow={onUnfollow}
          onNavigateToPoliticians={onNavigateToPoliticians}
        />
      )}

      {/* Filter inactive OR filter active with matches → render trades */}
      {!filterHasNoMatches &&
        visibleTrades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            following={followedPoliticians.includes(trade.politician)}
            owner={trade.owner}
            onPoliticianClick={onShowPoliticianDetail}
            onSetAlert={(t) => console.log('alert', t)}
            onViewProfile={(t) => onShowPoliticianDetail?.(t.politician)}
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
  // 1AM-66: include followedCount explicitly in the active-filter label so
  // the user sees both numbers — how many trades visible AND how many
  // politicians they follow. Replaces "RECENT" framing with explicit count.
  const politicianWord = followedCount === 1 ? 'POLITICIAN' : 'POLITICIANS';

  const label = filterActive
    ? `${visibleCount} ${tradeWord} FROM THE ${followedCount} ${politicianWord} YOU FOLLOW`
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

      {/* Compact chamber-scope subtitle — 1AM-38: shortened from
          "Latest STOCK Act filings from Senate + House" because the
          freshness indicator above already conveys "latest" + scope. */}
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
        From Senate and House
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
//
// 1AM-80: chips have an inline × button to unfollow directly from the feed,
// and a "Manage politicians →" link below jumps to the Politicians tab.
function FilterEmptyState({
  followedPoliticians,
  onShowAll,
  onUnfollow,
  onNavigateToPoliticians,
}) {
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
      {/* 1AM-111: Capitol illustration anchors the empty state and gives it
          personality. Decorative — aria-hidden on the SVG itself. */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <CapitolIllustration size={140} />
      </div>

      {/* 1AM-111: Headline reframed from "None of your followed politicians..."
          to a calmer, more journalistic phrasing. Playfair to match other
          editorial headers (Welcome screen, page titles). */}
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 500,
          color: '#0D1B2A',
          marginBottom: 10,
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        No recent filings for the politicians you follow
      </div>

      {/* 1AM-111: 45-day disclosure-window explainer. Addresses the most
          common user question (is the app broken?) by surfacing the actual
          STOCK Act filing window. */}
      <div
        style={{
          fontSize: 13,
          color: '#6B7280',
          lineHeight: 1.55,
          textAlign: 'center',
          marginBottom: 22,
        }}
      >
        Stock Act filings can be submitted up to 45 days after a trade. This
        means recent activity may not yet be visible.
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
          marginBottom: showExpandToggle ? 12 : 16,
        }}
      >
        {visibleChips.map((name) => (
          <span
            key={name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 4px 4px 10px',
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
            {onUnfollow && (
              <button
                type="button"
                onClick={() => onUnfollow(name)}
                aria-label={`Unfollow ${name}`}
                title={`Unfollow ${name}`}
                style={{
                  width: 24,
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '50%',
                  color: '#9CA3AF',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {showExpandToggle && (
        <button
          onClick={() => setChipsExpanded((v) => !v)}
          style={{
            display: 'block',
            margin: '0 auto 16px',
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

      {/* ── Manage politicians link (1AM-80) ── */}
      {onNavigateToPoliticians && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button
            type="button"
            onClick={onNavigateToPoliticians}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: 12,
              fontWeight: 500,
              color: '#0D1B2A',
              textDecoration: 'underline',
              textDecorationColor: '#9CA3AF',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            Manage followed politicians →
          </button>
        </div>
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
          View all recent filings
        </button>
      </div>
    </div>
  );
}

// ── 1AM-42: Empty-followed-list recovery banner ─────────────────────────────
// Shown above the feed when the user has zero followed politicians but
// onboarding is already complete (i.e. they're in the main app, not in the
// onboarding flow). Provides a clear path back to following someone without
// being so aggressive as to force-redirect them away from the feed.
function EmptyFollowedListBanner({ onNavigateToPoliticians }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        padding: '24px 24px 28px',
        marginBottom: 20,
        textAlign: 'center',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          fontSize: 28,
          marginBottom: 12,
          color: '#9CA3AF',
        }}
      >
        ⌕
      </div>
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 20,
          fontWeight: 700,
          color: '#0D1B2A',
          margin: '0 0 6px 0',
        }}
      >
        You're not following anyone yet
      </h2>
      <p
        style={{
          fontSize: 14,
          color: '#6B7280',
          margin: '0 0 18px 0',
          lineHeight: 1.5,
          maxWidth: 380,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        Pick politicians to see their trades here. You can always change who you
        follow from the Politicians tab.
      </p>
      <button
        onClick={onNavigateToPoliticians}
        disabled={!onNavigateToPoliticians}
        style={{
          padding: '12px 24px',
          background: '#0D1B2A',
          color: '#FAFAF7',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif",
          cursor: onNavigateToPoliticians ? 'pointer' : 'default',
        }}
      >
        Choose politicians →
      </button>
    </div>
  );
}

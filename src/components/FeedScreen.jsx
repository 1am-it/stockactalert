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
//   onUnfollow              — toggle callback (name). Despite the legacy name,
//                             this is wired to togglePolitician in App.jsx and
//                             handles both follow + unfollow. Used by the
//                             1AM-145 Most Active embed for +Follow toggles.
//   onNavigateToPoliticians — callback to switch active tab (legacy, retained
//                             for prop-compat; 1AM-145 obsoleted the original
//                             EmptyFollowedListBanner / FilterEmptyState callers)
//   onShowPoliticianDetail  — navigate to politician detail page
//   onBrowseAll             — navigate to Browse-tab + scroll Recent Trades (1AM-145)
//   onManageFollowing       — navigate to Browse-tab + scroll Most Active (1AM-145
//                             Pad B; rewires to FollowedList screen when 1AM-28 ships)

import { useState, useMemo } from 'react';
import TradeCard from './TradeCard';
import FreshnessIndicator from './FreshnessIndicator';
import MostActivePoliticians from './MostActivePoliticians';
import FeedMetricsStrip from './FeedMetricsStrip';
import FeedEmptyHero from './FeedEmptyHero';
import { useTrades } from '../hooks/useTrades';
import { aggregateMostActivePoliticians } from '../lib/politicianAggregation';

// 1AM-145: thresholds for empty-state variant selection.
// 0           → 'empty-zero' (Pick a few politicians to follow)
// 1-9         → 'empty-low'  (All quiet — Following N — all set)
// 10+         → 'empty-high' (same shape as low, separate constant for future tuning)
const FOLLOW_VOLUME_HIGH = 10;

export default function FeedScreen({
  followedPoliticians = [],
  onUnfollow,
  onNavigateToPoliticians,
  onShowPoliticianDetail,
  onBrowseAll,
  // 1AM-145: temporary CTA for "Manage who you follow" — Pad B routes both
  // CTAs to Browse-tab with different scroll-anchors. When 1AM-28 ships
  // (FollowedList screen) this gets rewired to navigate there instead.
  onManageFollowing,
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

  // 1AM-145: empty-state variant selection.
  //   - 0 follows                                    → 'empty-zero' (regardless of trades)
  //   - has follows + filter active + 0 matches      → 'empty-low' or 'empty-high'
  //   - otherwise                                    → null (render trades normally)
  // Note: when showAll=true (user toggled "Show all"), the empty-state does
  // not fire even if visibleTrades is 0 — they explicitly chose to bypass
  // the filter, so we honour that and let the existing render-path handle it.
  const followingCount = followedPoliticians.length;
  let emptyVariant = null;
  if (followingCount === 0) {
    emptyVariant = 'empty-zero';
  } else if (filterActive && visibleTrades.length === 0) {
    emptyVariant = followingCount < FOLLOW_VOLUME_HIGH ? 'empty-low' : 'empty-high';
  }

  // 1AM-145: Most Active aggregation for the "While you wait" embed.
  // Aggregates from already-loaded trades — no separate cascade fetch like
  // BrowseAllFilingsScreen does. Acceptable simplification for v1: we use
  // whatever data useTrades has on hand. Window label communicates this
  // honestly ("recent" rather than a precise "this week").
  const mostActiveTopPoliticians = useMemo(() => {
    if (!emptyVariant) return []; // skip aggregation when not rendering empty-state
    return aggregateMostActivePoliticians(trades);
  }, [trades, emptyVariant]);

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

  // 1AM-145: when emptyVariant is set, render the new empty-state takeover
  // (metrics strip + hero + Most Active embed). Otherwise render the existing
  // FreshnessIndicator + FilterBar + TradeCards flow unchanged. The new path
  // intentionally does NOT show TradeCards — Lovable's v2 mockup design
  // decision is a clean takeover, not a banner-above-trades pattern.
  if (emptyVariant) {
    return (
      <div>
        <FeedMetricsStrip
          followingCount={followingCount}
          windowLabel="30d"
          lastUpdatedAt={lastUpdatedAt}
        />
        <FeedEmptyHero
          variant={emptyVariant}
          followingCount={followingCount}
          onBrowseAll={onBrowseAll}
          onManageFollowing={onManageFollowing}
        />
        {/* 1AM-145: "While you wait — Most Active" embed.
            Reuses the MostActivePoliticians component from Browse-tab. Window
            label "recent" reflects that we don't run a separate cascade fetch
            here — we aggregate from already-loaded trades. Acceptable v1
            simplification; can move to a shared cascade hook in a later
            iteration if user-feedback signals the precision matters. */}
        <MostActivePoliticians
          politicians={mostActiveTopPoliticians}
          loading={loading}
          windowLabel="recent"
          followedNames={followedPoliticians}
          onToggleFollow={onUnfollow}
        />
      </div>
    );
  }

  return (
    <div>
      {/* 1AM-38: Freshness indicator — dot only when stale, label, optional 'N new' badge,
          and "Updated X ago" pill. Tracks per-fetch state from useTrades. */}
      <FreshnessIndicator
        lastUpdatedAt={lastUpdatedAt}
        newTradeCount={newTradeCount}
      />

      {/* Filter indicator + toggle.
          1AM-112: `Show all` button now navigates to BrowseAllFilingsScreen
          (via onBrowseAll prop) instead of toggling in-place. The legacy
          in-place toggle (setShowAll) is kept as a fallback when onBrowseAll
          isn't wired — useful for any remaining in-app contexts that haven't
          adopted the new flow yet. */}
      <FilterBar
        filterActive={filterActive}
        hasFollowed={hasFollowed}
        followedCount={followedPoliticians.length}
        visibleCount={visibleTrades.length}
        onToggleShowAll={onBrowseAll || (() => setShowAll((v) => !v))}
        onRefresh={refetch}
      />

      {/* 1AM-145: previous EmptyFollowedListBanner (no follows) and
          FilterEmptyState (no matches) paths now collapse into the
          emptyVariant render branch above — when we reach this point,
          we have follows AND visible trades to render, OR the user
          explicitly hit "Show all" (showAll=true). */}

      {/* Render trades */}
      {visibleTrades.map((trade) => (
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

// ── 1AM-145 deletion note ────────────────────────────────────────────────────
// Two functions previously defined in this file have been removed:
//   - FilterEmptyState (1AM-26 / 1AM-80) — was rendered when filter active +
//     0 matches. Replaced by FeedEmptyHero variant 'empty-low' / 'empty-high'.
//   - EmptyFollowedListBanner (1AM-42) — was rendered above feed when 0 follows.
//     Replaced by FeedEmptyHero variant 'empty-zero' (clean takeover, no longer
//     a banner-above-trades pattern).
// Both removed deliberately during 1AM-145 to avoid dead-code drift. If a
// future ticket needs the chip-grid pattern from FilterEmptyState, the
// implementation lives in git history at commit prior to 1AM-145.

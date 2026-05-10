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
//   mutedPoliticians        — array of politician names the user has muted (1AM-28).
//                             Mute = relationship preserved, but Feed cards from
//                             that politician are suppressed. Filter applies in
//                             both filtered and showAll views — muting is an
//                             explicit "don't show me this person right now"
//                             decision that overrides the show-all toggle.
//   onUnfollow              — toggle callback (name). Despite the legacy name,
//                             this is wired to togglePolitician in App.jsx and
//                             handles both follow + unfollow. Used by the
//                             1AM-145 Most Active embed for +Follow toggles.
//   onNavigateToPoliticians — callback to switch active tab (legacy, retained
//                             for prop-compat; 1AM-145 obsoleted the original
//                             EmptyFollowedListBanner / FilterEmptyState callers)
//   onShowPoliticianDetail  — navigate to politician detail page
//   onBrowseAll             — navigate to Browse-tab + scroll Recent Trades (1AM-145)
//   onManageFollowing       — navigate to FollowedListScreen (1AM-28). Previously
//                             a Browse-tab scroll-anchor placeholder (1AM-145
//                             Pad B); rewired in 1AM-28 to navigate to the
//                             dedicated management screen.

import { useState, useMemo } from 'react';
import TradeCard from './TradeCard';
import MostActivePoliticians from './MostActivePoliticians';
import FilterSummaryLine from './FilterSummaryLine';
import FeedEmptyHero from './FeedEmptyHero';
import SectorActivityHeatmap from './SectorActivityHeatmap';
import { useTrades } from '../hooks/useTrades';
import { aggregateMostActivePoliticians } from '../lib/politicianAggregation';
import { findByName } from '../lib/congress';

// 1AM-145: thresholds for empty-state variant selection.
// 0           → 'empty-zero' (Pick a few politicians to follow)
// 1-9         → 'empty-low'  (All quiet — Following N — all set)
// 10+         → 'empty-high' (same shape as low, separate constant for future tuning)
const FOLLOW_VOLUME_HIGH = 10;

export default function FeedScreen({
  followedPoliticians = [],
  // 1AM-28: muted politicians list lifted to App.jsx (mutedPoliticians state),
  // passed in here so the Feed-tab filter excludes them. Mute applies in both
  // filterActive and showAll views — the user's mute decision overrides the
  // show-all toggle.
  mutedPoliticians = [],
  // 1AM-168: window from WatchHeader as single source of truth.
  // '24h' | '7d' | '30d' | '90d'. Filters visible trades by trade_date,
  // and propagates the label to FeedEmptyHero for window-driven copy.
  watchWindow = '30d',
  onUnfollow,
  onNavigateToPoliticians,
  onShowPoliticianDetail,
  onBrowseAll,
  // 1AM-28: rewired from the 1AM-145 Pad B scroll-anchor placeholder to
  // navigate directly to FollowedListScreen.
  onManageFollowing,
  // 1AM-169: hand-off to Explore-tab from the "Your most active" card's
  // "Explore all >" link. Lets the user see Most Active across full
  // Congress (escape hatch when Watch-tab is scoped to followed-only).
  onExploreAll,
  // 1AM-170: hand-off from Sector Heatmap row tap. v1 implementation
  // just navigates to Explore-tab without a preset sector-filter.
  // Pre-set filter wiring comes in a follow-up ticket (4b).
  onSectorTap,
}) {
  const { trades, loading, error, refetch, lastUpdatedAt, newTradeCount } = useTrades();

  // Whether to bypass the followed-filter for the current session
  const [showAll, setShowAll] = useState(false);

  const hasFollowed = followedPoliticians.length > 0;
  const filterActive = hasFollowed && !showAll;

  // 1AM-168: compute the cutoff date from the watch-window for trade
  // filtering. trade_date is ISO YYYY-MM-DD; sinceISO is the same format
  // for direct string comparison (lexicographic == chronological for ISO).
  const windowDays = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
  const sinceMs = Date.now() - (windowDays[watchWindow] || 30) * 24 * 60 * 60 * 1000;
  const sinceISO = new Date(sinceMs).toISOString().slice(0, 10);

  // 1AM-148: bioguideId-resolved set of currently-followed politicians.
  // Used by both visibleTrades and watchTrades (and by MostActivePoliticians
  // via prop) for a robust follow-state check that survives upstream
  // name-spelling drift (e.g. FMP "James E Hon Banks" vs directory canonical
  // "Jim Banks"). Names that don't resolve via findByName are silently
  // skipped — the name-string fallback covers those.
  const followedBioguideIds = useMemo(() => {
    const ids = new Set();
    for (const name of followedPoliticians) {
      const matches = findByName(name);
      if (matches.length > 0 && matches[0].bioguideId) {
        ids.add(matches[0].bioguideId);
      }
    }
    return ids;
  }, [followedPoliticians]);

  // 1AM-169 hotfix: shared "is this trade from a followed politician?" check.
  // Both visibleTrades (drives empty-state and TradeCards) and watchTrades
  // (drives Most Active) must use this — otherwise a trade that resolves
  // only via bioguideId fallback shows up in Most Active while the
  // empty-state still claims "0 filings". This was the Jim Banks / James
  // E Hon Banks bug observed on 2026-05-10.
  const followedSet = new Set(followedPoliticians);
  const isFollowedTrade = (t) => {
    if (followedSet.has(t.politician)) return true;
    const matches = findByName(t.politician);
    const bid = matches[0]?.bioguideId;
    return Boolean(bid && followedBioguideIds.has(bid));
  };

  // Apply the followed-filter client-side, then strip muted politicians,
  // then apply the watch-window cutoff. Order matters for performance —
  // the cheapest filter (Set membership) runs first.
  const visibleTrades = (
    filterActive ? trades.filter(isFollowedTrade) : trades
  )
    .filter((t) => !mutedPoliticians.includes(t.politician))
    .filter((t) => !t.tradeDate || t.tradeDate >= sinceISO);

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

  // 1AM-169: Most Active is scoped to followed-only + window — the Watch-tab
  // is the user's personal monitoring view. Cross-Congress discovery moves
  // to Explore-tab via the "Explore all >" link in the card header. Same
  // isFollowedTrade helper as visibleTrades — keeps both filters in lock-step.
  const watchTrades = useMemo(() => {
    return trades.filter((t) => {
      if (t.tradeDate && t.tradeDate < sinceISO) return false;
      return isFollowedTrade(t);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, followedPoliticians, followedBioguideIds, sinceISO]);

  const mostActiveTopPoliticians = useMemo(() => {
    return aggregateMostActivePoliticians(watchTrades);
  }, [watchTrades]);

  // 1AM-169: hasUnfollowedInTopN obsolete — Watch's Most Active is scoped
  // to followed-only, so by definition every entry is already followed.
  // Render is gated only on "do we have any data at all" (component itself
  // returns null on empty). The legacy 1AM-151 discovery-hint behaviour
  // moves to Explore-tab where it makes sense.

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

  // 1AM-145: when emptyVariant is set, render the new empty-state takeover.
  // 1AM-168: FeedMetricsStrip removed — header chrome moved to WatchHeader.
  // 1AM-169:
  //   - empty-zero (no follows): hero alone — Most Active embed dropped here.
  //     Discovery for not-yet-following users moves to Explore-tab. Showing
  //     it inside the Watch-tab "0 follows" state would duplicate Explore.
  //   - empty-low / empty-high (has follows but quiet window): hero + the
  //     "Your most active" card scoped to the user's follows. The card
  //     itself returns null when there are no followed-trades in the window
  //     (MostActivePoliticians bails on length===0), so this slot quietly
  //     disappears in long quiet stretches — that's intentional.
  if (emptyVariant) {
    return (
      <div>
        <FeedEmptyHero
          variant={emptyVariant}
          followingCount={followingCount}
          watchWindow={watchWindow}
          onBrowseAll={onBrowseAll}
          onManageFollowing={onManageFollowing}
        />
        {emptyVariant !== 'empty-zero' && (
          <>
            <YourMostActiveCard
              politicians={mostActiveTopPoliticians}
              loading={loading}
              watchWindow={watchWindow}
              followedNames={followedPoliticians}
              followedBioguideIds={followedBioguideIds}
              onToggleFollow={onUnfollow}
              onExploreAll={onExploreAll}
            />
            {/* 1AM-170: Sector Heatmap also renders in empty-state when
                there ARE sector activity in the window — the empty-state's
                "0 filings" message is about visible TradeCards, not about
                whether sector data exists. Auto-hides when no sector data.
                For empty-zero (no follows): no sector data possible, skip. */}
            <SectorActivityHeatmap
              trades={watchTrades}
              windowLabel={watchWindow}
              onSectorTap={onSectorTap}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* 1AM-168: FreshnessIndicator + FilterBar removed.
          - "Last update N min ago" + tap-to-refresh moved into WatchHeader
            (1AM-168). Newtrade-count badge dropped — the timestamp itself
            is the dominant freshness signal, the badge added little.
          - FilterBar's "Show all" toggle was already routed to Explore-tab
            (1AM-112); the only remaining FilterBar duty was the filter-status
            label + refresh, both now redundant. Watch-tab is by definition
            scoped to followed-politicians + window — no toggle needed.
          - The "Show all" alternative path lives on Explore-tab. */}

      {/* Render trades — already filtered by followed + muted + window above. */}
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

      {/* 1AM-169: "Your most active" — scoped to followed politicians within
          the current watch-window. Renders below the feed (and the inactive
          section if present) so the trades stay primary. The component itself
          returns null when there are no entries — no need for an outer gate.
          The 1AM-151 hasUnfollowedInTopN gate is gone: by definition every
          entry in the scoped Most Active is followed. Cross-Congress
          discovery moves to Explore-tab via the "Explore all >" link. */}
      <div style={{ marginTop: 24 }}>
        <YourMostActiveCard
          politicians={mostActiveTopPoliticians}
          loading={loading}
          watchWindow={watchWindow}
          followedNames={followedPoliticians}
          followedBioguideIds={followedBioguideIds}
          onToggleFollow={onUnfollow}
          onExploreAll={onExploreAll}
        />
      </div>

      {/* 1AM-170: Sector Heatmap renders below Your most active when there's
          sector activity to show. Auto-hides when no data — no placeholder. */}
      <SectorActivityHeatmap
        trades={watchTrades}
        windowLabel={watchWindow}
        onSectorTap={onSectorTap}
      />
    </div>
  );
}

// ── Your most active card (1AM-169) ──────────────────────────────────────────
// Watch-tab wrapper around MostActivePoliticians with Watch-specific copy
// and the "Explore all >" escape hatch. Kept as a thin wrapper so the
// underlying component stays reusable for Browse-tab (where the original
// Browse-tab card-title "Most Active" + windowLabel pill behaviour lives).
function YourMostActiveCard({
  politicians,
  loading,
  watchWindow,
  followedNames,
  followedBioguideIds,
  onToggleFollow,
  onExploreAll,
}) {
  // Window-driven subtitle copy. Mirrors the empty-state "filings today/this
  // week/this month/in 90 days" pattern but in past-tense framing for active
  // window data.
  const subtitleByWindow = {
    '24h': 'Followed politicians · last 24h',
    '7d': 'Followed politicians · last 7d',
    '30d': 'Followed politicians · last 30d',
    '90d': 'Followed politicians · last 90d',
  };
  const cardSubtitle = subtitleByWindow[watchWindow] || 'Followed politicians';

  return (
    <MostActivePoliticians
      politicians={politicians}
      loading={loading}
      followedNames={followedNames}
      followedBioguideIds={followedBioguideIds}
      onToggleFollow={onToggleFollow}
      cardTitle="Your most active"
      cardSubtitle={cardSubtitle}
      onExploreAll={onExploreAll}
    />
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
  // 1AM-153 phase 4: replace bespoke monospace-uppercase label with
  // FilterSummaryLine for unified treatment across Browse + Feed.
  // Folded UX requirement from 1AM-151 phase 4 smoke test: in Show-all
  // mode, communicate that the user is now seeing the broader Congress
  // universe instead of just their followed politicians.
  //
  // Two states drive contextParts:
  //   - filterActive (Followed): "from the N politicians you follow"
  //   - !filterActive (Show all): "from all politicians"
  // FollowedCount is included in the followed-mode label because the
  // existing 1AM-66 design surfaces both numbers (trades visible + politicians
  // followed) — preserved behaviour, new typography.
  const politicianWord = followedCount === 1 ? 'politician' : 'politicians';
  const contextParts = filterActive
    ? [`from the ${followedCount} ${politicianWord} you follow`]
    : ['from all politicians'];

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
        <FilterSummaryLine
          count={visibleCount}
          noun="trade"
          contextParts={contextParts}
        />

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

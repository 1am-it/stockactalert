// 1AM-112: BrowseAllFilingsScreen — dedicated browse experience
//
// 1AM-124: Promoted from full-screen overlay to top-level tab. Header
// pattern updated:
//   - Old: ← Back to feed link + "Browse All Filings" h1 + description
//   - New: HeaderBar component (title "Browse" + gear icon top-right)
// `onBack` prop kept for backwards compat — App.jsx still passes it (now
// switches to feed-tab on tap if anything calls it programmatically), but
// the link itself is gone from the UI.
//
// Originally reached from two entry points:
//   1. FilterBar `Show all` button on Personal feed (deprecates the old toggle)
//   2. `View all recent filings` CTA in FilterEmptyState (1AM-111)
// 1AM-124 makes the bottom-nav Browse-tab a third entry point, and the
// primary one going forward.
//
// Architecture: page-style header (matching Your Feed / Politicians visual
// language) + search input + chamber/action chips + trade list. No TabBar
// while browsing — App.jsx renders this as an overlay, similar to the
// PoliticianDetailScreen overlay (1AM-69).
//
// Search heuristic (per ticket 1AM-112):
//   - Query in ALL CAPS, length 2-5, no spaces → treated as ticker symbol
//     (e.g. "NVDA", "AAPL"). Sent as `?ticker=...` to /api/trades.
//   - Otherwise → treated as politicus name substring. Sent as
//     `?politician=...` to /api/trades.
//   - Empty query → no search filter, fetch latest 50.
//
// Filter heuristic:
//   - Chamber + action filters are applied CLIENT-SIDE on the fetched
//     dataset. The 50-trade cap means we don't need backend-side filtering
//     for these — the data is small enough to filter in JS.
//   - Search is sent to backend (politician/ticker query params) because
//     /api/trades supports them natively and it scopes results before they
//     hit the client.
//   - 1AM-114: time-period filter is sent to backend as `since` query param,
//     filtering trade_date >= since. Server-side because the chip can narrow
//     results below the 50-trade page (e.g. Past 30d when only 12 of 50 trades
//     fall in window).
//
// 1AM-114 Load more: pagination state lives locally in this component (not in
// useTrades) because pagination is Browse-specific. Other consumers of
// useTrades (FeedScreen, DiscoveryFeed, PoliticianDetailScreen) don't need
// it. Load more fetches /api/trades?offset=N directly and appends to a local
// extraTrades array. hasMore is heuristic: true while last batch === pageSize.
//
// Props:
//   onBack           — legacy callback (1AM-112). 1AM-124: still passed by
//                      App.jsx but no longer reachable via UI link. Kept for
//                      potential future use (e.g. programmatic "go back to
//                      feed" calls from empty-state CTAs).
//   onSettingsClick  — 1AM-124: opens SettingsScreen overlay via the gear
//                      icon in HeaderBar.

import { useState, useEffect, useMemo, useCallback } from 'react';
import TradeCard from './TradeCard';
import SingleChipGroup from './SingleChipGroup';
import HeaderBar from './HeaderBar';
import TrendingTickers from './TrendingTickers';
import MostActivePoliticians from './MostActivePoliticians';
import FilterSheet from './FilterSheet';
import { useTrades } from '../hooks/useTrades';
import { findByName } from '../lib/congress';
import { formatRelativeTime } from '../lib/relativeTime';

const SEARCH_DEBOUNCE_MS = 250;
// Pattern: 2-5 uppercase letters, no spaces. Matches ticker conventions.
const TICKER_PATTERN = /^[A-Z]{2,5}$/;

// 1AM-114: page size for Load more pagination. Matches the backend default
// limit so the "hasMore = batch.length === PAGE_SIZE" heuristic is reliable.
const PAGE_SIZE = 50;

// 1AM-114: hardcoded archive activation date for the end-of-archive message.
// Matches ARCHIVE_ACTIVATION_DATE in api/trades/stats.js. If the archive ever
// migrates to a new backing store, update both constants in lockstep.
const ARCHIVE_START_LABEL = 'May 1, 2026';
// 1AM-114: short form for the footer copy ("47 of 312 · since May 2026").
const ARCHIVE_START_MONTH_LABEL = 'May 2026';

const CHAMBER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'senate', label: 'Senate' },
  { value: 'house', label: 'House' },
];

const ACTION_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];

const TIME_PERIOD_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'past7d', label: 'Past 7d' },
  { value: 'past30d', label: 'Past 30d' },
  { value: 'past90d', label: 'Past 90d' },
  { value: 'pastYear', label: 'Past year' },
];

const TIME_PERIOD_DAYS = {
  past7d: 7,
  past30d: 30,
  past90d: 90,
  pastYear: 365,
};

function computeSince(timePeriod) {
  if (timePeriod === 'all') return null;
  const days = TIME_PERIOD_DAYS[timePeriod];
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

// 1AM-112: sort options. "Newest" matches the default API order; "Largest"
// uses the amount range midpoint estimate for ordering.
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'largest', label: 'Largest amount' },
];

// 1AM-124 fase 5: Trending Tickers — adaptive window strategy.
// The archive is fresh (started 2026-05-01) and STOCK Act filings have weeks
// of latency between trade_date and filed_date. Past 7 days will be empty for
// months. Rather than hide Trending or show a permanent empty state, we cascade
// through tiers: try 7d, fall back to 30d, fall back to all-time. The window
// label updates to match. As the archive matures, the 7d tier will naturally
// take over.
//
// MIN_TICKERS_THRESHOLD = 3: a Trending list with 1-2 tickers feels thin —
// "trending" implies a pattern, not a one-off. So we wait until at least 3
// distinct tickers exist in a window before declaring it the live one.
const TRENDING_FETCH_LIMIT = 500;
const TRENDING_TOP_N = 5;
const TRENDING_MIN_TICKERS = 3;
const TRENDING_TIERS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: null, label: 'all time' }, // null = no `since` filter
];

// 1AM-124 fase 5: Compute YYYY-MM-DD date string `n` days ago.
// Used by Trending Tickers tier-cascade. null `n` returns null (all-time).
function computeSinceDaysAgo(n) {
  if (n === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// 1AM-124 fase 5: Aggregate trades by ticker, return top N most-traded.
// Empty/null tickers are skipped so we don't surface "" as a "top ticker".
// Stable order: ties broken by ticker symbol alphabetically (deterministic
// across renders and useful for any future snapshot tests).
function aggregateTopTickers(trades, topN = TRENDING_TOP_N) {
  if (!Array.isArray(trades) || trades.length === 0) return [];
  const counts = new Map();
  for (const t of trades) {
    const ticker = (t.ticker || '').trim();
    if (!ticker) continue;
    counts.set(ticker, (counts.get(ticker) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([ticker, count]) => ({ ticker, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.ticker.localeCompare(b.ticker);
    })
    .slice(0, topN);
}

// 1AM-124 fase 6: Most Active Politicians configuration.
// Same adaptive-window cascade as Trending Tickers — re-uses the tier
// definitions and threshold so behaviour is consistent across both sections.
const MOST_ACTIVE_TOP_N = 3;
const MOST_ACTIVE_MIN_POLITICIANS = 3;

// 1AM-124 fase 6: Aggregate trades by politician, return top N most-active.
// Resolves each trade.politician to a Member object via findByName cascade
// (1AM-67 / 1AM-68 / 1AM-109) — same name-resolution logic the rest of the
// app uses, so legacy aliases ("Bernie Sanders" → "Bernard Sanders") collapse
// to one bucket.
//
// When findByName fails (rare — politician not in directory), we still count
// the trade under the raw name with party/chamber from the trade record. The
// row will render with a generic avatar and no state/bioguideId, but the
// activity signal isn't lost. Set bioguideId to null in that case so the
// React key is deterministic.
//
// initials are derived from "First Last" → "FL" or "F" if single token.
// trade.party / trade.chamber are used as Member fallbacks when the directory
// resolve fails.
function deriveInitials(fullName) {
  if (!fullName || typeof fullName !== 'string') return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function aggregateMostActivePoliticians(trades, topN = MOST_ACTIVE_TOP_N) {
  if (!Array.isArray(trades) || trades.length === 0) return [];

  // Bucket by resolved bioguideId when possible; fall back to raw name as key
  // if directory lookup fails. The bucket key is a string either way so Map
  // works uniformly.
  const buckets = new Map(); // key → { name, bioguideId, party, chamber, state, count, initials }

  for (const t of trades) {
    const rawName = (t.politician || '').trim();
    if (!rawName) continue;

    const matches = findByName(rawName);
    const member = Array.isArray(matches) && matches.length > 0 ? matches[0] : null;

    const key = member?.bioguideId || rawName;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    // Prefer Member directory data (canonical name, state, bioguideId);
    // fall back to trade-level fields when directory lookup failed.
    const displayName = member?.name || rawName;
    buckets.set(key, {
      name: displayName,
      bioguideId: member?.bioguideId || null,
      party: member?.party || t.party || null,
      chamber: member?.chamber || t.chamber || '',
      state: member?.state || '',
      count: 1,
      initials: deriveInitials(displayName),
    });
  }

  return Array.from(buckets.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      // Stable tiebreaker: alphabetical by name.
      return a.name.localeCompare(b.name);
    })
    .slice(0, topN);
}

// Inline copy of the amount-midpoint parser used in PoliticianDetailScreen.
// Duplicated here to keep this delivery scope-tight; should be DRY-ed into
// src/lib/amountParse.js when next touched.
function parseAmountMidpoint(amountStr) {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  const cleaned = amountStr.replace(/[$,]/g, '').replace(/–|—/g, '-');
  const parts = cleaned.split('-').map((s) => s.trim());
  const parseSingle = (s) => {
    if (!s) return 0;
    const trimmed = s.trim().toUpperCase();
    const num = parseFloat(trimmed);
    if (isNaN(num)) return 0;
    if (trimmed.includes('M')) return num * 1_000_000;
    if (trimmed.includes('K')) return num * 1_000;
    return num;
  };
  if (parts.length !== 2) return parseSingle(parts[0]);
  return (parseSingle(parts[0]) + parseSingle(parts[1])) / 2;
}

export default function BrowseAllFilingsScreen({
  onBack,
  onSettingsClick,
  // 1AM-124 fase 6: follow-state passed in from App so Most Active rows can
  // toggle politicians via the same `selected` follows state used by Feed.
  followedPoliticians = [],
  onTogglePolitician,
}) {
  // Local UI state — not persisted across sessions per ticket scope ("Browse
  // is a stateless utility for v1").
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [chamberFilter, setChamberFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  // 1AM-124 fase 8: default changed from 'all' to 'past30d'. Browse-tab is
  // a recency-driven discovery view (consistent with Trending Tickers and
  // Most Active sections which also surface ~30-day windows via cascade).
  // Users can still pick "All time" via the filter sheet.
  const [timePeriod, setTimePeriod] = useState('past30d');
  // 1AM-112: sort order. Default 'newest' matches API order.
  const [sortOrder, setSortOrder] = useState('newest');
  // 1AM-124 fase 8: filter sheet open/close state. The secondary filters
  // (Chamber, Time period, Sort) live behind a "More filters →" link to keep
  // the main view clean. Direction chips (Action) and the This week pill stay
  // on the main view as quick toggles.
  const [isShowingFilters, setIsShowingFilters] = useState(false);

  // 1AM-114: pagination state for Load more.
  // - extraTrades = trades fetched via Load more (appended to useTrades' first page)
  // - loadingMore = button disabled state during in-flight fetch
  // - hasMore = heuristic, true while last fetched batch === PAGE_SIZE
  const [extraTrades, setExtraTrades] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 1AM-114: archive total for the footer copy. Fetched once on mount from
  // /api/trades/stats. null while loading or on error → footer falls back
  // to a copy without the "of N" total.
  const [archiveTotal, setArchiveTotal] = useState(null);

  // Debounce the search input to avoid hitting the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 1AM-114: fetch archive total once on mount for the footer copy. Silent
  // failure — footer falls back to a copy without total when archiveTotal
  // stays null.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/trades/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.total === 'number') {
          setArchiveTotal(data.total);
        }
      })
      .catch(() => {
        // Silent — fallback footer copy is acceptable
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Translate the debounced search into a backend filter. Ticker pattern
  // detection runs against the raw (non-uppercased) input — we don't auto-
  // uppercase because that would make every short query a ticker search.
  // 1AM-114: also forward `since` derived from the time-period chip.
  const searchFilters = useMemo(() => {
    const base = {};
    if (debouncedSearch) {
      if (TICKER_PATTERN.test(debouncedSearch)) {
        base.ticker = debouncedSearch;
      } else {
        base.politician = debouncedSearch;
      }
    }
    const since = computeSince(timePeriod);
    if (since) {
      base.since = since;
    }
    return base;
  }, [debouncedSearch, timePeriod]);

  const { trades, loading, error, refetch, lastUpdatedAt, newTradeCount } =
    useTrades(searchFilters);

  // 1AM-124 fase 5: Trending Tickers — adaptive window cascade.
  // Three useTrades calls (7d / 30d / all-time), each cached separately by
  // /api/trades CDN headers. We pick the first tier that yields >= MIN_TICKERS
  // distinct tickers, and surface the matching label so the UI is honest about
  // which window is showing. As the archive matures (more recent filings), the
  // 7d tier will start meeting the threshold and the cascade becomes a no-op.
  //
  // Memoised separately so each filter object has stable identity — otherwise
  // useTrades' deps would re-stringify on every render.
  const trendingFilters7d = useMemo(
    () => ({ since: computeSinceDaysAgo(7), limit: TRENDING_FETCH_LIMIT }),
    []
  );
  const trendingFilters30d = useMemo(
    () => ({ since: computeSinceDaysAgo(30), limit: TRENDING_FETCH_LIMIT }),
    []
  );
  const trendingFiltersAllTime = useMemo(
    () => ({ limit: TRENDING_FETCH_LIMIT }),
    []
  );

  const { trades: trending7dTrades, loading: trending7dLoading } =
    useTrades(trendingFilters7d);
  const { trades: trending30dTrades, loading: trending30dLoading } =
    useTrades(trendingFilters30d);
  const { trades: trendingAllTrades, loading: trendingAllLoading } =
    useTrades(trendingFiltersAllTime);

  // Pick the first tier with enough distinct tickers. Cascade: 7d → 30d →
  // all-time. If even all-time is below threshold, fall back to all-time
  // anyway (rare; only when archive is genuinely tiny) — better to show what
  // we have than to hide.
  //
  // 1AM-124 fase 6: Most Active Politicians uses the SAME fetched trade sets
  // (re-aggregated by politician instead of ticker). Each section evaluates
  // its own threshold against its own aggregation, so the selected tier may
  // differ between Trending and MostActive — e.g. 30d has 5 distinct tickers
  // but only 2 distinct politicians, so Trending shows 30d while MostActive
  // falls through to all-time. Independent labels reflect that.
  const {
    trendingTopTickers,
    trendingWindowLabel,
    trendingLoading,
    mostActivePoliticians,
    mostActiveWindowLabel,
    mostActiveLoading,
  } = useMemo(() => {
    // Trending tiers
    const trendingTier7d = aggregateTopTickers(trending7dTrades, TRENDING_TOP_N);
    const trendingTier30d = aggregateTopTickers(trending30dTrades, TRENDING_TOP_N);
    const trendingTierAll = aggregateTopTickers(trendingAllTrades, TRENDING_TOP_N);

    // Most Active tiers (same trades, different aggregator)
    const activeTier7d = aggregateMostActivePoliticians(trending7dTrades, MOST_ACTIVE_TOP_N);
    const activeTier30d = aggregateMostActivePoliticians(trending30dTrades, MOST_ACTIVE_TOP_N);
    const activeTierAll = aggregateMostActivePoliticians(trendingAllTrades, MOST_ACTIVE_TOP_N);

    // Show loading if all three fetches are still in flight on first paint.
    const stillLoading =
      trending7dLoading && trending30dLoading && trendingAllLoading;

    // Trending cascade
    let trendingPick;
    if (trendingTier7d.length >= TRENDING_MIN_TICKERS) {
      trendingPick = { tickers: trendingTier7d, label: TRENDING_TIERS[0].label };
    } else if (trendingTier30d.length >= TRENDING_MIN_TICKERS) {
      trendingPick = { tickers: trendingTier30d, label: TRENDING_TIERS[1].label };
    } else {
      trendingPick = { tickers: trendingTierAll, label: TRENDING_TIERS[2].label };
    }

    // Most Active cascade (independent of Trending pick)
    let activePick;
    if (activeTier7d.length >= MOST_ACTIVE_MIN_POLITICIANS) {
      activePick = { politicians: activeTier7d, label: TRENDING_TIERS[0].label };
    } else if (activeTier30d.length >= MOST_ACTIVE_MIN_POLITICIANS) {
      activePick = { politicians: activeTier30d, label: TRENDING_TIERS[1].label };
    } else {
      activePick = { politicians: activeTierAll, label: TRENDING_TIERS[2].label };
    }

    return {
      trendingTopTickers: trendingPick.tickers,
      trendingWindowLabel: trendingPick.label,
      trendingLoading: stillLoading,
      mostActivePoliticians: activePick.politicians,
      mostActiveWindowLabel: activePick.label,
      mostActiveLoading: stillLoading,
    };
  }, [
    trending7dTrades,
    trending30dTrades,
    trendingAllTrades,
    trending7dLoading,
    trending30dLoading,
    trendingAllLoading,
  ]);

  // 1AM-114: reset pagination state whenever backend filters change. useTrades
  // refetches the first page on filter change; we drop any appended extra
  // pages so they don't blend pages from different filter sets.
  const filtersKey = JSON.stringify(searchFilters);
  useEffect(() => {
    setExtraTrades([]);
    setHasMore(true);
  }, [filtersKey]);

  // 1AM-114: combine first-page trades (from useTrades) with appended extra
  // pages. Order preserved — useTrades' first page first, then extras in
  // load order. Client-side filter/sort runs over the combined array below.
  //
  // 1AM-114 dedup: backend sort by trade_date desc has no tiebreaker, so on a
  // page boundary the same row can appear in two consecutive pages when
  // multiple trades share the trade_date. Frontend dedup by trade.id is a
  // defensive cap; root-cause fix (backend secondary sort) is tracked
  // separately.
  const allFetchedTrades = useMemo(() => {
    const combined = [...(trades || []), ...extraTrades];
    const seen = new Set();
    return combined.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [trades, extraTrades]);

  // Client-side chamber + action filters layered on top of the fetched set,
  // then sorted per sortOrder.
  const visibleTrades = useMemo(() => {
    const filtered = allFetchedTrades.filter((t) => {
      if (chamberFilter !== 'all') {
        // trade.chamber is "Senate" or "House" (titlecased upstream). Compare
        // case-insensitively to be safe across data sources.
        if ((t.chamber || '').toLowerCase() !== chamberFilter) return false;
      }
      if (actionFilter !== 'all') {
        // trade.action is "Purchase" or "Sale" in our schema. Map the chip
        // values onto these.
        const isBuy = t.action === 'Purchase';
        if (actionFilter === 'buy' && !isBuy) return false;
        if (actionFilter === 'sell' && isBuy) return false;
      }
      return true;
    });

    // 1AM-112: sort. 'newest' keeps API order (most-recently-filed first).
    // 'largest' sorts by amount midpoint descending — cheap proxy for
    // "noteworthy" trades. Returns a new array (don't mutate the slice).
    if (sortOrder === 'largest') {
      return [...filtered].sort(
        (a, b) => parseAmountMidpoint(b.amount) - parseAmountMidpoint(a.amount)
      );
    }
    return filtered;
  }, [allFetchedTrades, chamberFilter, actionFilter, sortOrder]);

  // 1AM-114: fetch the next page of trades and append them to extraTrades.
  // Offset is the count of already-fetched backend rows (NOT the visible
  // count, which is post-client-filter). Silent failure on error: existing
  // trades stay rendered; user can retry by clicking again.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (searchFilters.ticker) params.set('ticker', searchFilters.ticker);
      if (searchFilters.politician) params.set('politician', searchFilters.politician);
      if (searchFilters.since) params.set('since', searchFilters.since);
      params.set('limit', String(PAGE_SIZE));
      const offset = (trades?.length || 0) + extraTrades.length;
      params.set('offset', String(offset));

      const res = await fetch(`/api/trades?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const fetched = Array.isArray(data.trades) ? data.trades : [];

      setExtraTrades((prev) => [...prev, ...fetched]);
      setHasMore(fetched.length === PAGE_SIZE);
    } catch (err) {
      console.error('loadMore failed', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, searchFilters, trades, extraTrades]);

  // 1AM-124 fase 8: timePeriod default changed to 'past30d', so the active
  // filter check now compares against the new default. "Active" means user
  // changed it from default, not that it isn't 'all'.
  const hasActiveFilter =
    chamberFilter !== 'all' ||
    actionFilter !== 'all' ||
    timePeriod !== 'past30d' ||
    debouncedSearch !== '';

  const resetFilters = () => {
    setSearchInput('');
    setChamberFilter('all');
    setActionFilter('all');
    // 1AM-124 fase 8: reset matches new default, not 'all'.
    setTimePeriod('past30d');
    setSortOrder('newest');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '20px 24px 60px',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        {/* 1AM-124: HeaderBar replaces the old `← Back to feed` link + h1 +
            description. Browse is now a top-level tab, so there's nothing to
            navigate "back" to from a UI perspective. The gear icon top-right
            opens SettingsScreen overlay. */}
        <HeaderBar
          title="Browse"
          onSettingsClick={onSettingsClick}
        />

        {/* ── Trending Tickers (1AM-124 fase 5) ─────────────────────────── */}
        {/* Top 5 most-traded tickers via adaptive window cascade
            (7d → 30d → all-time). windowLabel reflects the actual tier that
            met the minimum-tickers threshold so the UI is honest about which
            slice of the archive is displayed. Independent of the search/filter
            state below — Trending is a discovery signal, not a filtered view. */}
        <TrendingTickers
          tickers={trendingTopTickers}
          loading={trendingLoading}
          windowLabel={trendingWindowLabel}
        />

        {/* ── Most Active Politicians (1AM-124 fase 6) ──────────────────── */}
        {/* Top 3 most-active politicians via the same adaptive window cascade
            as Trending (re-aggregated by politician). Each row has a Follow
            toggle wired to the App-level `selected` follows state. windowLabel
            may differ from Trending's because the threshold is checked against
            distinct politicians, not distinct tickers. */}
        <MostActivePoliticians
          politicians={mostActivePoliticians}
          loading={mostActiveLoading}
          windowLabel={mostActiveWindowLabel}
          followedNames={followedPoliticians}
          onToggleFollow={onTogglePolitician}
        />

        {/* ── Search input ────────────────────────────────────────────────── */}
        {/* Single text input. Type ticker in ALL CAPS for ticker search,
            otherwise treated as politicus name substring. */}
        <div
          style={{
            position: 'relative',
            marginBottom: 14,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9CA3AF',
              fontSize: 14,
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by politician or stock…"
            aria-label="Search filings by politician name or stock ticker"
            style={{
              width: '100%',
              padding: '10px 12px 10px 32px',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              fontSize: 13,
              color: '#0D1B2A',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── Filter row (1AM-124 fase 8) ──────────────────────────────── */}
        {/* Direction chips on the left (replaces the old "Action" row),
            This week pill on the right, "More filters →" link below
            right-aligned. Chamber, Time period, and Sort moved to the
            FilterSheet bottom-sheet (rendered at the end of this component). */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          {/* Direction chips: All / Buy / Sell. Reuses ACTION_OPTIONS +
              SingleChipGroup for consistency. The chip group renders without
              a label (label="" hides the uppercase header that other groups
              show). */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <SingleChipGroup
              label=""
              options={ACTION_OPTIONS}
              value={actionFilter}
              onChange={setActionFilter}
            />
          </div>

          {/* This week pill — independent shortcut for past7d (1AM-124 fase 8,
              decision B from architecture review). Tap toggles between
              past7d and past30d (the default). The pill's "active" visual
              state is derived from timePeriod === 'past7d', not from a
              separate boolean — single source of truth.

              Visual contract: navy-fill pill when active, outline pill when
              inactive. Same visual language as a SingleChipGroup chip. */}
          <button
            type="button"
            onClick={() => {
              // Last action wins. Tap pill → toggle between past7d and the
              // default (past30d). When user picks something else via the
              // sheet, pill goes inactive automatically because timePeriod
              // is no longer 'past7d'.
              setTimePeriod((prev) =>
                prev === 'past7d' ? 'past30d' : 'past7d'
              );
            }}
            aria-pressed={timePeriod === 'past7d'}
            style={{
              background: timePeriod === 'past7d' ? '#0D1B2A' : '#FFFFFF',
              color: timePeriod === 'past7d' ? '#FAFAF7' : '#0D1B2A',
              border: '1px solid #0D1B2A',
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            This week
          </button>
        </div>

        {/* "More filters →" link — opens the FilterSheet with the secondary
            filters (Chamber, Time period, Sort). Right-aligned, modest
            text-link style. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => setIsShowingFilters(true)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: 12,
              color: '#6B7280',
              textDecoration: 'underline',
              textDecorationColor: '#9CA3AF',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            More filters →
          </button>
        </div>

        {/* ── Recent Trades section header (1AM-124 fase 7) ─────────────── */}
        {/* Cosmetic header that frames the filings-list as its own section,
            parallel to Trending Tickers and Most Active above. No right-side
            label like the other two sections — Recent Trades is filtered by
            the user's chips, not by a fixed window, so a window-label would
            be misleading. The result-count + freshness pill below stays as
            the live stats-strip for this section. */}
        <h2
          style={{
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontSize: 18,
            fontWeight: 500,
            color: '#0D1B2A',
            margin: '0 0 10px',
            letterSpacing: '-0.2px',
          }}
        >
          Recent Trades
        </h2>

        {/* ── Result count + freshness ────────────────────────────────────── */}
        {/* Reuses 1AM-38 FreshnessIndicator for the "Updated X ago" pill.
            The count label inside the indicator is custom — we override the
            "Latest publicly available filings" text by rendering an inline
            count instead. */}
        {!loading && !error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              fontFamily: "'DM Sans', sans-serif",
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, color: '#0D1B2A' }}>
              {visibleTrades.length}{' '}
              {visibleTrades.length === 1 ? 'filing' : 'filings'} shown
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
              >
                {newTradeCount} new
              </span>
            )}
            <FreshnessIndicatorPill lastUpdatedAt={lastUpdatedAt} />
          </div>
        )}

        <div
          style={{
            fontSize: 11,
            color: '#9CA3AF',
            fontFamily: 'monospace',
            fontStyle: 'italic',
            padding: '0 2px',
            marginBottom: 14,
          }}
        >
          From Senate and House
        </div>

        {/* ── Loading / error / empty / list ──────────────────────────────── */}
        {loading && (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Loading filings…
          </div>
        )}

        {error && (
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
              Couldn&apos;t load filings
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
        )}

        {!loading && !error && visibleTrades.length > 0 && (
          <>
            {visibleTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                owner={trade.owner}
                // Browse is anonymous-discovery in spirit — no follow state
                // shown here, no detail-page hop. Both could be wired later.
              />
            ))}

            {/* 1AM-114: Load more button OR end-of-archive message.
                hasMore is heuristic — true while last batch returned PAGE_SIZE
                rows. Once a batch returns less, we know we're at the end. */}
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid #0D1B2A',
                  color: '#0D1B2A',
                  padding: '10px 0',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: loadingMore ? 'wait' : 'pointer',
                  opacity: loadingMore ? 0.6 : 1,
                  marginTop: 16,
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  marginTop: 16,
                  padding: 12,
                  fontSize: 12,
                  color: '#6B7280',
                  fontStyle: 'italic',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Start of archive · {ARCHIVE_START_LABEL}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 16, padding: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  color: '#9CA3AF',
                  fontStyle: 'italic',
                  fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.5,
                }}
              >
                {/* 1AM-114: footer copy variant D. archiveTotal may be null
                    while stats fetch is in flight or after a failed fetch —
                    fall back to a count-only copy in that case. */}
                {archiveTotal !== null
                  ? `${visibleTrades.length} of ${archiveTotal} · since ${ARCHIVE_START_MONTH_LABEL}`
                  : `${visibleTrades.length} filings · since ${ARCHIVE_START_MONTH_LABEL}`}
              </div>
            </div>
          </>
        )}

        {!loading && !error && visibleTrades.length === 0 && (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 16,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 16,
                fontWeight: 500,
                color: '#0D1B2A',
                marginBottom: 8,
              }}
            >
              No filings match
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              {hasActiveFilter
                ? 'Try removing some filters or searching for something else.'
                : 'No recent filings to show right now.'}
            </div>
            {hasActiveFilter && (
              <button
                onClick={resetFilters}
                style={{
                  padding: '8px 16px',
                  background: '#0D1B2A',
                  color: '#FAFAF7',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Filter sheet (1AM-124 fase 8) ──────────────────────────────── */}
      {/* Bottom-sheet overlay containing Chamber, Time period, and Sort
          filters. Reached via the "More filters →" link below the direction
          chips. Live filtering — chip taps update the same state used by
          the rest of the screen, so Recent Trades re-renders immediately. */}
      <FilterSheet
        isOpen={isShowingFilters}
        onClose={() => setIsShowingFilters(false)}
        chamber={chamberFilter}
        onChamberChange={setChamberFilter}
        timePeriod={timePeriod}
        onTimePeriodChange={setTimePeriod}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />
    </div>
  );
}

// Small helper that renders ONLY the "Updated X ago" pill from the freshness
// indicator pattern. We don't reuse FreshnessIndicator wholesale here because
// Browse has its own inline count label that replaces the standard one.
// Auto-tick logic mirrors FreshnessIndicator.
function FreshnessIndicatorPill({ lastUpdatedAt }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!lastUpdatedAt) return null;
  const relativeTime = formatRelativeTime(lastUpdatedAt);

  return (
    <span
      style={{
        background: '#F3F4F6',
        color: '#6B7280',
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 10,
        marginLeft: 'auto',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      Updated {relativeTime}
    </span>
  );
}

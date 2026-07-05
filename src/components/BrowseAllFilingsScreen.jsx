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
// 1AM-151 (Browse v3 layout reset, 2026-05-09):
//   - Header title "Browse" → "Recent Filings", subtitle "last 30 days"
//     added via the new HeaderBar `subtitle` prop.
//   - Trending Tickers section REMOVED from this screen (component file
//     parked for future reuse — see TODO note below).
//   - Most Active Politicians section REMOVED from this screen — relocates
//     to FeedScreen as discovery affordance for both empty + active users.
//   - "Recent Trades" h2 header REMOVED — redundant now that the entire
//     screen is filings.
//   - `followedPoliticians` + `onTogglePolitician` props dropped (the
//     Most Active row was the only consumer).
//   - 3-cascade `useTrades` calls (7d/30d/all) for Trending+MostActive
//     dropped — main filings-list `useTrades(searchFilters)` is the only
//     remaining fetch on this screen.
//
// TODO (post-1AM-151 cleanup): `src/components/TrendingTickers.jsx` and
// `aggregateTopTickers` (was inline in this file) are now unused. Keep
// parked until 1AM-150 umbrella ships — they may resurface in a Tickers/
// Watchlist surface later. After v0.21.0 if no consumer reappears, run a
// dead-code sweep.
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
//   onSignInClick    — 1AM-184: opens SignInOverlay when anon user taps the
//                      "Sign in" text-link in HeaderBar (via UserMenuButton).
//   onSettingsClick  — 1AM-124 / 1AM-184: opens SettingsScreen when a signed-in
//                      user taps the avatar in HeaderBar (via UserMenuButton).

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import TradeCard from './TradeCard';
import TradeDetailDrawer from './TradeDetailDrawer';
import { lookupSector } from '../lib/sectors';
import SingleChipGroup from './SingleChipGroup';
import HeaderBar from './HeaderBar';
import FilterSheet from './FilterSheet';
import FilterPill from './FilterPill';
import FilterSummaryLine from './FilterSummaryLine';
import { useTrades } from '../hooks/useTrades';
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

// 1AM-152 (2026-05-09): time-period chips on Browse-tab now drive these
// options directly. Slimmed from 5 entries (added 'all' + 'pastYear') to 3
// for the chip-row contract: 7d / 30d / 90d. The 'all' and 'pastYear'
// options were dropped per Browse v3 design Q&A — anything beyond 90d in a
// recency-driven discovery view is rarely useful (STOCK Act 45-day filing
// window means archive trades cluster within the chip range), and keeping
// dead options in the constant invites drift. If "All time" is needed
// later, add an explicit chip — don't reintroduce a hidden enum.
const TIME_PERIOD_OPTIONS = [
  { value: 'past7d', label: 'Past 7d' },
  { value: 'past30d', label: 'Past 30d' },
  { value: 'past90d', label: 'Past 90d' },
];

const TIME_PERIOD_DAYS = {
  past7d: 7,
  past30d: 30,
  past90d: 90,
};

// 1AM-172: maps Watch-tab's windowLabel values to the closest Browse-tab
// timePeriod. '24h' has no exact match (Browse's narrowest chip is 7d) —
// 'past7d' is the closest window that still includes today's activity.
const WATCH_WINDOW_TO_TIME_PERIOD = {
  '24h': 'past7d',
  '7d': 'past7d',
  '30d': 'past30d',
  '90d': 'past90d',
};

function computeSince(timePeriod) {
  // 1AM-152: 'all' early-return removed alongside the dropped option.
  // Defensive: if an unknown timePeriod string ever reaches here (legacy
  // cached state, future code-path), fall back to no `since` filter rather
  // than throwing. Server returns the 50 most recent — acceptable degradation.
  const days = TIME_PERIOD_DAYS[timePeriod];
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

// 1AM-154: amount filter options. Single-array shape with value + label +
// threshold so consumers (FilterSheet chip-group, active-filter pill,
// visibleTrades filter logic) all read from one source. Threshold is the
// numeric floor in dollars; matching trade if `parseAmountMidpoint(amount)
// >= threshold`. The 'any' option uses threshold 0, which the filter logic
// short-circuits before midpoint comparison.
//
// Thresholds rationale:
//   - $15K = STOCK Act PTR reporting trigger (smallest disclosed range).
//     "≥$15K" effectively means "anything visible above the noise floor".
//   - $50K = common "noteworthy" threshold used by Capitol Trades, Quiver.
//   - $100K / $500K / $1M = institutional-conviction buckets.
//
// Pill label format ≥$Xk per design Q&A 2026-05-09: U+2265 ≥ symbol is
// mathematically unambiguous (no "+" interpretation drift between strict-gt
// and gte). Sits in standard system-font stack, no fallback issues. Used
// as-is by FilterSheet SingleChipGroup (which doesn't apply text-transform
// to chip text — only to the group label) and by FilterPill (no transform).
//
// Exported named so FilterSheet can import without duplicating the array.
// Co-located with parseAmountMidpoint + filter logic per design Q&A — a
// future lib/ extraction is justified only when a third consumer appears
// (e.g. server-side amount filtering).
export const AMOUNT_OPTIONS = [
  { value: 'any', label: 'Any amount', threshold: 0 },
  { value: 'gte15k', label: '≥$15K', threshold: 15_000 },
  { value: 'gte50k', label: '≥$50K', threshold: 50_000 },
  { value: 'gte100k', label: '≥$100K', threshold: 100_000 },
  { value: 'gte500k', label: '≥$500K', threshold: 500_000 },
  { value: 'gte1m', label: '≥$1M', threshold: 1_000_000 },
];

// 1AM-112: sort options. "Newest" matches the default API order; "Largest"
// uses the amount range midpoint estimate for ordering.
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'largest', label: 'Largest amount' },
];

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
  // eslint-disable-next-line no-unused-vars
  onBack,
  onSignInClick,
  onSettingsClick,
  // 1AM-70 phase 3: drawer plumbing. followedPoliticians + onTogglePolitician
  // came back after 1AM-151 dropped them — the drawer's Follow CTA needs to
  // both read current follow state and toggle it. onPoliticianClick is new
  // for this ticket; the drawer's "View all trades" button calls it with
  // the politicus name to navigate to PoliticianDetailScreen via App.jsx's
  // detailPolitician route. Defaults to no-ops so the screen still renders
  // when invoked without these (legacy call-sites, tests).
  followedPoliticians = [],
  onTogglePolitician = () => {},
  onPoliticianClick = () => {},
  // 1AM-172: cross-tab hand-off from Watch-tab's SectorActivityHeatmap.
  // { sector, window } when the user tapped a sector bar, or null on a
  // normal tab visit. Consumed once via the effect below, then cleared at
  // the App level (onConsumePendingFilter) so it doesn't reapply on a
  // later, unrelated visit to this screen.
  pendingFilter = null,
  onConsumePendingFilter = () => {},
}) {
  // Local UI state — not persisted across sessions per ticket scope ("Browse
  // is a stateless utility for v1").
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [chamberFilter, setChamberFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  // 1AM-124 fase 8: default 'past30d'. Browse-tab is a recency-driven
  // discovery view. Users can still pick "All time" via the filter sheet.
  // 1AM-151: subtitle "last 30 days" in HeaderBar communicates this default
  // explicitly; chip changes update the listing-count below, not the header.
  const [timePeriod, setTimePeriod] = useState('past30d');
  // 1AM-112: sort order. Default 'newest' matches API order.
  const [sortOrder, setSortOrder] = useState('newest');

  // 1AM-154: minimum-amount filter. Default 'any' = no threshold applied.
  // Filter logic in `visibleTrades` useMemo. Pill renders in active-filter
  // row when not 'any'. Resets to 'any' via `resetFilters`.
  const [amountFilter, setAmountFilter] = useState('any');

  // 1AM-70: trade currently shown in the bottom-sheet drawer. null = no
  // drawer open. Set by TradeCard onTradeClick, cleared by drawer's onClose.
  // Phase 1 = skeleton; phases 2-5 fill in drawer content.
  const [selectedTrade, setSelectedTrade] = useState(null);

  // 1AM-70 phase 4: sector filter activated by tapping a sector in the
  // drawer's Bought-block. null = no filter (default). Filter logic in
  // visibleTrades useMemo uses lookupSector(t.ticker)?.sector to compare
  // against this value (case-sensitive match against sectors.json values).
  // Cleared via the active-filter pill × — only entry-point to clear, per
  // design Q&A 2026-05-09 (no hidden state, pill must be the affordance).
  const [sectorFilter, setSectorFilter] = useState(null);

  // 1AM-172: apply the Watch-tab sector-tap hand-off, if present. Watch's
  // windowLabel ('24h'|'7d'|'30d'|'90d') doesn't have an exact match for
  // '24h' on Browse (TIME_PERIOD_OPTIONS is 7d/30d/90d only) — falls back
  // to 'past7d', the closest window that still includes "today".
  useEffect(() => {
    if (!pendingFilter) return;
    setSectorFilter(pendingFilter.sector);
    setTimePeriod(WATCH_WINDOW_TO_TIME_PERIOD[pendingFilter.window] || 'past30d');
    onConsumePendingFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFilter]);

  // 1AM-70 phase 5 hotfix: relatedTrades useMemo moved BELOW allFetchedTrades
  // declaration to avoid Temporal Dead Zone ReferenceError. The original
  // placement (here) referenced allFetchedTrades in both the function body
  // and the dependency array before the const was initialised, crashing
  // every render and leaving Browse-tab as a blank page.
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

  // 1AM-153: ref to the search input so the search-pill body-tap can return
  // focus to a freshly-revealed input with cursor at the end of the value
  // (edit-affordance per design Q&A 2026-05-09). Without this, tap-on-pill
  // would just remove the pill and the user would have to find the input
  // and click into it manually.
  const searchInputRef = useRef(null);

  // 1AM-153: search-pill swap state. Decouples input visibility from
  // debouncedSearch, so toggling between pill-mode and input-mode doesn't
  // disturb the search query itself (no flicker, no premature backend
  // refetch). Default true (input visible).
  //
  // Mode-switch trigger (1AM-153 hotfix 2026-05-09): on input BLUR, not on
  // debounce. The first implementation auto-switched as soon as the
  // debounced search settled to non-empty — which fired mid-word for any
  // user typing slower than 250ms/char, killing the input before they
  // finished typing the search. The user observation was: typing "NVDA"
  // would auto-collapse to a `N ×` pill after the first character because
  // 250ms had elapsed before the second keystroke.
  //
  // Blur-trigger: input stays open while the user is interacting with it.
  // When they tab away, click elsewhere, or hit Enter (which blurs in most
  // browsers), the input collapses to a pill. Pill × clears the search and
  // returns to input-mode empty. Pill body tap returns to input-mode with
  // value + focus + cursor-at-end for editing.
  const [isSearchInputMode, setIsSearchInputMode] = useState(true);

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
  const allFetchedTrades = useMemo(() => {
    const combined = [...(trades || []), ...extraTrades];
    // Defensive dedup by id — should be redundant given /api/trades returns
    // distinct rows per page, but a stale extras array during a fast filter
    // change could overlap with the new first page. Cheap to keep.
    const seen = new Set();
    return combined.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [trades, extraTrades]);

  // 1AM-70 phase 5 (moved here in phase 5 hotfix): related filings for the
  // drawer's "Related filings in [Sector]" section. Computed when
  // selectedTrade has a known sector; returns up to 3 OTHER trades in the
  // same sector, sorted by tradeDate descending (most-recent first).
  //
  // Position: AFTER allFetchedTrades is declared — earlier placement caused
  // a Temporal Dead Zone ReferenceError on every render (the dependency
  // array `[selectedTrade, allFetchedTrades]` accessed allFetchedTrades
  // before its `const` was initialised), which crashed BrowseAllFilingsScreen
  // and rendered the tab as a blank page after onboarding completion.
  //
  // Source: allFetchedTrades — the complete fetched set, NOT visibleTrades.
  // This is intentional: related filings are a discovery affordance and
  // should surface trades regardless of the user's current filters
  // (chamber, action, amount, etc.). If we used visibleTrades a chamber
  // filter on Senate would hide House trades in the same sector — wrong
  // mental model. The drawer's section headline ("Related filings in
  // Financials") promises sector-scoped, not filter-scoped.
  //
  // Empty array when:
  //   - no selectedTrade
  //   - selectedTrade has unknown sector (lookupSector miss)
  //   - no other trades in that sector
  // Drawer hides the entire section (header + body) when empty per design.
  const relatedTrades = useMemo(() => {
    if (!selectedTrade) return [];
    const currentSector = lookupSector(selectedTrade.ticker)?.sector;
    if (!currentSector) return [];
    return allFetchedTrades
      .filter((t) => {
        if (t.id === selectedTrade.id) return false;
        return lookupSector(t.ticker)?.sector === currentSector;
      })
      .sort((a, b) => {
        // tradeDate is YYYY-MM-DD; lexicographic sort = chronological sort.
        // Descending = most recent first.
        if (b.tradeDate < a.tradeDate) return -1;
        if (b.tradeDate > a.tradeDate) return 1;
        return 0;
      })
      .slice(0, 3);
  }, [selectedTrade, allFetchedTrades]);

  // Client-side chamber + action + amount filters layered on top of the
  // fetched set, then sorted per sortOrder.
  const visibleTrades = useMemo(() => {
    // 1AM-154: resolve amount threshold once outside the per-trade loop.
    // For 'any' the option's threshold is 0; we still skip the comparison
    // entirely via the early-continue below to avoid parsing midpoints when
    // no filter is active.
    const amountOption = AMOUNT_OPTIONS.find((o) => o.value === amountFilter);
    const amountThreshold = amountOption ? amountOption.threshold : 0;

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
      // 1AM-154: minimum-amount threshold. Skip entirely when filter is
      // 'any' (threshold 0) — saves the parseAmountMidpoint call on every
      // trade in the default case.
      if (amountFilter !== 'any') {
        const midpoint = parseAmountMidpoint(t.amount);
        if (midpoint < amountThreshold) return false;
      }
      // 1AM-70 phase 4: sector filter via lookupSector enrichment. Skip
      // entirely when sectorFilter is null (default) — saves the lookup
      // call. When set, compare against the sectors.json value for this
      // trade's ticker; trades whose ticker isn't in sectors.json fail
      // the filter (no false positives via empty-string match).
      if (sectorFilter) {
        const tradeSector = lookupSector(t.ticker)?.sector;
        if (!tradeSector || tradeSector !== sectorFilter) return false;
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
  }, [allFetchedTrades, chamberFilter, actionFilter, amountFilter, sectorFilter, sortOrder]);

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
    amountFilter !== 'any' ||
    sectorFilter !== null ||
    debouncedSearch !== '';

  const resetFilters = () => {
    setSearchInput('');
    setChamberFilter('all');
    setActionFilter('all');
    // 1AM-124 fase 8: reset matches new default, not 'all'.
    setTimePeriod('past30d');
    setSortOrder('newest');
    // 1AM-154: reset amount filter back to 'any' (no threshold).
    setAmountFilter('any');
    // 1AM-70 phase 4: reset sector filter back to null (no filter).
    setSectorFilter(null);
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
        {/* 1AM-151: title "Recent Filings" + subtitle "last 30 days". The
            subtitle communicates the default time-window honestly without
            taking up filter-row real estate. Chip changes update the count
            below the filter row, not the header. */}
        <HeaderBar
          title="Recent Filings"
          subtitle="last 30 days"
          onSignInClick={onSignInClick}
          onSettingsClick={onSettingsClick}
        />

        {/* ── Search input ────────────────────────────────────────────────── */}
        {/* 1AM-153: search-pill swap UX. Input renders when isSearchInputMode
            is true (default + after pill-tap-to-edit). When user submits a
            search, the auto-switch effect flips to pill-mode and hides this
            input — same content, different control-affordance. Tap pill
            body → input returns with value+focus+cursor-at-end. Tap pill
            × → searchInput clears, mode flips back to input, input is empty.
            The two states share `searchInput` state directly, so debounce +
            backend-search behaviour is unaffected. */}
        {isSearchInputMode && (
          <div
            style={{
              position: 'relative',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 13,
                color: '#9CA3AF',
                fontFamily: "'DM Sans', sans-serif",
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => {
                // 1AM-153: blur-triggered switch to pill-mode. Only switch
                // when there's something to pill-ify — empty input on blur
                // stays as input (matches default state).
                if (searchInput.trim()) {
                  setIsSearchInputMode(false);
                }
              }}
              onKeyDown={(e) => {
                // Enter blurs the input which triggers the onBlur handler
                // above. Explicitly blur on Enter to avoid relying on
                // browser-native form-submit behaviour (we're not in a form).
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
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
        )}

        {/* ── Filter zone (1AM-124 fase 8 → 1AM-152) ─────────────────────── */}
        {/* Three-row chunk in the filter zone:
              Row 1: Direction chips (All/Buy/Sell)
              Row 2: Time-range chips (Past 7d/30d/90d) — replaces the
                     "This week" pill from 1AM-124 fase 8
              Row 3: "More filters →" text link, right-aligned

            Consistent 8px row-gap inside the chunk per design Q&A
            (1AM-152 caveat 1) — section break to the active-filter pills
            below kicks in at 12px (existing pills row marginBottom).

            Chamber + Sort live behind the FilterSheet bottom-sheet (Time
            period section there was removed in 1AM-152 phase 2 — chips
            here are the canonical control). */}

        {/* Row 1 — Direction chips (Action). All / Buy / Sell. Reuses
            ACTION_OPTIONS + SingleChipGroup. Empty label hides the uppercase
            header so the row reads as quick-toggles, not a labelled section. */}
        <div style={{ marginBottom: 8 }}>
          <SingleChipGroup
            label=""
            options={ACTION_OPTIONS}
            value={actionFilter}
            onChange={setActionFilter}
          />
        </div>

        {/* Row 2 — Time-range chips (1AM-152). Past 7d / Past 30d / Past 90d,
            default Past 30d (matches `timePeriod` initial state). Direct
            mapping: tapping a chip sets timePeriod to that value, useTrades
            refetches via `since` query param. No cascade fallback, no
            "This week" toggle ambiguity — the chip is canonical state. */}
        <div style={{ marginBottom: 8 }}>
          <SingleChipGroup
            label=""
            options={TIME_PERIOD_OPTIONS}
            value={timePeriod}
            onChange={setTimePeriod}
          />
        </div>

        {/* Row 3 — "More filters →" text link. Opens the FilterSheet with
            the remaining secondary filters (Chamber, Sort). Distinct
            typography from the chip rows above (smaller, muted gray,
            underlined) so it doesn't read as a fourth chip — design Q&A
            caveat 2. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 12,
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

        {/* ── Active filter pills (1AM-153) ──────────────────────────────── */}
        {/* Pills row above the count strip. Each pill represents one
            currently-applied filter dimension. Pills appear/disappear based
            on whether their underlying state is at the default value.

            Search-pill UX (per design Q&A 2026-05-09):
              - × removes search → input returns empty
              - body tap returns the input pre-filled with the current value
                + focused + cursor-at-end so the user can edit instead of
                retyping. Without focus + cursor positioning, the affordance
                is dead and clearing+retyping would be faster.

            Implementation: `isSearchInputMode` local flag decouples input
            visibility from `debouncedSearch` value, avoiding a data-flicker
            where setSearchInput('') would trigger a 250ms debounce window
            during which the trade list re-fetches with no search filter.
            With the flag, search-input value stays intact while toggling
            between input-mode and pill-mode purely for display.

            Action-pill: only renders when actionFilter !== 'all'. No edit-
            affordance — actions are binary (Buy/Sell), pill × is sufficient.

            Amount-pill (1AM-154): renders when amountFilter !== 'any'.
            Label sourced from AMOUNT_OPTIONS so the pill text stays in
            lockstep with the FilterSheet chip-group label. No edit-
            affordance — × clears back to 'any', user picks a new threshold
            via the FilterSheet chip-group.

            Sector-pill (1AM-70 phase 4): renders when sectorFilter is non-
            null. Activated via the drawer's tap-to-filter affordance —
            no chip-group entry-point in FilterSheet (sector is discovery-
            via-context, not upfront filter). × is the only way to clear
            (per design Q&A — no hidden state).

            Chamber + time-period are NOT pillified — chamber stays as
            tabs (handled in FilterSheet), time-period has its own chip
            treatment (1AM-152). Sort isn't a filter, no pill. */}
        {(debouncedSearch ||
          actionFilter !== 'all' ||
          amountFilter !== 'any' ||
          sectorFilter !== null) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 12,
            }}
          >
            {debouncedSearch && !isSearchInputMode && (
              <FilterPill
                label={debouncedSearch}
                onRemove={() => {
                  // × clears search → input returns empty (per design
                  // contract). searchInput cleared first, then mode swap
                  // so the rebuilt input renders with empty value.
                  setSearchInput('');
                  setIsSearchInputMode(true);
                }}
                onClick={() => {
                  // Body tap → return to input mode with current value
                  // intact + focus + cursor at end. searchInput already
                  // holds the value; we just toggle visibility.
                  setIsSearchInputMode(true);
                  // Focus + cursor positioning happens in a microtask
                  // after React mounts the input element.
                  setTimeout(() => {
                    if (searchInputRef.current) {
                      searchInputRef.current.focus();
                      const len = searchInput.length;
                      searchInputRef.current.setSelectionRange(len, len);
                    }
                  }, 0);
                }}
              />
            )}
            {actionFilter !== 'all' && (
              <FilterPill
                label={actionFilter === 'buy' ? 'Buy only' : 'Sell only'}
                onRemove={() => setActionFilter('all')}
              />
            )}
            {amountFilter !== 'any' && (
              <FilterPill
                label={
                  AMOUNT_OPTIONS.find((o) => o.value === amountFilter)?.label ||
                  amountFilter
                }
                onRemove={() => setAmountFilter('any')}
              />
            )}
            {sectorFilter !== null && (
              <FilterPill
                label={sectorFilter}
                onRemove={() => setSectorFilter(null)}
              />
            )}
          </div>
        )}

        {/* ── Result count + freshness ────────────────────────────────────── */}
        {/* 1AM-151: Recent Trades h2 header removed (redundant — entire
            screen is filings).
            1AM-153: count strip refactored to use FilterSummaryLine — same
            visual treatment as Feed FilterBar. contextParts stays empty for
            Browse v1 (filter-context labels like "NVDA · Senate" are an
            optional v2 polish; the active-filter pills above already
            communicate which filters are on). */}
        {!loading && !error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
              fontFamily: "'DM Sans', sans-serif",
              flexWrap: 'wrap',
            }}
          >
            <FilterSummaryLine
              count={visibleTrades.length}
              noun="filing"
            />
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
            {/* 1AM-156: "Reset filters" was previously reachable only from
                the "No filings match" empty-state. Gated purely on
                hasActiveFilter (not on the pills row above) so it's also
                reachable when only chamber or time-period differ from
                default — neither is pillified, so the pills row can be
                hidden while hasActiveFilter is still true. Underlined-text
                treatment (not a pill) — it's a meta-action, not a filter. */}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  marginLeft: 'auto',
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
                Clear all
              </button>
            )}
          </div>
        )}

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
                // 1AM-70 phase 1: tap-on-card opens the trade detail
                // drawer instead of expanding inline. Replaces the
                // expand-on-tap behaviour for Browse-tab. Feed-tab still
                // gets the legacy expand because it doesn't pass this
                // prop — see TradeCard's backwards-compatible click
                // handler.
                onTradeClick={setSelectedTrade}
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
                  marginTop: 16,
                  opacity: loadingMore ? 0.6 : 1,
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
      {/* Bottom-sheet overlay containing Chamber, Minimum amount, and Sort
          filters.
          1AM-152: Time period section moved to a chip-row in the main filter
          zone — sheet only retains the genuinely secondary filters now.
          1AM-154: Minimum amount section added between Chamber and Sort. */}
      <FilterSheet
        isOpen={isShowingFilters}
        onClose={() => setIsShowingFilters(false)}
        chamber={chamberFilter}
        onChamberChange={setChamberFilter}
        amountFilter={amountFilter}
        onAmountChange={setAmountFilter}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      {/* ── Trade detail drawer (1AM-70) ────────────────────────────────── */}
      {/* Phase 1 = skeleton. Phase 2 = header + Bought-block. Phase 3 = action
          row (Follow + View all trades) — drawer now consumes followed state,
          toggle callback, and profile-navigate callback from App.jsx. Phase 6
          will add swipe-down gesture; phases 4-5 fill in sector filter
          tap-to-activate + Related filings.

          isFollowing derived from the followed list each render — kept stale-
          free without a separate state. onToggleFollow + onViewProfile are
          stable callbacks via App.jsx; profile-navigate also dismisses the
          drawer so the navigation transition feels clean. */}
      <TradeDetailDrawer
        trade={selectedTrade}
        onClose={() => setSelectedTrade(null)}
        isFollowing={
          selectedTrade
            ? followedPoliticians.includes(selectedTrade.politician)
            : false
        }
        onToggleFollow={() => {
          if (selectedTrade) {
            onTogglePolitician(selectedTrade.politician);
          }
        }}
        onViewProfile={() => {
          if (selectedTrade) {
            const name = selectedTrade.politician;
            // Dismiss drawer before navigation so the user doesn't see the
            // sheet animate out on top of the new screen.
            setSelectedTrade(null);
            onPoliticianClick(name);
          }
        }}
        onSectorClick={(sectorName) => {
          // 1AM-70 phase 4: sector tap-to-filter. Activate the sector
          // filter with the tapped sector value, then dismiss the drawer
          // so the user sees the freshly-filtered list. The active-filter
          // pill (1AM-153) will appear in the pills row, and clearing the
          // filter is its × — no hidden state per design Q&A.
          setSectorFilter(sectorName);
          setSelectedTrade(null);
        }}
        relatedTrades={relatedTrades}
        onRelatedTradeClick={(trade) => {
          // 1AM-70 phase 5: drawer content swap. Setting selectedTrade to
          // a different trade triggers the drawer to re-render with the
          // new trade's data — header, Bought-block, related filings all
          // update. No dismiss-and-reopen animation; the drawer stays
          // mounted, content hot-swaps. relatedTrades useMemo recomputes
          // for the new trade, so the section now shows OTHER trades in
          // the new trade's sector (which is the same sector since they
          // were grouped that way to begin with — but the current trade
          // exclusion shifts).
          setSelectedTrade(trade);
        }}
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

// Used by FILTER_OPTIONS exported in case other surfaces want to reuse them
// (none today, but kept for forward-compat).
export const _BROWSE_FILTER_OPTIONS = {
  CHAMBER: CHAMBER_OPTIONS,
  ACTION: ACTION_OPTIONS,
  TIME_PERIOD: TIME_PERIOD_OPTIONS,
  SORT: SORT_OPTIONS,
};

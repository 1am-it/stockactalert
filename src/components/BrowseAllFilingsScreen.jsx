// 1AM-112: BrowseAllFilingsScreen — dedicated browse experience
//
// Replaces the previous in-place "Show all" toggle on Personal feed. Reached
// from two entry points:
//   1. FilterBar `Show all` button on Personal feed (deprecates the old toggle)
//   2. `View all recent filings` CTA in FilterEmptyState (1AM-111)
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
//   onBack — callback when user clicks "Back to feed"

import { useState, useEffect, useMemo, useCallback } from 'react';
import TradeCard from './TradeCard';
import SingleChipGroup from './SingleChipGroup';
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

export default function BrowseAllFilingsScreen({ onBack }) {
  // Local UI state — not persisted across sessions per ticket scope ("Browse
  // is a stateless utility for v1").
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [chamberFilter, setChamberFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [timePeriod, setTimePeriod] = useState('all');
  // 1AM-112: sort order. Default 'newest' matches API order.
  const [sortOrder, setSortOrder] = useState('newest');

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

  const hasActiveFilter =
    chamberFilter !== 'all' ||
    actionFilter !== 'all' ||
    timePeriod !== 'all' ||
    debouncedSearch !== '';

  const resetFilters = () => {
    setSearchInput('');
    setChamberFilter('all');
    setActionFilter('all');
    setTimePeriod('all');
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
        {/* Page-style header matching Your Feed / Politicians (Decision 2B). */}
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            fontSize: 13,
            color: '#0D1B2A',
            textDecoration: 'underline',
            textDecorationColor: '#9CA3AF',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          ← Back to feed
        </button>

        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            fontWeight: 500,
            color: '#0D1B2A',
            margin: '4px 0 4px',
            letterSpacing: '-0.4px',
          }}
        >
          Browse All Filings
        </h1>
        <p
          style={{
            fontSize: 12,
            color: '#6B7280',
            margin: '0 0 18px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Search and filter recent STOCK Act filings
        </p>

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

        {/* ── Filter chips ────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <SingleChipGroup
            label="Chamber"
            options={CHAMBER_OPTIONS}
            value={chamberFilter}
            onChange={setChamberFilter}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <SingleChipGroup
            label="Action"
            options={ACTION_OPTIONS}
            value={actionFilter}
            onChange={setActionFilter}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <SingleChipGroup
            label="Time period"
            options={TIME_PERIOD_OPTIONS}
            value={timePeriod}
            onChange={setTimePeriod}
          />
        </div>
        {/* 1AM-112: sort chip row. Filters narrow, sort orders. */}
        <div style={{ marginBottom: 18 }}>
          <SingleChipGroup
            label="Sort"
            options={SORT_OPTIONS}
            value={sortOrder}
            onChange={setSortOrder}
          />
        </div>

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

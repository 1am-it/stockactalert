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
//
// Props:
//   onBack — callback when user clicks "Back to feed"

import { useState, useEffect, useMemo } from 'react';
import TradeCard from './TradeCard';
import SingleChipGroup from './SingleChipGroup';
import { useTrades } from '../hooks/useTrades';
import { formatRelativeTime } from '../lib/relativeTime';

const SEARCH_DEBOUNCE_MS = 250;
// Pattern: 2-5 uppercase letters, no spaces. Matches ticker conventions.
const TICKER_PATTERN = /^[A-Z]{2,5}$/;

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
  // 1AM-112: sort order. Default 'newest' matches API order.
  const [sortOrder, setSortOrder] = useState('newest');

  // Debounce the search input to avoid hitting the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Translate the debounced search into a backend filter. Ticker pattern
  // detection runs against the raw (non-uppercased) input — we don't auto-
  // uppercase because that would make every short query a ticker search.
  const searchFilters = useMemo(() => {
    if (!debouncedSearch) return {};
    if (TICKER_PATTERN.test(debouncedSearch)) {
      return { ticker: debouncedSearch };
    }
    return { politician: debouncedSearch };
  }, [debouncedSearch]);

  const { trades, loading, error, refetch, lastUpdatedAt, newTradeCount } =
    useTrades(searchFilters);

  // Client-side chamber + action filters layered on top of the fetched set,
  // then sorted per sortOrder.
  const visibleTrades = useMemo(() => {
    if (!trades) return [];
    const filtered = trades.filter((t) => {
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
  }, [trades, chamberFilter, actionFilter, sortOrder]);

  const hasActiveFilter =
    chamberFilter !== 'all' || actionFilter !== 'all' || debouncedSearch !== '';

  const resetFilters = () => {
    setSearchInput('');
    setChamberFilter('all');
    setActionFilter('all');
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
                Showing the latest {visibleTrades.length} filings · earlier
                history coming soon
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

// 1AM-124 fase 5: TrendingTickers
// Renders the top 5 most-traded tickers in a fixed window (default Past 7 days)
// in a dedicated section above the search/filter row in BrowseAllFilingsScreen.
//
// Aggregation is performed by the parent (BrowseAllFilingsScreen) on a separate
// trades fetch — independent of the user's chamber/action/time filters on the
// Recent Trades section. That separation is intentional: Trending is a discovery
// signal showing "what's moving in Congress this week", not a filtered view of
// the user's current selection.
//
// Design choice (Lovable v3-rounded mockup): each row shows ticker symbol +
// optional company name + trade count. Our FMP data does not include company
// names today, so we only render the ticker symbol for now. Company names will
// arrive when 1AM-37 (sector tagging) ships.
//
// Empty state: when fewer than 1 ticker has trades in the window (rare —
// archive-start week or filter combo), the section renders nothing rather than
// a placeholder. Keeps the screen quiet until there's signal.
//
// Loading state: while parent's trending-fetch is in flight, render a soft
// skeleton (3 grey rows) so the page doesn't jump when data arrives.
//
// 1AM-134: rows are interactive — tap a row to filter Recent Trades by that
// ticker. The parent passes onTickerSelect(ticker), which populates the
// search input and smooth-scrolls to Recent Trades. Affordance: cursor-pointer,
// hover background-shift, button semantics for keyboard support.
//
// Props:
//   tickers          — array of { ticker: string, count: number }, length 0-5
//   loading          — boolean, show skeleton while true
//   windowLabel      — string shown in the section header right side, e.g. "7 days"
//   onTickerSelect   — optional callback(ticker: string). When provided, rows
//                      become tappable buttons. When omitted, rows render as
//                      non-interactive divs (graceful fallback).

import { useState } from 'react';

export default function TrendingTickers({
  tickers = [],
  loading = false,
  windowLabel = '7 days',
  onTickerSelect,
}) {
  // 1AM-134: track which row is currently hovered so we can style it.
  // null = no hover. Inline state pattern matches the rest of the codebase.
  const [hoveredTicker, setHoveredTicker] = useState(null);

  // Hide section entirely when not loading and no data — quieter UX.
  if (!loading && tickers.length === 0) {
    return null;
  }

  return (
    <section style={{ marginBottom: 24 }}>
      {/* ── Section header ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontSize: 18,
            fontWeight: 500,
            color: '#0D1B2A',
            margin: 0,
            letterSpacing: '-0.2px',
          }}
        >
          Trending Tickers
        </h2>
        <span
          style={{
            fontSize: 11,
            color: '#9CA3AF',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {windowLabel}
        </span>
      </div>

      {/* ── Ticker rows ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading
          ? // Skeleton: 3 placeholder rows. Keeps height stable so the
            // filter row below doesn't jump when data arrives.
            [0, 1, 2].map((i) => (
              <div
                key={`skel-${i}`}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8E5D8',
                  borderRadius: 10,
                  padding: '12px 14px',
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 14,
                    background: '#F1EFE6',
                    borderRadius: 4,
                  }}
                />
                <div style={{ flex: 1 }} />
                <div
                  style={{
                    width: 50,
                    height: 12,
                    background: '#F1EFE6',
                    borderRadius: 4,
                  }}
                />
              </div>
            ))
          : tickers.map(({ ticker, count }) => {
              const isHovered = hoveredTicker === ticker;
              const isInteractive = typeof onTickerSelect === 'function';

              // 1AM-134: when onTickerSelect is provided, render as a button
              // for native keyboard support (Enter/Space) and aria semantics.
              // Otherwise fall back to a non-interactive div (defensive — not
              // expected in current usage, but keeps the component reusable).
              if (!isInteractive) {
                return (
                  <div
                    key={ticker}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E8E5D8',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Playfair Display', 'Lora', serif",
                        fontSize: 16,
                        fontWeight: 500,
                        color: '#0D1B2A',
                        letterSpacing: '0.3px',
                      }}
                    >
                      {ticker}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: '#6B7280',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {count} {count === 1 ? 'trade' : 'trades'}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => onTickerSelect(ticker)}
                  onMouseEnter={() => setHoveredTicker(ticker)}
                  onMouseLeave={() => setHoveredTicker(null)}
                  aria-label={`Filter Recent Trades by ${ticker}`}
                  style={{
                    // Reset native button styling so it visually matches the
                    // other rows on the page (Most Active, etc.). Without
                    // this the browser default border+background bleeds through.
                    appearance: 'none',
                    font: 'inherit',
                    color: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                    cursor: 'pointer',

                    // Visual: same as old div, plus hover-state shift.
                    // Hover background uses the warm-secondary that's also used
                    // on the chip-rows in BrowseAllFilingsScreen — keeps the
                    // editorial palette tight.
                    background: isHovered ? '#F5F2E8' : '#FFFFFF',
                    border: `1px solid ${isHovered ? '#D8D5C8' : '#E8E5D8'}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition:
                      'background 0.15s ease, border-color 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Playfair Display', 'Lora', serif",
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#0D1B2A',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {ticker}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#6B7280',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {count} {count === 1 ? 'trade' : 'trades'}
                  </span>
                </button>
              );
            })}
      </div>
    </section>
  );
}

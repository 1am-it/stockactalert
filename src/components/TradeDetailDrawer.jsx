// 1AM-70: TradeDetailDrawer — bottom-sheet overlay for trade detail
//
// Phase 1 (skeleton, 2026-05-09): scaffold — backdrop scrim + slide-up
// sheet + grab handle + Esc/scrim-tap dismiss + body-scroll lock.
//
// Phase 2 (header + Bought-block, 2026-05-09): visual content for the top
// half of the drawer.
//   - Header: Avatar (initials fallback until 1AM-146 ships) + politicus
//     name in Playfair + chamber·state·district secondary line via
//     formatChamberLine helper.
//   - Bought-block card: action label color-matched (Bought green / Sold
//     red), large ticker color-matched, company name + sector, full amount
//     range, "Filed Xd after trade" line. Source attribution at the bottom
//     with "View original PTR filing →" link when disclosureUrl is present
//     (1AM-157 — falls back to "Original disclosure not yet linked" when
//     the upstream feed omits the URL).
//
// Phase 3 (action row, 2026-05-09): Follow [FirstName] / ✓ Following
// primary CTA + outlined "View all trades" secondary navigation to
// PoliticianDetailScreen. Drawer dismisses inside onViewProfile so the
// transition feels clean.
//
// Phase 4 (sector tap-to-filter, 2026-05-09): sector text in the Bought-
// block becomes tappable when onSectorClick is provided. Tap dismisses
// drawer + activates Browse sectorFilter with the sector value. "Tap
// sector to filter" muted hint serves as discoverability cue. The pill
// in the active-filter row is the only entry-point to clear the filter
// (per design Q&A — no hidden state).
//
// Phase 5 (Related filings, 2026-05-09): "Related filings in [Sector]"
// section below the action row. Up to 3 other trades from the same
// sector, sorted by tradeDate DESC, current trade excluded. Row layout
// is single-line on 375px: avatar (initials in circle, no name text) +
// ticker + action label + abbreviated amount range + tradeDate. Tap
// row → onRelatedTradeClick hot-swaps drawer content (no dismiss/re-
// open). Section returns null entirely when relatedTrades is empty.
//
// Phase 6 (swipe-down gesture, 2026-05-09): mobile-only swipe-down
// dismiss via touch handlers on the grab handle. Combined threshold —
// either >40% of sheet height OR velocity > 0.5px/ms over the last
// 100ms triggers dismiss; otherwise the sheet snaps back. Distance
// catches slow long swipes, velocity catches fast flicks; the OR is
// what avoids both false-positives (iOS scroll-bounce) and false-
// negatives (deliberate slow drags). Desktop is unaffected — touch
// events don't fire there, Esc + scrim-tap remain the dismiss paths.
//
// Animation: pure CSS keyframes for the open animation (250ms slideUp +
// fadeIn). Close happens via instant unmount when `trade` becomes null.
//
// Accessibility: role="dialog" + aria-modal="true" on the sheet. Focus
// management deferred until phase 3 (action row introduces focusable
// buttons; that's the right moment to add focus-trap).
//
// Body-scroll lock: while the drawer is open, document.body overflow is set
// to 'hidden'. Restored on unmount.

import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar';
import DisclosureTimeline from './DisclosureTimeline';
import { findByName } from '../lib/congress';
import { formatChamberLine } from '../lib/formatChamberLine';
import { lookupSector } from '../lib/sectors';
import { formatFiledRelative, formatShortDate } from '../lib/dates';
import { useDisclosurePrices } from '../hooks/useDisclosurePrices';

// Source-name display map. trade.source is the raw key ('fmp', 'finnhub',
// etc.); the source attribution line in the Bought-block reads better with
// human-readable names. Unknown sources fall back to the raw key.
const SOURCE_DISPLAY_NAMES = {
  fmp: 'Financial Modeling Prep',
  finnhub: 'Finnhub',
  unusualwhales: 'Unusual Whales',
  capitoltrades: 'Capitol Trades',
  housegov: 'House.gov',
};

function getSourceDisplayName(source) {
  if (!source) return 'unknown source';
  return SOURCE_DISPLAY_NAMES[source.toLowerCase()] || source;
}

// Initials from politicus name, e.g. "April Delaney" → "AD". Same logic as
// TradeCard (1AM-65) — duplicated rather than extracted to a lib because the
// transformation is two lines and only two consumers, both of which would
// need to import the helper. Future cleanup ticket can extract if a third
// consumer appears.
function getInitials(name) {
  if (!name) return '??';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Compact amount range for the Related filings rows (1AM-70 phase 5).
// Inputs come straight from the FMP feed normalised in schema.js, e.g.
// "$1,001 - $15,000" → "$1K–$15K", "$1,000,001 - $5,000,000" → "$1M–$5M".
//
// Why abbreviate: drawer related-rows are single-line on 375px viewport
// with avatar + ticker + action + amount + date. Full ranges like
// "$1,001 - $15,000" eat the budget; abbreviated forms keep all five
// elements on one line at minor accuracy cost (we lose the exact
// thousands, but magnitude is what matters for "is this a big or small
// position" scanning).
//
// Falls back to the original string on parse failure (no regex match,
// non-numeric input) so unknown formats degrade gracefully rather than
// crash. En-dash (–) used as separator to match the rest of the app's
// range typography (1AM-37 sectors policy).
function abbreviateAmount(amountStr) {
  if (!amountStr) return '—';
  const cleaned = String(amountStr).replace(/[$,]/g, '').replace(/–|—/g, '-');
  const parts = cleaned.split('-').map((s) => s.trim()).filter(Boolean);

  const formatNum = (raw) => {
    const num = parseFloat(raw);
    if (!Number.isFinite(num)) return null;
    if (num >= 1_000_000) {
      const millions = num / 1_000_000;
      // Whole-millions render without decimal (e.g. $5M, not $5.0M);
      // sub-10M with a real fractional part renders with one decimal
      // (e.g. $1.5M). The .0 strip catches values like 1.000001 that
      // round-to-1.0 — gives "$1M" not "$1.0M".
      if (millions >= 10 || Number.isInteger(millions)) {
        return `$${Math.round(millions)}M`;
      }
      return `$${millions.toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (num >= 1_000) {
      return `$${Math.round(num / 1_000)}K`;
    }
    return `$${num}`;
  };

  if (parts.length === 2) {
    const lo = formatNum(parts[0]);
    const hi = formatNum(parts[1]);
    if (lo && hi) return `${lo}–${hi}`;
  }
  if (parts.length === 1) {
    const single = formatNum(parts[0]);
    if (single) return single;
  }
  return amountStr; // graceful fallback
}

export default function TradeDetailDrawer({
  trade,
  onClose,
  isFollowing = false,
  onToggleFollow,
  onViewProfile,
  onSectorClick,
  relatedTrades = [],
  onRelatedTradeClick,
}) {
  // Ref to the scrollable content area. Phase 6 reads scrollTop to gate
  // the swipe-down gesture (only allow drag-dismiss when content is at
  // the top — otherwise touchmove should let native scroll happen).
  const contentRef = useRef(null);

  // 1AM-70 phase 6: swipe-down gesture refs + state.
  // - sheetRef: measure sheet height for the dismiss-threshold (40% of
  //   sheet height) and for the dismiss animation (translateY(sheetH)).
  // - dragStateRef: scratchpad during a drag — startY, startTime, samples
  //   for velocity. Lives in a ref so updates don't trigger re-renders.
  //   Velocity is computed on touchend over the LAST ~100ms of samples
  //   (b1 design choice: pure-distance threshold would dismiss on iOS
  //   scroll-bounce after the user reads to the bottom, hits the bounce,
  //   and pulls down — velocity discriminates intent from accidental).
  // - dragOffset state (px): drives the inline transform. State, not ref,
  //   so React re-renders on each touchmove and the transform updates;
  //   this is a single style change per render at ~60fps, well within
  //   budget on modern phones.
  // - isDragging state: switches transition off during the drag (instant
  //   finger-follow) and back on for the post-release animation (snap-
  //   back or dismiss).
  const sheetRef = useRef(null);
  const dragStateRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Member metadata from congress.json directory. Used for the secondary
  // header line (chamber · state · district). Returns null when the politicus
  // isn't in the directory — graceful fallback per PoliticianDetailScreen
  // pattern (1AM-69).
  const member = useMemo(() => {
    if (!trade) return null;
    const matches = findByName(trade.politician);
    return matches.length > 0 ? matches[0] : null;
  }, [trade]);

  // Sector + companyName enrichment from sectors.json (1AM-37). Returns
  // undefined for unknown tickers — companyName falls back to ticker, sector
  // line is hidden when missing rather than rendering an awkward empty.
  const sectorInfo = useMemo(() => {
    if (!trade) return undefined;
    return lookupSector(trade.ticker);
  }, [trade]);

  useEffect(() => {
    if (!trade) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [trade, onClose]);

  // 1AM-70 phase 6: reset drag state when the trade swaps in the drawer
  // (Related-filings hot-swap). Without this, an in-flight drag offset
  // would persist into the new trade's render. Hot-swap during an active
  // drag is unlikely (single-finger interaction), but the reset is cheap
  // safety against any partial-state carryover.
  useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
    dragStateRef.current = null;
  }, [trade?.id]);

  // 1AM-163: Disclosure Timeline data. Currently mock; swap-point for real
  // FMP/Quiver historical-price + latest-quote when 1AM-174 lands. Hook
  // returns null prices when data is unavailable — conditional render below
  // hides the entire section in that case (per ticket spec: no skeleton,
  // no error message in drawer, just clean omission).
  //
  // 1AM-163 hotfix: hook MUST be called before the `if (!trade) return null`
  // early return to avoid React error #310 (hook-count mismatch between
  // renders). Hook itself safely handles null/undefined trade by returning
  // all-null prices — no behavioural difference, just placement.
  const {
    tradePrice,
    filedPrice,
    todayPrice,
    todayTimestamp,
    loading: pricesLoading,
    error: pricesError,
  } = useDisclosurePrices(trade);
  const showDisclosureTimeline =
    !pricesLoading &&
    !pricesError &&
    tradePrice != null &&
    filedPrice != null &&
    todayPrice != null;

  if (!trade) return null;

  // ── Computed display values ──────────────────────────────────────────────
  const isBuy = trade.action === 'Purchase';
  const actionColor = isBuy ? '#059669' : '#DC2626';
  const actionLabel = isBuy ? 'Bought' : 'Sold';
  const actionGlyph = isBuy ? '▲' : '▼';

  const initials = getInitials(trade.politician);

  // First name for the Follow CTA label, e.g. "April Delaney" → "April".
  // Used in "Follow April" — sentence-case invitation. Edge cases:
  //   - "April McClain Delaney" → "April" (still right; first token)
  //   - "Dr. Phil" → "Dr." (acceptable; vanishingly rare in congress data)
  //   - empty/missing → "" → label collapses to "Follow" gracefully
  const firstName = (trade.politician || '').split(' ')[0] || '';

  // Chamber · state · district line via the canonical formatter (1AM-37)
  // when the politicus is in congress.json. Cascading fallback when not:
  //   - member found → "House · CA-11" / "Senate · CA"
  //   - member missing but trade.chamber present → just "House" / "Senate"
  //     (graceful for politicians like "April Delaney" whose canonical name
  //     in congress.json is "April McClain Delaney" — name-matching desync
  //     tracked separately as 1AM-148; until that ships, we don't punish
  //     the user with a hard "metadata unavailable" line)
  //   - both missing → "Member metadata unavailable" (hard fallback)
  let chamberLine;
  if (member) {
    chamberLine = formatChamberLine({
      chamber: member.chamber,
      state: member.state,
      district: member.district,
    });
  } else if (trade.chamber) {
    chamberLine = trade.chamber;
  } else {
    chamberLine = 'Member metadata unavailable';
  }

  const companyName = sectorInfo?.companyName || trade.companyName || '';
  const sectorName = sectorInfo?.sector || trade.sector || '';

  // "Filed Xd after trade" copy. Reuses the existing formatFiledRelative
  // helper so the phrasing matches TradeCard ("filed 7 days later"). The
  // helper returns lowercase (designed for inline use after a date prefix
  // in TradeCard); drawer renders standalone, so we capitalise the first
  // character manually for a complete-sentence read.
  // text-transform: capitalize CSS would title-case every word ("Filed 7
  // Days Later") which reads as a label, not a sentence — phase 2 hotfix2.
  const filedRelativeRaw = formatFiledRelative(trade.filedDate, trade.tradeDate);
  const filedDisplay = filedRelativeRaw
    ? filedRelativeRaw.charAt(0).toUpperCase() + filedRelativeRaw.slice(1)
    : 'Filing date unknown';

  // 1AM-70 phase 6: swipe-down dismiss thresholds.
  // Distance threshold (40% of sheet height) covers slow long swipes;
  // velocity threshold (0.5 px/ms ≈ 500 px/s) covers fast short flicks.
  // Either path triggers dismiss — both reflect intent. Pure-distance
  // alone would dismiss accidentally on iOS scroll-bounce rebound; pure-
  // velocity alone would miss careful slow swipes that clearly cross
  // the visual midpoint.
  const DRAG_DISTANCE_RATIO = 0.4;
  const DRAG_VELOCITY_THRESHOLD = 0.5;
  const DRAG_VELOCITY_WINDOW_MS = 100;
  const DRAG_DISMISS_ANIMATION_MS = 200;

  const handleTouchStart = (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    dragStateRef.current = {
      startY: touch.clientY,
      startTime: performance.now(),
      sheetHeight: sheetRef.current?.getBoundingClientRect().height || 0,
      samples: [{ y: touch.clientY, t: performance.now() }],
    };
    setIsDragging(true);
  };

  const handleTouchMove = (event) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const touch = event.touches[0];
    const deltaY = touch.clientY - drag.startY;
    // Only track downward drag — upward (negative) clamps to 0 so users
    // can't pull the sheet up beyond its rest position. Native browser
    // bounce would otherwise feel inconsistent across iOS/Android.
    const clamped = Math.max(0, deltaY);
    setDragOffset(clamped);
    // Keep the recent-samples window small — used only for the velocity
    // calc on touchend. Drop samples older than the window to keep the
    // array bounded.
    const now = performance.now();
    drag.samples.push({ y: touch.clientY, t: now });
    while (
      drag.samples.length > 0 &&
      now - drag.samples[0].t > DRAG_VELOCITY_WINDOW_MS
    ) {
      drag.samples.shift();
    }
  };

  const handleTouchEnd = () => {
    const drag = dragStateRef.current;
    if (!drag) return;
    dragStateRef.current = null;
    setIsDragging(false);

    const finalDelta = dragOffset;
    const sheetHeight = drag.sheetHeight;
    const distancePassed =
      sheetHeight > 0 && finalDelta > sheetHeight * DRAG_DISTANCE_RATIO;

    // Velocity over the recent-samples window: (last.y - first.y) / dt.
    // Positive velocity = downward motion. We require minimum 2 samples
    // for a meaningful slope.
    let velocity = 0;
    if (drag.samples.length >= 2) {
      const first = drag.samples[0];
      const last = drag.samples[drag.samples.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) {
        velocity = (last.y - first.y) / dt;
      }
    }
    const velocityPassed = velocity > DRAG_VELOCITY_THRESHOLD;

    if (distancePassed || velocityPassed) {
      // Animate to fully off-screen, then trigger close. Don't unmount
      // immediately — the user expects to see the sheet slide out.
      setDragOffset(sheetHeight || window.innerHeight);
      window.setTimeout(onClose, DRAG_DISMISS_ANIMATION_MS);
    } else {
      // Snap back to rest position. The transition (re-enabled because
      // isDragging is now false) handles the animation smoothly.
      setDragOffset(0);
    }
  };

  return (
    <>
      {/* ── Backdrop scrim ─────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(13, 27, 42, 0.45)',
          zIndex: 40,
          animation: 'tdd-fadeIn 200ms ease-out',
        }}
      />

      {/* ── Sheet ──────────────────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Trade detail for ${trade.ticker} by ${trade.politician}`}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FFFFFF',
          borderRadius: '24px 24px 0 0',
          zIndex: 50,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 32px rgba(13, 27, 42, 0.15)',
          // 1AM-70 phase 6: open animation runs only on first mount (no
          // dragOffset yet, so transform is a no-op then). After mount
          // dragOffset drives the position via inline transform; isDragging
          // disables the transition during finger-tracking so the sheet
          // follows instantly, and re-enables it for snap-back / dismiss
          // animations after release.
          animation:
            dragOffset === 0 && !isDragging
              ? 'tdd-slideUp 250ms ease-out'
              : 'none',
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging
            ? 'none'
            : `transform ${DRAG_DISMISS_ANIMATION_MS}ms ease-out`,
          touchAction: 'pan-y',
        }}
      >
        {/* 1AM-70 phase 6: swipe-down gesture. Touch handlers attached to
            the grab handle area only (not the whole sheet) — handle-only
            v1 keeps the implementation focused and avoids conflict with
            content scroll / related-trade row taps inside the sheet. The
            handle's touch-target is ~44×44 (the visible 36×3 pill plus
            the surrounding 8px+ vertical padding), which meets common
            touch-target sizing. Cursor stays default — desktop clicks
            don't trigger drag (no touch events fire). */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 4px',
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              width: 36,
              height: 3,
              borderRadius: 2,
              background: '#D1D5DB',
            }}
          />
        </div>

        {/* Scrollable content area */}
        <div
          ref={contentRef}
          style={{
            overflowY: 'auto',
            padding: '8px 24px 32px',
            flexGrow: 1,
          }}
        >
          {/* ── Header (1AM-70 phase 2, photos via 1AM-146) ──────────────── */}
          {/* Avatar + politicus name (Playfair) + secondary chamber line.
              Photo from unitedstates/images via Avatar's bioguideId prop —
              graceful initials fallback if bioguideId missing or photo 404s.
              Family-trade asymmetry: spouse/dependent trades show initials
              only (politicus is not the actor). Joint trades DO show photo
              (politicus is mede-actor of the transaction). */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 20,
              marginTop: 8,
            }}
          >
            <Avatar
              bioguideId={
                ['self', 'joint'].includes(trade.owner || 'self')
                  ? member?.bioguideId
                  : null
              }
              initials={initials}
              party={trade.party}
              size="lg"
            />
            <div style={{ minWidth: 0, flexGrow: 1 }}>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 22,
                  fontWeight: 600,
                  color: '#0D1B2A',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {trade.politician}
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: '#6B7280',
                  marginTop: 2,
                }}
              >
                {chamberLine}
              </div>
            </div>
          </div>

          {/* ── Bought-block (1AM-70 phase 2) ───────────────────────────── */}
          {/* Card with action label, ticker, company + sector, amount range,
              filed-info. Source attribution + disclosureUrl at the bottom
              (1AM-157 — link present when upstream feed provides it). */}
          <div
            style={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: 16,
              padding: '20px 20px 16px',
              marginBottom: 20,
            }}
          >
            {/* Action label — color-matched to buy/sell */}
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: actionColor,
                marginBottom: 8,
              }}
            >
              {actionGlyph} {actionLabel}
            </div>

            {/* Ticker — large, color-matched */}
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 36,
                fontWeight: 700,
                color: actionColor,
                lineHeight: 1.1,
                marginBottom: 6,
              }}
            >
              {trade.ticker}
            </div>

            {/* Company name · sector. Phase 4: sector becomes tap-to-filter
                when sectorName + onSectorClick are both available, with a
                "Tap sector to filter" muted hint below as discoverability
                cue. The sector renders as a button with underline-on-hover
                styling so the affordance reads as link-like (similar to
                "More filters →" in Browse). When sectorName is empty
                (unknown ticker), the entire sector segment is hidden — no
                tappable affordance for missing data.
                Hide the hint when no sectorName OR no onSectorClick handler
                so there's no false promise. */}
            {(companyName || sectorName) && (
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    color: '#0D1B2A',
                  }}
                >
                  {companyName}
                  {companyName && sectorName && (
                    <span style={{ color: '#9CA3AF' }}> · </span>
                  )}
                  {sectorName && (
                    typeof onSectorClick === 'function' ? (
                      <button
                        type="button"
                        onClick={() => onSectorClick(sectorName)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 14,
                          color: '#6B7280',
                          textDecoration: 'underline',
                          textDecorationColor: '#D1D5DB',
                          cursor: 'pointer',
                        }}
                      >
                        {sectorName}
                      </button>
                    ) : (
                      <span style={{ color: '#6B7280' }}>{sectorName}</span>
                    )
                  )}
                </div>
                {sectorName && typeof onSectorClick === 'function' && (
                  <div
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 11,
                      color: '#9CA3AF',
                      marginTop: 4,
                    }}
                  >
                    Tap sector to filter
                  </div>
                )}
              </div>
            )}

            {/* Amount range — full range, not midpoint. The midpoint is a
                filter-logic implementation detail; users see the source-
                accurate range here. */}
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#9CA3AF',
                marginBottom: 4,
              }}
            >
              Amount
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 16,
                fontWeight: 600,
                color: '#0D1B2A',
                marginBottom: 14,
              }}
            >
              {trade.amount || '—'}
            </div>

            {/* Filed-relative line. Capitalised once at the start (manual,
                not via text-transform: capitalize which would title-case
                every word — phase 2 hotfix2). Phrasing matches TradeCard's
                "filed 7 days later" with just the first letter promoted. */}
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: '#6B7280',
                marginBottom: 12,
              }}
            >
              {filedDisplay}
            </div>

            {/* 1AM-157: source attribution + PTR-filing link. When the
                upstream feed provides a disclosureUrl (House FMP feed
                returns `link` → PDF on disclosures-clerk.house.gov), render
                a real external-link affordance. Otherwise fall back to the
                muted "not yet linked" hint — honest about the gap rather
                than a broken or generic-search-page affordance. */}
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                color: '#9CA3AF',
                paddingTop: 12,
                borderTop: '1px solid #E5E7EB',
                lineHeight: 1.4,
              }}
            >
              Filed via {getSourceDisplayName(trade.source)}
              {trade.disclosureUrl ? (
                <>
                  {' · '}
                  <a
                    href={trade.disclosureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#0D1B2A',
                      textDecoration: 'underline',
                      textDecorationColor: '#9CA3AF',
                      textUnderlineOffset: 2,
                    }}
                    aria-label={`View original PTR filing for ${trade.politician}'s ${trade.ticker} ${trade.action.toLowerCase()} (opens in new tab)`}
                  >
                    View original PTR filing →
                  </a>
                </>
              ) : (
                ' · Original disclosure not yet linked'
              )}
            </div>
          </div>

          {/* ── Action row (1AM-70 phase 3) ─────────────────────────────── */}
          {/* Side-by-side primary + secondary action buttons.
                - Primary: filled-navy "Follow [FirstName]" → toggles follow
                  state. Switches to outlined "✓ Following" when already
                  following, matching the discovery-context invitation copy
                  pattern (vs. PoliticianDetailScreen's profile-context
                  "Follow"/"Unfollow" pair).
                - Secondary: outlined "View all trades" → navigates to the
                  PoliticianDetailScreen via the parent's onViewProfile
                  callback. Drawer auto-dismisses inside that callback so
                  the navigation transition feels clean.
              Gender-neutral copy: "View all trades" (not "her/his trades")
              avoids needing gender data we don't have on the Trade
              typedef; the drawer header above already establishes whose
              trades they are. */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              marginBottom: 24,
              marginTop: 4,
            }}
          >
            <button
              type="button"
              onClick={onToggleFollow}
              aria-pressed={isFollowing}
              style={{
                flex: 1,
                padding: '12px 14px',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease',
                // Filled-navy when not following (call-to-action), outlined
                // navy when following (acknowledges current state without
                // shouting). Tapping outlined-navy un-follows.
                background: isFollowing ? '#FFFFFF' : '#0D1B2A',
                color: isFollowing ? '#0D1B2A' : '#FAFAF7',
                border: '1px solid #0D1B2A',
              }}
            >
              {isFollowing ? '✓ Following' : `Follow ${firstName}`}
            </button>
            <button
              type="button"
              onClick={onViewProfile}
              style={{
                flex: 1,
                padding: '12px 14px',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                borderRadius: 12,
                background: '#FFFFFF',
                color: '#0D1B2A',
                border: '1px solid #E5E7EB',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              View all trades
            </button>
          </div>

          {/* ── Disclosure Timeline section (1AM-163) ─────────────────────── */}
          {/* Renders only when all three prices are available. Missing data
              hides the entire section (header + body) per ticket spec — no
              skeleton, no error message, no placeholder copy. Cleanly omits.

              Mock data via useDisclosurePrices for now; swap-point for real
              FMP/Quiver historical + latest-quote when 1AM-174 commercial
              data-source decision lands. Component itself is data-agnostic
              and ready for the swap with zero changes.

              Section-header styling matches Related filings convention (DM
              Sans 11px uppercase tracking, #6B7280) so the two sections
              read as a cohesive metadata pair below the primary Bought-block. */}
          {showDisclosureTimeline && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#6B7280',
                  marginBottom: 12,
                }}
              >
                Disclosure Timeline
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <DisclosureTimeline
                  tradeDate={trade.tradeDate}
                  tradePrice={tradePrice}
                  filedDate={trade.filedDate}
                  filedPrice={filedPrice}
                  todayPrice={todayPrice}
                  todayTimestamp={todayTimestamp}
                />
              </div>
            </div>
          )}

          {/* ── Related filings section (1AM-70 phase 5) ─────────────────── */}
          {/* Renders only when there are related trades to show. Empty array
              (no selectedTrade sector / no other trades in same sector) →
              entire block (header + body) returns null per design Q&A
              2026-05-09: no header-with-empty-body rendering, drawer's
              bottom-padding stays consistent with-or-without this section.

              Source = parent's relatedTrades useMemo, computed against
              allFetchedTrades (NOT visibleTrades) so the sector-scoped
              promise of "Related filings in [Sector]" isn't undermined by
              the user's active filters.

              Row tap → onRelatedTradeClick(trade) hot-swaps drawer content
              without dismiss/re-open animation. Drawer stays mounted, the
              useMemos recompute for the new trade.

              Politicus identity = avatar with initials in the circle, no
              accompanying name string per design Q&A 2026-05-09. The full
              name surfaces on PoliticianDetailScreen via "View all trades"
              navigation; row-density on 375px viewport doesn't survive an
              extra name string per row × 3 rows.

              Redundancy is accepted by design — if the same politicus
              appears in all 3 rows that's a discovery signal ("active in
              this sector"), not noise to dedupe. */}
          {relatedTrades.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#6B7280',
                  marginBottom: 12,
                }}
              >
                Related filings{sectorName ? ` in ${sectorName}` : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {relatedTrades.map((rt) => {
                  const isBuy = rt.action === 'buy';
                  const actionColor = isBuy ? '#059669' : '#DC2626';
                  const actionLabel = isBuy ? '▲ BUY' : '▼ SELL';
                  // 1AM-146: resolve photo per related-row. Spouse/dependent
                  // rows skip the photo (initials only); self/joint rows show
                  // the politicus photo (mede-actor of the joint transaction).
                  const rtOwner = rt.owner || 'self';
                  const rtMatches = ['self', 'joint'].includes(rtOwner)
                    ? findByName(rt.politician)
                    : [];
                  const rtBioguideId =
                    rtMatches.length > 0 ? rtMatches[0].bioguideId : null;
                  return (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() =>
                        typeof onRelatedTradeClick === 'function' &&
                        onRelatedTradeClick(rt)
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        background: '#FFFFFF',
                        border: '1px solid #F3F4F6',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        textAlign: 'left',
                        transition: 'background 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <Avatar
                        bioguideId={rtBioguideId}
                        size="sm"
                        initials={getInitials(rt.politician)}
                        party={rt.party}
                      />
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: '#0D1B2A',
                          minWidth: 0,
                        }}
                      >
                        {rt.ticker}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: actionColor,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {actionLabel}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#6B7280',
                        }}
                      >
                        {abbreviateAmount(rt.amount)}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: '#9CA3AF',
                          marginLeft: 'auto',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatShortDate(rt.tradeDate)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tdd-slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes tdd-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

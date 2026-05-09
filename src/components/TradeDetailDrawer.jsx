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
//     ("Filed via FMP · Original disclosure not yet linked") — honest gap
//     marker until 1AM-157 wires the disclosureUrl through the data layer.
//
// Phase 3 will add Follow + View all trades action row.
// Phase 4 will make the sector text tap-to-filter (wires sectorFilter
// state in BrowseAllFilingsScreen).
// Phase 5 will add the Related filings section.
// Phase 6 will add the swipe-down gesture.
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

import { useEffect, useMemo, useRef } from 'react';
import Avatar from './Avatar';
import { findByName } from '../lib/congress';
import { formatChamberLine } from '../lib/formatChamberLine';
import { lookupSector } from '../lib/sectors';
import { formatFiledRelative } from '../lib/dates';

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

export default function TradeDetailDrawer({ trade, onClose }) {
  // Ref to the scrollable content area. Phase 6 will read scrollTop to gate
  // the swipe-down gesture; phase 1+ wires the ref so structure is in place.
  const contentRef = useRef(null);

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

  if (!trade) return null;

  // ── Computed display values ──────────────────────────────────────────────
  const isBuy = trade.action === 'Purchase';
  const actionColor = isBuy ? '#059669' : '#DC2626';
  const actionLabel = isBuy ? 'Bought' : 'Sold';
  const actionGlyph = isBuy ? '▲' : '▼';

  const initials = getInitials(trade.politician);

  // Chamber · state · district line via the canonical formatter (1AM-37).
  // Falls back to a muted "Member metadata unavailable" when findByName
  // returned nothing — same wording as PoliticianDetailScreen for
  // consistency.
  const chamberLine = member
    ? formatChamberLine({
        chamber: member.chamber,
        state: member.state,
        district: member.district,
      })
    : null;

  const companyName = sectorInfo?.companyName || trade.companyName || '';
  const sectorName = sectorInfo?.sector || trade.sector || '';

  // "Filed Xd after trade" copy. Reuses the existing formatFiledRelative
  // helper so the phrasing matches TradeCard ("filed 7 days later"). The
  // helper handles same-day, late-filing, and missing-date cases.
  const filedRelative = formatFiledRelative(trade.filedDate, trade.tradeDate);

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
          animation: 'tdd-slideUp 250ms ease-out',
        }}
      >
        {/* Grab handle (phase 6 will attach swipe-down handlers here) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 4px',
            flexShrink: 0,
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
          {/* ── Header (1AM-70 phase 2) ─────────────────────────────────── */}
          {/* Avatar + politicus name (Playfair) + secondary chamber line.
              Avatar uses initials fallback; when 1AM-146 ships (politician
              headshots), the existing Avatar component auto-upgrades to
              photo via its existing prop interface. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 20,
              marginTop: 8,
            }}
          >
            <Avatar initials={initials} party={trade.party} size="lg" />
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
                {chamberLine || 'Member metadata unavailable'}
              </div>
            </div>
          </div>

          {/* ── Bought-block (1AM-70 phase 2) ───────────────────────────── */}
          {/* Card with action label, ticker, company + sector, amount range,
              filed-info. Source attribution at the bottom as a muted hint
              until 1AM-157 wires up disclosureUrl. */}
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

            {/* Company name · sector. Sector is rendered non-interactive in
                phase 2; phase 4 will make it tappable to activate the Browse
                sector filter. Hide the line entirely when both are missing
                (unknown ticker like BRK.B from the 1AM-37 sectors miss). */}
            {(companyName || sectorName) && (
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  color: '#0D1B2A',
                  marginBottom: 18,
                }}
              >
                {companyName}
                {companyName && sectorName && (
                  <span style={{ color: '#9CA3AF' }}> · </span>
                )}
                {sectorName && (
                  <span style={{ color: '#6B7280' }}>{sectorName}</span>
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

            {/* Filed-relative line. Reuses existing formatFiledRelative so
                the phrasing matches TradeCard ("filed 7 days later"). */}
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                color: '#6B7280',
                marginBottom: 12,
              }}
            >
              {filedRelative ? `Filed ${filedRelative}` : 'Filing date unknown'}
            </div>

            {/* Source attribution + honest disclosure-link gap (1AM-157).
                Muted micro-text — not a clickable affordance. Once 1AM-157
                ships disclosureUrl through the data layer, this line gets
                replaced with a real "View original PTR filing →" link. */}
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
              Filed via {getSourceDisplayName(trade.source)} · Original
              disclosure not yet linked
            </div>
          </div>

          {/* Phase 3 placeholder: action row (Follow + View all trades) */}
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              color: '#9CA3AF',
              fontSize: 12,
              textAlign: 'center',
              padding: '12px 0',
            }}
          >
            Action row + Related filings land in phases 3–5.
          </div>
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

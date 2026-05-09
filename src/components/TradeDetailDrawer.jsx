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

export default function TradeDetailDrawer({
  trade,
  onClose,
  isFollowing = false,
  onToggleFollow,
  onViewProfile,
}) {
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
                {chamberLine}
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

          {/* Phase 4-5 placeholder: sector tap-to-filter + Related filings */}
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              color: '#9CA3AF',
              fontSize: 12,
              textAlign: 'center',
              padding: '12px 0',
            }}
          >
            Sector tap-to-filter + Related filings land in phases 4–5.
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

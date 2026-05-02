// SAA-4: TradeCard Component
// Main card used in the feed for each individual trade
// Supports expanded state with quick action buttons
// Props: trade, onSetAlert, onViewProfile, onViewTicker, highlighted, following, owner,
//        onPoliticianClick
// 1AM-65: `following` (bool) renders a green "Following ✓" pill, `owner`
//         ('self'|'spouse'|'joint'|'dependent') renders a coral owner pill
//         when not 'self'.
// 1AM-69: `onPoliticianClick(name)` makes the politician name a navigable
//         link to the detail page. When omitted, the name renders as plain
//         text — used in PoliticianDetailScreen's own trade history (where
//         linking to itself would be circular).
// 1AM-114: bottom-right "FILED" cell now shows the trade date inline with
//         the filing delta — "May 1 · filed 4 days later". Variant A from
//         the 1AM-114 mockup decision; applied globally so the filter on
//         Browse has visual confirmation everywhere.

import { useState } from 'react';
import Avatar from './Avatar';
import { PartyBadge, ChamberBadge, SourceBadge } from './Badge';
import { formatShortDate, formatFiledRelative, isLateFiling } from '../lib/dates';

// 1AM-65: shared style for the inline name-row pills (Following + owner).
// Same shape, different colours — kept inline so the pills are self-contained.
const NAME_PILL_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 6px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif",
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const FOLLOWING_PILL_STYLE = {
  ...NAME_PILL_BASE,
  background: 'rgba(5, 150, 105, 0.1)',
  color: '#059669',
};

const OWNER_PILL_STYLE = {
  ...NAME_PILL_BASE,
  background: 'rgba(216, 90, 48, 0.1)',
  color: '#D85A30',
};

// 1AM-114: composes the trade date + filing delta into one inline string.
// Returns the joined "May 1 · filed 4 days later" form, or a sensible
// fallback when one or both helpers can't format the input.
function formatTradeAndFiled(tradeDate, filedDate) {
  const tradeStr = formatShortDate(tradeDate);
  const filedStr = formatFiledRelative(filedDate, tradeDate);
  const combined = [tradeStr, filedStr].filter(Boolean).join(' · ');
  return combined || filedDate || '—';
}

export default function TradeCard({
  trade,
  onSetAlert,
  onViewProfile,
  onViewTicker,
  onPoliticianClick,
  highlighted = false,
  following = false,
  owner = 'self',
}) {
  const [expanded, setExpanded] = useState(false);

  const isBuy = trade.action === 'Purchase';
  const actionColor = isBuy ? '#059669' : '#DC2626';
  const actionLabel = isBuy ? '▲ BUY' : '▼ SELL';

  // Generate initials from politician name
  const initials = trade.politician
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // 1AM-65: owner is 'self' by default → no owner pill rendered.
  // Trade-level `owner` prop overrides trade.owner if the parent supplies one,
  // letting screens like an unfollowed-Discovery feed override behaviour later.
  const effectiveOwner = owner || trade.owner || 'self';
  const showOwnerPill = effectiveOwner !== 'self';

  return (
    <div
      style={{
        background: highlighted ? '#FFFBEB' : '#FFFFFF',
        borderRadius: '16px',
        border: `1px solid ${highlighted ? '#FDE68A' : '#E5E7EB'}`,
        borderLeft: `3px solid ${actionColor}`,
        overflow: 'hidden',
        marginBottom: '10px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease',
        boxShadow: expanded ? '0 4px 20px rgba(13, 27, 42, 0.08)' : 'none',
      }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(13, 27, 42, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = expanded
          ? '0 4px 20px rgba(13, 27, 42, 0.08)'
          : 'none';
      }}
    >
      {/* ── Main content ── */}
      <div style={{ padding: '14px 16px' }}>

        {/* Top row: avatar + name + ticker */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '10px',
          }}
        >
          {/* Left: avatar + name + badges */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Avatar initials={initials} party={trade.party} size="sm" />
            <div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 700,
                  fontSize: '14px',
                  color: '#0D1B2A',
                  marginBottom: '4px',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {onPoliticianClick ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPoliticianClick(trade.politician);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      font: 'inherit',
                      color: '#0D1B2A',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                      textDecorationColor: '#D1D5DB',
                    }}
                    aria-label={`View ${trade.politician} profile`}
                  >
                    {trade.politician}
                  </button>
                ) : (
                  <span>{trade.politician}</span>
                )}
                {following && (
                  <span style={FOLLOWING_PILL_STYLE} aria-label="You follow this politician">
                    Following ✓
                  </span>
                )}
                {showOwnerPill && (
                  <span style={OWNER_PILL_STYLE} aria-label={`Trade owner: ${effectiveOwner}`}>
                    {effectiveOwner}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <PartyBadge party={trade.party} small />
                <ChamberBadge chamber={trade.chamber} small />
              </div>
            </div>
          </div>

          {/* Right: ticker + action */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#0D1B2A',
                fontFamily: "'Playfair Display', serif",
                marginBottom: '2px',
              }}
            >
              {trade.ticker}
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: actionColor,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {actionLabel}
            </div>
          </div>
        </div>

        {/* Bottom row: amount (prominent) + filing-delta. 1AM-86: source moved
            to expanded view; filed-date contextualised as "N days after trade".
            1AM-114: filed-cell now combines trade date + filing delta inline. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '10px',
            borderTop: '1px solid #F3F4F6',
          }}
        >
          <div>
            <div style={{ fontSize: '9px', color: '#9CA3AF', fontFamily: 'monospace', marginBottom: '2px' }}>
              AMOUNT
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0D1B2A', fontFamily: 'monospace' }}>
              {trade.amount}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9px', color: '#9CA3AF', fontFamily: 'monospace', marginBottom: '2px' }}>
              FILED
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: isLateFiling(trade.filedDate, trade.tradeDate) ? '#D97706' : '#6B7280',
                fontFamily: 'monospace',
              }}
            >
              {formatTradeAndFiled(trade.tradeDate, trade.filedDate)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Expanded quick actions ── */}
      {expanded && (
        <div
          style={{
            padding: '12px 16px',
            background: '#F9FAFB',
            borderTop: '1px solid #F3F4F6',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace', marginBottom: '8px', letterSpacing: '0.06em' }}>
            QUICK ACTIONS
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>

            {/* Set Alert */}
            <button
              onClick={() => onSetAlert?.(trade)}
              style={{
                flex: 1,
                padding: '9px 0',
                background: '#0D1B2A',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.target.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.target.style.opacity = '1')}
            >
              🔔 Alert
            </button>

            {/* View Profile */}
            <button
              onClick={() => onViewProfile?.(trade)}
              style={{
                flex: 1,
                padding: '9px 0',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                color: '#0D1B2A',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.target.style.background = '#F9FAFB')}
              onMouseLeave={(e) => (e.target.style.background = '#FFFFFF')}
            >
              👤 Profile
            </button>

            {/* View Ticker */}
            <button
              onClick={() => onViewTicker?.(trade)}
              style={{
                flex: 1,
                padding: '9px 0',
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '10px',
                color: '#0D1B2A',
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.target.style.background = '#F9FAFB')}
              onMouseLeave={(e) => (e.target.style.background = '#FFFFFF')}
            >
              📊 {trade.ticker}
            </button>
          </div>

          {/* 1AM-86: source moved here from main bottom-row. Power-user concern;
              kept accessible without taking primary visual space. */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '6px',
              marginTop: '10px',
              fontSize: '10px',
              color: '#9CA3AF',
              fontFamily: 'monospace',
            }}
          >
            <span>SOURCE</span>
            <SourceBadge source={trade.source} small />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Usage example ─────────────────────────────────────────────────────────────
// const trade = {
//   id: 1,
//   source: 'capitoltrades',
//   politician: 'Nancy Pelosi',
//   party: 'D',
//   chamber: 'House',
//   ticker: 'NVDA',
//   action: 'Purchase',
//   amount: '$500K–$1M',
//   tradeDate: '2026-04-10',
//   filedDate: '2026-04-15',
// };
//
// <TradeCard
//   trade={trade}
//   onSetAlert={(t) => console.log('alert', t)}
//   onViewProfile={(t) => console.log('profile', t)}
//   onViewTicker={(t) => console.log('ticker', t)}
//   highlighted={false}
// />

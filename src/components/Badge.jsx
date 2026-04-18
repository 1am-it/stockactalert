// SAA-3: Badge and CommitteeBadge Components
// Badge: generic reusable badge for party, chamber, action type etc.
// CommitteeBadge: auto-colours based on committee name using theme tokens

import { getCommitteeColor } from '../styles/theme';

// ─── Generic Badge ────────────────────────────────────────────────────────────
// Props: children, color (hex), small (boolean)
export function Badge({ children, color = '#6B7280', small = false }) {
  return (
    <span
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}35`,
        borderRadius: '4px',
        padding: small ? '1px 6px' : '2px 8px',
        fontSize: small ? '10px' : '11px',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {children}
    </span>
  );
}

// ─── Party Badge ──────────────────────────────────────────────────────────────
// Shorthand for party D/R badges
export function PartyBadge({ party, small = false }) {
  const color = party === 'D' ? '#1D4ED8' : party === 'R' ? '#DC2626' : '#6B7280';
  return (
    <Badge color={color} small={small}>
      {party}
    </Badge>
  );
}

// ─── Chamber Badge ────────────────────────────────────────────────────────────
// House or Senate
export function ChamberBadge({ chamber, small = false }) {
  return (
    <Badge color="#6B7280" small={small}>
      {chamber}
    </Badge>
  );
}

// ─── Action Badge ─────────────────────────────────────────────────────────────
// Purchase (green) or Sale (red)
export function ActionBadge({ action, small = false }) {
  const color = action === 'Purchase' ? '#059669' : action === 'Sale' ? '#DC2626' : '#6B7280';
  const label = action === 'Purchase' ? '▲ BUY' : action === 'Sale' ? '▼ SELL' : action;
  return (
    <Badge color={color} small={small}>
      {label}
    </Badge>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────
// Data source indicator: Capitol Trades / Unusual Whales / Quiver / House.gov
const SOURCE_CONFIG = {
  capitoltrades:  { label: 'CT',  color: '#3b82f6' },
  unusualwhales:  { label: 'UW',  color: '#8b5cf6' },
  quiver:         { label: 'QQ',  color: '#f59e0b' },
  housegov:       { label: 'GOV', color: '#10b981' },
};

export function SourceBadge({ source, small = true }) {
  const config = SOURCE_CONFIG[source] || { label: source, color: '#6B7280' };
  return (
    <Badge color={config.color} small={small}>
      {config.label}
    </Badge>
  );
}

// ─── Committee Badge ──────────────────────────────────────────────────────────
// Auto-colours based on committee name
// Armed Services = red / Intelligence = purple / Finance = blue / etc.
export function CommitteeBadge({ name, small = false }) {
  const color = getCommitteeColor(name);

  const BG_COLORS = {
    '#DC2626': '#FEF2F2',
    '#7C3AED': '#F5F3FF',
    '#1D4ED8': '#EFF6FF',
    '#D97706': '#FFFBEB',
    '#059669': '#ECFDF5',
    '#6B7280': '#F9FAFB',
  };

  const bg = BG_COLORS[color] || '#F9FAFB';

  return (
    <span
      style={{
        background: bg,
        color,
        border: `1px solid ${color}25`,
        borderRadius: small ? '4px' : '20px',
        padding: small ? '1px 6px' : '3px 9px',
        fontSize: small ? '10px' : '11px',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {name}
    </span>
  );
}

// ─── Usage examples ───────────────────────────────────────────────────────────
// <Badge color="#1D4ED8">Democrat</Badge>
// <PartyBadge party="D" small />
// <ChamberBadge chamber="House" />
// <ActionBadge action="Purchase" />
// <SourceBadge source="capitoltrades" />
// <CommitteeBadge name="Armed Services" />
// <CommitteeBadge name="Intelligence" small />

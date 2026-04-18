// SAA-2: Avatar Component
// Used across feed, politician cards, profiles and bottom sheets
// Props: initials, party, size (sm/md/lg/xl), onClick

import { getPartyColor } from '../styles/theme';

const SIZES = {
  sm: { diameter: '32px', fontSize: '11px' },
  md: { diameter: '44px', fontSize: '14px' },
  lg: { diameter: '56px', fontSize: '18px' },
  xl: { diameter: '64px', fontSize: '22px' },
};

export default function Avatar({ initials, party, size = 'md', onClick }) {
  const { diameter, fontSize } = SIZES[size] || SIZES.md;
  const partyColor = getPartyColor(party);

  return (
    <div
      onClick={onClick}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        background: `${partyColor}12`,
        border: `2px solid ${partyColor}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 800,
        color: partyColor,
        fontFamily: "'DM Sans', sans-serif",
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}

// ── Usage examples ────────────────────────────────────────────────────────────
// <Avatar initials="NP" party="D" size="md" />
// <Avatar initials="TT" party="R" size="lg" />
// <Avatar initials="JG" party="D" size="sm" onClick={() => navigate('/politicians/1')} />

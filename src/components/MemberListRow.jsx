// 1AM-79: Single row in the member list
//
// Compact horizontal row for the onboarding picker (and re-usable later for
// 1AM-68 Politicians-tab redesign). Tap anywhere on the row to toggle follow.
//
// Props:
//   member     — Member object (see src/data/schema.js)
//   isSelected — boolean
//   onToggle   — () => void

const PARTY_COLORS = {
  D: { fg: '#1D4ED8', bg: '#DBEAFE' }, // blue
  R: { fg: '#B91C1C', bg: '#FEE2E2' }, // red
  I: { fg: '#6B7280', bg: '#F3F4F6' }, // grey
};

export default function MemberListRow({ member, isSelected, onToggle }) {
  const partyColor = PARTY_COLORS[member.party] || PARTY_COLORS.I;
  const districtSuffix =
    member.chamber === 'House' && member.district !== undefined
      ? `-${member.district}`
      : '';

  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: isSelected ? '#0D1B2A' : '#FFFFFF',
        border: isSelected ? '1px solid #0D1B2A' : '1px solid #E5E7EB',
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: isSelected ? '#1F2937' : partyColor.bg,
          color: isSelected ? '#FAFAF7' : partyColor.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {member.initials}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: isSelected ? '#FAFAF7' : '#0D1B2A',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {member.name}
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.06em',
            color: isSelected ? '#9CA3AF' : '#6B7280',
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          {member.party} · {member.state}
          {districtSuffix} · {member.chamber}
        </div>
      </div>

      {/* Selection indicator */}
      <div
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: isSelected ? '#059669' : 'transparent',
          border: isSelected ? 'none' : '1.5px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {isSelected && '✓'}
      </div>
    </button>
  );
}

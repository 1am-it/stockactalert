// 1AM-24: Reusable politician picker grid
// Pure presentation component — no data, no CTAs, no header.
// Used by:
//   - OnboardingPickPoliticians (onboarding step 3)
//   - PoliticiansScreen (Politicians tab in main app)
//
// Props:
//   politicians — array of { name, initials, party, chamber } objects
//   selected    — array of currently followed politician names
//   onToggle    — callback (name) => void, called when a card is tapped

const PARTY_COLORS = {
  D: { fg: '#1D4ED8', bg: '#DBEAFE' },  // blue
  R: { fg: '#B91C1C', bg: '#FEE2E2' },  // red
  I: { fg: '#6B7280', bg: '#F3F4F6' },  // grey
};

export default function PoliticianPickGrid({ politicians, selected, onToggle }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
      }}
    >
      {politicians.map((p) => (
        <PoliticianCard
          key={p.name}
          politician={p}
          isSelected={selected.includes(p.name)}
          onClick={() => onToggle(p.name)}
        />
      ))}
    </div>
  );
}

function PoliticianCard({ politician, isSelected, onClick }) {
  const partyColor = PARTY_COLORS[politician.party] || PARTY_COLORS.I;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        padding: '14px 12px',
        background: isSelected ? '#0D1B2A' : '#FFFFFF',
        border: isSelected ? '1px solid #0D1B2A' : '1px solid #E5E7EB',
        borderRadius: 14,
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        transition: 'all 150ms ease',
      }}
    >
      {/* Selection indicator */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: isSelected ? '#059669' : 'transparent',
          border: isSelected ? 'none' : '1.5px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {isSelected && '✓'}
      </div>

      {/* Avatar */}
      <div
        style={{
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
          marginBottom: 10,
        }}
      >
        {politician.initials}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: isSelected ? '#FAFAF7' : '#0D1B2A',
          marginBottom: 4,
          lineHeight: 1.2,
        }}
      >
        {politician.name}
      </div>

      {/* Party · Chamber */}
      <div
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
          color: isSelected ? '#9CA3AF' : '#6B7280',
          textTransform: 'uppercase',
        }}
      >
        {politician.party} · {politician.chamber}
      </div>
    </button>
  );
}

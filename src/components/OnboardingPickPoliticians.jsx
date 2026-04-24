// SAA-15: OnboardingPickPoliticians
// Third onboarding step — user picks at least one politician to follow
// before landing on the main app.
//
// Selection is UI state only for now — the feed doesn't yet filter on it.
// Persistence + feed filtering are separate tickets.
//
// Props:
//   selected   — array of politician names currently selected
//   onToggle   — called with politician name when a card is tapped
//   onNext     — called when user taps "Continue"
//   onBack     — called when user taps "Back"

// Curated list of well-known figures from recent STOCK Act filings.
// Deliberately a mix of chambers and parties — no performance claims.
// Sorted alphabetically by last name so the grid feels intentional
// rather than ranked.
const POLITICIANS = [
  { name: 'Richard Blumenthal', party: 'D', chamber: 'Senate' },
  { name: 'John Boozman', party: 'R', chamber: 'Senate' },
  { name: 'Shelley Moore Capito', party: 'R', chamber: 'Senate' },
  { name: 'Dan Crenshaw', party: 'R', chamber: 'House' },
  { name: 'Ro Khanna', party: 'D', chamber: 'House' },
  { name: 'Angus King', party: 'I', chamber: 'Senate' },
  { name: 'Michael McCaul', party: 'R', chamber: 'House' },
  { name: 'Morgan McGarvey', party: 'D', chamber: 'House' },
  { name: 'Nancy Pelosi', party: 'D', chamber: 'House' },
  { name: 'David Rouzer', party: 'R', chamber: 'House' },
  { name: 'Bernie Sanders', party: 'I', chamber: 'Senate' },
  { name: 'Elise Stefanik', party: 'R', chamber: 'House' },
  { name: 'Tommy Tuberville', party: 'R', chamber: 'Senate' },
  { name: 'Mark Warner', party: 'D', chamber: 'Senate' },
  { name: 'Debbie Wasserman Schultz', party: 'D', chamber: 'House' },
  { name: 'Roger Williams', party: 'R', chamber: 'House' },
  { name: 'Ron Wyden', party: 'D', chamber: 'Senate' },
];

export default function OnboardingPickPoliticians({
  selected = [],
  onToggle,
  onNext,
  onBack,
}) {
  const canContinue = selected.length > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 40,
          paddingBottom: 120, // leaves room for sticky CTA bar
        }}
      >
        {/* ── Headline ───────────────────────────────────────────────────── */}
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 30,
            fontWeight: 800,
            color: '#0D1B2A',
            lineHeight: 1.2,
            margin: '0 0 8px',
            letterSpacing: '-0.01em',
          }}
        >
          Who do you want to follow?
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: '#9CA3AF',
            margin: '0 0 4px',
          }}
        >
          Pick at least one to get started. You can always change this later.
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: '#9CA3AF',
            margin: '0 0 28px',
            fontStyle: 'italic',
          }}
        >
          We don't rank them by returns — congressional performance data is
          noisy and misleading. Just pick who you're curious about.
        </p>

        {/* ── Grid ───────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
          }}
        >
          {POLITICIANS.map((p) => {
            const isSelected = selected.includes(p.name);
            return (
              <PoliticianPickCard
                key={p.name}
                politician={p}
                selected={isSelected}
                onToggle={() => onToggle(p.name)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Sticky CTA bar ───────────────────────────────────────────────── */}
      {/* Fixed to bottom so the user always sees Continue, even with 17 cards */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to bottom, rgba(250,250,247,0) 0%, rgba(250,250,247,0.95) 20%, #FAFAF7 100%)',
          padding: '24px 24px 24px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            onClick={onBack}
            style={{
              flex: '0 0 auto',
              padding: '16px 20px',
              background: '#FFFFFF',
              color: '#0D1B2A',
              border: '1px solid #E5E7EB',
              borderRadius: 14,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
          >
            ← Back
          </button>
          <button
            onClick={canContinue ? onNext : undefined}
            disabled={!canContinue}
            style={{
              flex: 1,
              padding: '16px 20px',
              background: canContinue ? '#0D1B2A' : '#D1D5DB',
              color: '#FAFAF7',
              border: 'none',
              borderRadius: 14,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              cursor: canContinue ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.15s ease, transform 0.1s ease',
            }}
            onMouseEnter={(e) => {
              if (canContinue) e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              if (canContinue) e.currentTarget.style.opacity = '1';
            }}
            onMouseDown={(e) => {
              if (canContinue) e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              if (canContinue) e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {canContinue
              ? `Continue (${selected.length} selected)`
              : 'Pick at least one'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Picker card ──────────────────────────────────────────────────────────────
// Inline because it's only used here. Shows name, party, chamber; visual
// toggle state for selected. Tap-anywhere-on-card to select (mobile-friendly).
function PoliticianPickCard({ politician, selected, onToggle }) {
  const partyColors = {
    D: '#1D4ED8',
    R: '#DC2626',
    I: '#6B7280',
  };
  const partyColor = partyColors[politician.party] || '#6B7280';

  const initials = politician.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onToggle}
      style={{
        background: selected ? '#0D1B2A' : '#FFFFFF',
        color: selected ? '#FAFAF7' : '#0D1B2A',
        border: `1px solid ${selected ? '#0D1B2A' : '#E5E7EB'}`,
        borderRadius: 14,
        padding: '12px 12px 12px 14px',
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
        transition: 'all 0.15s ease',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Checkmark indicator */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: selected ? '#059669' : 'transparent',
          border: `1.5px solid ${selected ? '#059669' : '#D1D5DB'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#FAFAF7',
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {selected && '✓'}
      </div>

      {/* Avatar circle with initials */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: selected ? 'rgba(250, 250, 247, 0.12)' : `${partyColor}18`,
          border: `2px solid ${selected ? 'rgba(250, 250, 247, 0.3)' : partyColor + '40'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: selected ? '#FAFAF7' : partyColor,
          marginBottom: 8,
        }}
      >
        {initials}
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 4,
          lineHeight: 1.2,
        }}
      >
        {politician.name}
      </div>

      {/* Party + Chamber meta */}
      <div
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          opacity: selected ? 0.8 : 0.55,
          textTransform: 'uppercase',
        }}
      >
        {politician.party} · {politician.chamber}
      </div>
    </button>
  );
}

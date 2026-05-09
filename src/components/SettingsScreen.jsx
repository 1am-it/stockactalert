// 1AM-124: SettingsScreen
// Full-page overlay reached from the gear icon in HeaderBar (top-right of
// each tab). Replaces the previous Settings-tab in the bottom-nav (removed
// in 1AM-124). Content stays placeholder for now — real settings UI comes
// in a follow-up ticket once we know what users actually need configurable.
//
// Pattern: matches PoliticianDetailScreen overlay shape — own page header
// with `← Back` link top-left, content below.
//
// Props:
//   onBack — callback when the user taps `← Back`

export default function SettingsScreen({ onBack }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '40px 24px 100px',
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#6B7280',
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
            padding: 0,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0D1B2A';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#6B7280';
          }}
        >
          ← Back
        </button>

        <h1
          style={{
            fontSize: 32,
            margin: '0 0 8px',
            color: '#0D1B2A',
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontWeight: 500,
          }}
        >
          Settings
        </h1>
        <p
          style={{
            color: '#6B7280',
            fontSize: 14,
            margin: '0 0 32px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          App settings and preferences
        </p>

        {/* Placeholder card — same visual pattern as the Alerts placeholder
            in App.jsx so users get a consistent "coming soon" feel. */}
        <div
          style={{
            padding: '20px',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#6B728018',
              border: '2px solid #6B728030',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            ⚙️
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#0D1B2A',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Settings — coming soon
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#9CA3AF',
              marginTop: 4,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            This screen is built in a later ticket
          </div>
        </div>

        {/* 1AM-146: Photo credits / data acknowledgements card.
            Subtle "About" section that documents the public-domain source of
            politician photos. Card style matches the placeholder above. */}
        <div
          style={{
            padding: '16px 20px',
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6B7280',
              marginBottom: 10,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Credits
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#374151',
              lineHeight: 1.5,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Politician photos are sourced from the{' '}
            <a
              href="https://github.com/unitedstates/images"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0D1B2A', textDecoration: 'underline' }}
            >
              unitedstates/images
            </a>{' '}
            project, dedicated to the public domain under{' '}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0D1B2A', textDecoration: 'underline' }}
            >
              CC0 1.0
            </a>
            . Trade data via Financial Modeling Prep, derived from STOCK Act
            disclosures filed with the U.S. Senate and House of Representatives.
          </div>
        </div>
      </div>
    </div>
  );
}

// SAA-14: OnboardingDataExplainer
// Second onboarding step — explains where the data comes from, how fresh it
// is, and how amount ranges work (so users don't think the app is rounding).
//
// Builds user trust *before* they see the feed.
//
// Props:
//   onNext — called when user taps "Continue"
//   onBack — called when user taps "Back"

export default function OnboardingDataExplainer({ onNext, onBack }) {
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
          maxWidth: 380,
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingTop: 40,
          paddingBottom: 40,
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
          How the data works.
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: '#9CA3AF',
            margin: '0 0 32px',
          }}
        >
          A quick primer so nothing surprises you.
        </p>

        {/* ── Block 1: Source ────────────────────────────────────────────── */}
        <Block
          label="01 · Source"
          title="STOCK Act filings"
          body={
            <>
              Every U.S. Senator and Representative must disclose stock trades
              within <strong style={{ color: '#0D1B2A' }}>45 days</strong>.
              It's federal law since 2012. We pull those filings directly —
              no rumors, no leaks.
            </>
          }
        />

        {/* ── Block 2: Freshness ─────────────────────────────────────────── */}
        <Block
          label="02 · Freshness"
          title="Updated multiple times a day"
          body={
            <>
              Filings can be submitted any day Congress is in session. We
              refresh the feed throughout the day so you see new disclosures
              as soon as they're public.
            </>
          }
        />

        {/* ── Block 3: Amounts ───────────────────────────────────────────── */}
        <Block
          label="03 · Amounts"
          title='Ranges, not exact figures'
          body={
            <>
              Politicians report amounts as ranges like{' '}
              <code
                style={{
                  background: '#F3F4F6',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: '#0D1B2A',
                }}
              >
                $15K–$50K
              </code>
              {' — '}never exact dollar figures. That's how the law is written,
              not a limitation of this app.
            </>
          }
          last
        />

        {/* ── CTAs ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={onBack}
            style={{
              flex: '0 0 auto',
              padding: '16px 20px',
              background: 'transparent',
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
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            style={{
              flex: 1,
              padding: '16px 20px',
              background: '#0D1B2A',
              color: '#FAFAF7',
              border: 'none',
              borderRadius: 14,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease, transform 0.1s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small local Block component ──────────────────────────────────────────────
// Kept inline because it's only used on this screen.
function Block({ label, title, body, last = false }) {
  return (
    <div
      style={{
        paddingBottom: last ? 32 : 24,
        marginBottom: last ? 0 : 24,
        borderBottom: last ? 'none' : '1px solid #F3F4F6',
      }}
    >
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#059669',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 700,
          color: '#0D1B2A',
          margin: '0 0 6px',
          lineHeight: 1.3,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          lineHeight: 1.55,
          color: '#4B5563',
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

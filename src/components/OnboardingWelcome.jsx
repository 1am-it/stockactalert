// SAA-13: OnboardingWelcome (updated in SAA-14)
// First screen a new visitor sees — explains the value proposition briefly,
// then hands off to the next onboarding step via `onNext` callback.
//
// Full-viewport, no TabBar. Onboarding flow is managed by App.jsx.
//
// Props:
//   onNext — called when the user taps the primary CTA

export default function OnboardingWelcome({ onNext }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* ── Visual mark ────────────────────────────────────────────────── */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#0D1B2A',
            margin: '0 auto 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            color: '#FAFAF7',
            fontFamily: "'Playfair Display', serif",
            fontWeight: 800,
          }}
          aria-hidden="true"
        >
          §
        </div>

        {/* ── Headline ───────────────────────────────────────────────────── */}
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36,
            fontWeight: 800,
            color: '#0D1B2A',
            lineHeight: 1.15,
            margin: '0 0 16px',
            letterSpacing: '-0.01em',
          }}
        >
          See what Congress trades
          <br />
          <span style={{ color: '#059669' }}>before the news does.</span>
        </h1>

        {/* ── Subline ────────────────────────────────────────────────────── */}
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            lineHeight: 1.55,
            color: '#6B7280',
            margin: '0 0 40px',
          }}
        >
          Every U.S. Senator and Representative must disclose their stock trades
          under the <strong style={{ color: '#0D1B2A' }}>STOCK Act</strong>.
          We bring those filings straight to your phone — clean, fast,
          and with reliable alerts.
        </p>

        {/* ── Primary CTA ────────────────────────────────────────────────── */}
        <button
          onClick={onNext}
          style={{
            width: '100%',
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
          Get started
        </button>

        {/* ── Footer note ────────────────────────────────────────────────── */}
        <p
          style={{
            fontFamily: 'monospace',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#9CA3AF',
            marginTop: 24,
          }}
        >
          Public data · No account required
        </p>
      </div>
    </div>
  );
}

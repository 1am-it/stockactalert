// 1AM-124: HeaderBar
// 1AM-151: subtitle prop added (optional)
//
// Mini header component used at the top of each top-level tab (Browse, Feed,
// Alerts). Renders the screen title in the editorial serif (Lora as Playfair
// Display stand-in) on the left, with an optional smaller subtitle below it,
// and a gear-icon button on the right that opens the Settings overlay.
//
// Design history:
//   2026-05-04 (1AM-124, A-light decision): no description prop, no logo
//   prop. Lovable's v3-rounded mockup showed only title + gear.
//   2026-05-09 (1AM-151): subtitle prop added because Browse v3 mockup
//   shows "Recent Filings" + "last 30 days" — two lines need typographic
//   coordination (font, color, spacing) that's easier to keep in one place
//   than re-implementing per-screen.
//
// Backward-compatible: callers that pass only `title` get the original
// single-line layout, no spacing changes.
//
// Props:
//   title           — string shown as h1 in the header
//   subtitle        — optional string shown as small DM-Sans line below the title
//   onSettingsClick — callback when the gear icon is tapped

export default function HeaderBar({ title, subtitle, onSettingsClick }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: 32,
            margin: 0,
            color: '#0D1B2A',
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.5px',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div
            style={{
              fontSize: 13,
              color: '#6B7280',
              fontFamily: "'DM Sans', sans-serif",
              marginTop: 6,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <button
        onClick={onSettingsClick}
        aria-label="Open settings"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1px solid #E5E7EB',
          background: '#FFFFFF',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0,
          // Top-aligned with the h1 baseline visually (h1 is 32px font, ~36px line)
          marginTop: 0,
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#F9FAFB';
          e.currentTarget.style.borderColor = '#D1D5DB';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#FFFFFF';
          e.currentTarget.style.borderColor = '#E5E7EB';
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12" cy="12" r="3"
            stroke="#6B7280"
            strokeWidth="2"
          />
          <path
            d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="#6B7280"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

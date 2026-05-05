// 1AM-124: HeaderBar
// Mini header component used at the top of each top-level tab (Browse, and
// later Feed + Alerts in 1AM-125 / 1AM-126). Renders the screen title in the
// editorial serif (Lora as Playfair Display stand-in) on the left, and a
// gear-icon button on the right that opens the Settings overlay.
//
// Design choice (A-light, decided 2026-05-04): no description prop, no logo
// prop. Lovable's v3-rounded mockup shows only title + gear, so the component
// stays minimal. If we later need a description regel, we add it as an
// optional prop — not preemptively.
//
// Props:
//   title           — string shown as h1 in the header
//   onSettingsClick — callback when the gear icon is tapped

export default function HeaderBar({ title, onSettingsClick }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}
    >
      <h1
        style={{
          fontSize: 32,
          margin: 0,
          color: '#0D1B2A',
          fontFamily: "'Playfair Display', 'Lora', serif",
          fontWeight: 500,
        }}
      >
        {title}
      </h1>
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

// SAA-8 / 1AM-124: TabBar Component
// Fixed bottom navigation bar used across all main screens
// Three tabs: Feed / Browse / Alerts
// Politicians-tab functionality moved to Browse + Feed (1AM-124).
// Settings-tab moved to gear icon top-right of each screen header (1AM-124).
// Props: activeTab, onTabChange

const TABS = [
  {
    id: 'feed',
    label: 'Feed',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect
          x="3" y="3" width="8" height="8" rx="2"
          fill={active ? '#0D1B2A' : 'none'}
          stroke={active ? '#0D1B2A' : '#9CA3AF'}
          strokeWidth="2"
        />
        <rect
          x="13" y="3" width="8" height="8" rx="2"
          fill={active ? '#0D1B2A' : 'none'}
          stroke={active ? '#0D1B2A' : '#9CA3AF'}
          strokeWidth="2"
        />
        <rect
          x="3" y="13" width="8" height="8" rx="2"
          fill={active ? '#0D1B2A' : 'none'}
          stroke={active ? '#0D1B2A' : '#9CA3AF'}
          strokeWidth="2"
        />
        <rect
          x="13" y="13" width="8" height="8" rx="2"
          fill={active ? '#0D1B2A' : 'none'}
          stroke={active ? '#0D1B2A' : '#9CA3AF'}
          strokeWidth="2"
        />
      </svg>
    ),
  },
  {
    // 1AM-124: Browse-tab semantically "discover/explore" — compass icon.
    id: 'browse',
    label: 'Browse',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12" cy="12" r="9"
          fill={active ? '#0D1B2A' : 'none'}
          stroke={active ? '#0D1B2A' : '#9CA3AF'}
          strokeWidth="2"
        />
        <path
          d="M15.5 8.5L13 13l-4.5 2.5L11 11l4.5-2.5z"
          fill={active ? '#FAFAF7' : 'none'}
          stroke={active ? '#FAFAF7' : '#9CA3AF'}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3C8.7 3 6 5.7 6 9v5l-2 2v1h16v-1l-2-2V9c0-3.3-2.7-6-6-6z"
          fill={active ? '#0D1B2A' : 'none'}
          stroke={active ? '#0D1B2A' : '#9CA3AF'}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M10 19a2 2 0 004 0"
          stroke={active ? '#0D1B2A' : '#9CA3AF'}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function TabBar({ activeTab = 'feed', onTabChange }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '10px 0 24px',
        zIndex: 30,
        boxShadow: '0 -4px 12px rgba(13, 27, 42, 0.05)',
      }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange?.(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 16px',
              borderRadius: '8px',
              transition: 'background 0.15s ease',
              minWidth: '64px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F9FAFB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            {tab.icon(active)}
            <span
              style={{
                fontSize: '10px',
                fontWeight: active ? 700 : 400,
                color: active ? '#0D1B2A' : '#9CA3AF',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'color 0.15s ease',
                letterSpacing: active ? '0.01em' : '0',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Usage example ─────────────────────────────────────────────────────────────
// const [activeTab, setActiveTab] = useState('feed');
//
// <TabBar
//   activeTab={activeTab}
//   onTabChange={(tab) => setActiveTab(tab)}
// />
//
// Remember to add bottom padding to page content so it doesn't hide behind TabBar:
// <div style={{ paddingBottom: '80px' }}>
//   ... page content ...
// </div>

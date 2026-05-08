// 1AM-28 phase 1: FollowedListScreen — stub
//
// This is a placeholder component for phase 1. Its only job is to verify the
// routing skeleton in App.jsx (feedSubScreen state, onManageFollowing rewire)
// works end-to-end before the real UI is built in phases 2-4.
//
// Phase 2 will replace the stub body with:
//   - Variant 1 (Following 0):    three-people SVG + headline + two CTAs
//   - Variant 2 (Following 1-9):  rows + Following toggle + Add more button
// Phase 3 will add high-volume features (search, sort, chamber-tabs, mute).
// Phase 4 will add Edit-modus (red Unfollow buttons + Done exit).
//
// Props (interface frozen for phases 2-4 — change requires App.jsx edit):
//   followedPoliticians     — string[], names of followed politicians
//   mutedPoliticians        — string[], names of muted politicians
//   trades                  — array of trade objects (for trades-count sub-line
//                             and most-active sort, computed in phase 2)
//   sortOption              — 'most-active' | 'alphabetical' | 'recently-added'
//   onSortChange            — (next: string) => void, persists via App.jsx
//   onTogglePolitician      — (name: string) => void, follow/unfollow toggle
//   onToggleMute            — (name: string) => void, mute/unmute toggle
//   onShowPoliticianDetail  — (name: string) => void, opens detail page
//   onBack                  — () => void, returns to FeedScreen
//   onSettingsClick         — () => void, opens Settings overlay
//   onAddMore               — () => void, navigates to Browse-tab Most Active
//   onSearchByName          — () => void, navigates to Browse-tab (search)

export default function FollowedListScreen({
  followedPoliticians = [],
  // eslint-disable-next-line no-unused-vars
  mutedPoliticians = [],
  // eslint-disable-next-line no-unused-vars
  trades = [],
  // eslint-disable-next-line no-unused-vars
  sortOption = 'most-active',
  // eslint-disable-next-line no-unused-vars
  onSortChange,
  // eslint-disable-next-line no-unused-vars
  onTogglePolitician,
  // eslint-disable-next-line no-unused-vars
  onToggleMute,
  // eslint-disable-next-line no-unused-vars
  onShowPoliticianDetail,
  onBack,
  onSettingsClick,
  // eslint-disable-next-line no-unused-vars
  onAddMore,
  // eslint-disable-next-line no-unused-vars
  onSearchByName,
}) {
  const count = followedPoliticians.length;

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        padding: '20px 24px 100px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header — back chevron, title, gear icon. Phase 2 replaces this with
          the proper header (count + Edit button + section structure). */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Feed"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 4px',
            fontSize: 14,
            fontWeight: 500,
            color: '#0D1B2A',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          ← Feed
        </button>
        <button
          type="button"
          onClick={onSettingsClick}
          aria-label="Settings"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px',
            fontSize: 18,
            color: '#6B7280',
            cursor: 'pointer',
          }}
        >
          ⚙
        </button>
      </div>

      <h1
        style={{
          fontFamily: "'Playfair Display', 'Lora', serif",
          fontSize: 32,
          fontWeight: 500,
          color: '#0D1B2A',
          margin: '0 0 8px',
          letterSpacing: '-0.5px',
        }}
      >
        Following
      </h1>
      <div
        style={{
          fontSize: 13,
          color: '#6B7280',
          marginBottom: 24,
        }}
      >
        {count === 0
          ? 'No politicians yet'
          : `${count} ${count === 1 ? 'politician' : 'politicians'}`}
      </div>

      {/* Stub body — phase 2 replaces with real UI */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px dashed #E8E5D8',
          borderRadius: 12,
          padding: '20px',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 500, color: '#0D1B2A', marginBottom: 8 }}>
          FollowedListScreen — phase 1 stub
        </div>
        <div style={{ marginBottom: 12 }}>
          Routing works. Real UI ships in phase 2.
        </div>
        {count > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '12px 0 0',
              textAlign: 'left',
              fontSize: 13,
              color: '#0D1B2A',
            }}
          >
            {followedPoliticians.map((name) => (
              <li
                key={name}
                style={{
                  padding: '6px 8px',
                  borderBottom: '1px solid #F3F4F6',
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

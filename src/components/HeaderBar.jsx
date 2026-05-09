// 1AM-124: HeaderBar
// 1AM-151: subtitle prop added (optional)
// 1AM-160: followingCount + onManageFollowingClick props added (optional)
//
// Mini header component used at the top of each top-level tab (Browse, Feed,
// Alerts). Renders the screen title in the editorial serif (Lora as Playfair
// Display stand-in) on the left, with an optional smaller subtitle below it,
// and action buttons on the right. Always renders a gear-icon button for
// Settings; optionally renders a people-icon button (with follow-count badge)
// for "Manage who you follow" navigation.
//
// Design history:
//   2026-05-04 (1AM-124, A-light decision): no description prop, no logo
//   prop. Lovable's v3-rounded mockup showed only title + gear.
//   2026-05-09 (1AM-151): subtitle prop added because Browse v3 mockup
//   shows "Recent Filings" + "last 30 days" — two lines need typographic
//   coordination (font, color, spacing) that's easier to keep in one place
//   than re-implementing per-screen.
//   2026-05-09 (1AM-160): people-icon entry-point to FollowedListScreen
//   added for the Feed-tab. Active-state Feed previously had no path to
//   FollowedListScreen — only empty-state Hero exposed it. Closes the
//   discovery gap that the BrowsePoliticiansScreen feature depends on.
//   Pattern-match with Twitter/X, Bluesky etc. — "manage who I follow"
//   sits in chrome (header), not in content controls (FilterBar).
//
// Backward-compatible: callers that pass only `title` get the original
// single-line layout, no spacing changes. The people-icon only renders
// when BOTH `followingCount` and `onManageFollowingClick` are provided —
// Browse + Alerts callers continue to render a gear-only header.
//
// Props:
//   title                   — string shown as h1 in the header
//   subtitle                — optional string shown as small DM-Sans line below
//   onSettingsClick         — callback when the gear icon is tapped
//   followingCount          — optional number, render as badge on people-icon
//   onManageFollowingClick  — optional callback for people-icon tap (1AM-160)

export default function HeaderBar({
  title,
  subtitle,
  onSettingsClick,
  followingCount,
  onManageFollowingClick,
}) {
  const showManageFollowing =
    typeof onManageFollowingClick === 'function' &&
    typeof followingCount === 'number';

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

      {/* Action cluster — gear is always visible; people-icon optional. */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {showManageFollowing && (
          <button
            onClick={onManageFollowingClick}
            aria-label={`Manage following (${followingCount} ${followingCount === 1 ? 'politician' : 'politicians'})`}
            style={{
              position: 'relative',
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
            {/* People icon — two-figure silhouette. Matches FeedEmptyHero's
                PeopleIcon family without re-importing (HeaderBar stays
                dependency-free). */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle
                cx="9" cy="8" r="3.2"
                stroke="#6B7280"
                strokeWidth="2"
              />
              <path
                d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
                stroke="#6B7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="16.5" cy="9.5" r="2.4"
                stroke="#6B7280"
                strokeWidth="2"
              />
              <path
                d="M15 14.5c2.5 0.4 4.5 2.5 4.5 5"
                stroke="#6B7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            {/* Count badge — small navy pill, top-right of the button.
                Only rendered when count > 0 to avoid confusing "0" UX
                (zero-follow state already shown in empty-state Hero). */}
            {followingCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 8,
                  background: '#0D1B2A',
                  color: '#FAFAF7',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  boxSizing: 'border-box',
                }}
              >
                {followingCount > 99 ? '99+' : followingCount}
              </span>
            )}
          </button>
        )}

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
    </div>
  );
}

// 1AM-124: HeaderBar
// 1AM-151: subtitle prop added (optional)
// 1AM-160: followingCount + onManageFollowingClick props added (optional)
// 1AM-184: gear-icon replaced by UserMenuButton (auth-aware: Sign-in link
//          for anon users, avatar for signed-in users). Two new callbacks
//          onSignInClick + onSettingsClick replace the previous
//          onSettingsClick gear flow.
//
// Mini header component used at the top of each top-level tab (Browse, Feed,
// Alerts). Renders the screen title in the editorial serif (Lora as Playfair
// Display stand-in) on the left, with an optional smaller subtitle below it,
// and action buttons on the right. Always renders UserMenuButton; optionally
// renders a people-icon button (with follow-count badge) for "Manage who you
// follow" navigation.
//
// Backward-compatibility note: the prior `onSettingsClick` prop is repurposed
// — it now fires from the avatar (signed-in users), not the gear. Callers
// that wired `onSettingsClick` continue to receive their callback for the
// SettingsScreen flow; the new `onSignInClick` is purely additive and only
// fires for anon users.
//
// Props:
//   title                   — string shown as h1 in the header
//   subtitle                — optional string shown as small DM-Sans line below
//   onSignInClick           — callback when anon user taps "Sign in" link
//   onSettingsClick         — callback when signed-in user taps avatar
//   followingCount          — optional number, render as badge on people-icon
//   onManageFollowingClick  — optional callback for people-icon tap (1AM-160)

import UserMenuButton from './UserMenuButton';

export default function HeaderBar({
  title,
  subtitle,
  onSignInClick,
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

      {/* Action cluster — UserMenuButton always visible; people-icon optional. */}
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

        <UserMenuButton
          onSignInClick={onSignInClick}
          onSettingsClick={onSettingsClick}
        />
      </div>
    </div>
  );
}

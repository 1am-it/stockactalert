// 1AM-184: UserMenuButton
// Auth-aware element rendered top-right in HeaderBar and WatchHeader.
// Replaces the 1AM-124 gear-icon. Render decision is internal to this
// component but state (overlay open/closed) is owned by App.jsx — this
// component only fires callbacks.
//
// Three render states, driven by useAuth():
//   - loading   → 36×36 transparent placeholder (prevents layout shift
//                 during initial session-restore from localStorage). Same
//                 dimensions as the avatar so signed-in users see zero
//                 jitter; anon users see one state transition (placeholder
//                 → text-link).
//   - signed-out → "Sign in" text-link, DM Sans 13px navy.
//                 onClick → onSignInClick (opens SignInOverlay via App).
//   - signed-in  → 36×36 avatar circle with email-prefix initials.
//                 onClick → onSettingsClick (opens SettingsScreen via App).
//
// Email-prefix initials rule:
//   - "martinus@example.com" → "MA" (first two letters of prefix)
//   - "m@example.com"        → "M"  (single-char prefix)
//   - Falls back to "?" if email is missing (shouldn't happen post-auth).
//
// This component intentionally does NOT manage any overlay/drawer state.
// App.jsx owns isShowingSignIn + isShowingSettings, passes click handlers
// down through HeaderBar/WatchHeader. Keeps this component pure and
// trivially testable.
//
// Props:
//   onSignInClick    — callback fired when anon user taps "Sign in"
//   onSettingsClick  — callback fired when signed-in user taps avatar

import { useAuth } from '../lib/useAuth';

// Extract up-to-2 uppercase initials from the local-part of an email.
// Pure text manipulation — no Unicode normalisation, no name-parsing.
function emailInitials(email) {
  if (!email || typeof email !== 'string') return '?';
  const at = email.indexOf('@');
  const local = at === -1 ? email : email.slice(0, at);
  if (!local) return '?';
  return local.slice(0, 2).toUpperCase();
}

export default function UserMenuButton({ onSignInClick, onSettingsClick }) {
  const { user, loading } = useAuth();

  // ── Loading: placeholder of avatar dimensions to prevent layout shift. ──
  if (loading) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
        }}
      />
    );
  }

  // ── Signed-out: subtle text-link, not a button-style CTA. ───────────────
  if (!user) {
    return (
      <button
        onClick={onSignInClick}
        aria-label="Sign in"
        style={{
          background: 'transparent',
          border: 'none',
          padding: '8px 4px',
          height: 36,
          fontSize: 13,
          color: '#0D1B2A',
          fontFamily: "'DM Sans', sans-serif",
          cursor: 'pointer',
          fontWeight: 500,
          flexShrink: 0,
          lineHeight: 1,
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#6B7280';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#0D1B2A';
        }}
      >
        Sign in
      </button>
    );
  }

  // ── Signed-in: avatar circle with email-prefix initials. ────────────────
  const initials = emailInitials(user.email);
  return (
    <button
      onClick={onSettingsClick}
      aria-label={`Account menu for ${user.email}`}
      title={user.email}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '1px solid #E5E7EB',
        background: '#0D1B2A',
        color: '#FAFAF7',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif",
        letterSpacing: '0.02em',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#1F2937';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#0D1B2A';
      }}
    >
      {initials}
    </button>
  );
}

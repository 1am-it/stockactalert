// 1AM-145: FeedEmptyHero
// Variant-aware empty-state hero card for the Feed-tab. Three variants based
// on the user's follow count:
//
//   - empty-zero  → selected.length === 0    ("Pick a few politicians to follow")
//   - empty-low   → 1 ≤ selected.length ≤ 9  ("All quiet — Following N — all set")
//   - empty-high  → selected.length ≥ 10     (same as empty-low, no different copy
//                                             at this threshold — but separated
//                                             so future iterations can tune
//                                             messaging differently)
//
// All three share the same outer card, headline + body + CTAs structure. They
// differ in:
//   - Headline copy
//   - Subline / reassurance copy (with green check icon in low/high variants)
//   - CTA primary/secondary order
//   - CTA labels (Manage who you follow vs Browse all recent filings)
//
// Lovable v2 mockup decision: empty-zero gets "Manage who you follow" as
// primary because the user's most useful action is to start following someone.
// empty-low/high get "Browse all recent filings" as primary because the user
// already follows people; their most useful action while waiting is to explore.
//
// CTA wiring (1AM-145 Pad B — temporary scroll-anchors, 2026-05-07):
//   - "Browse all recent filings" → Browse-tab + scroll to #recent-trades-section
//   - "Manage who you follow"     → Browse-tab + scroll to Most Active section
//                                   (placeholder until 1AM-28 FollowedList screen
//                                   ships; rework is ~5 lines)
//
// Both CTAs go to Browse-tab in v1. The destination differentiation is the
// scroll anchor. When 1AM-28 ships, the "Manage who you follow" handler gets
// rewired to navigate to the FollowedList screen instead.
//
// Props:
//   variant            — 'empty-zero' | 'empty-low' | 'empty-high'
//   followingCount     — number, used in empty-low/high reassurance copy
//   onBrowseAll        — callback, navigates to Browse + scrolls to Recent Trades
//   onManageFollowing  — callback, navigates to Browse + scrolls to Most Active
//                        (will be rewired to FollowedList screen when 1AM-28 ships)

export default function FeedEmptyHero({
  variant,
  followingCount = 0,
  onBrowseAll,
  onManageFollowing,
}) {
  // Resolve copy + CTA order per variant. All three share the outer
  // shape — only these four fields vary.
  const config = getVariantConfig(variant, followingCount, {
    onBrowseAll,
    onManageFollowing,
  });

  return (
    <section
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5D8',
        borderRadius: 14,
        padding: '32px 24px',
        marginBottom: 24,
        textAlign: 'center',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Icon (variant-specific) ─────────────────────────────────────── */}
      {config.icon}

      {/* ── Headline ────────────────────────────────────────────────────── */}
      <h2
        style={{
          fontFamily: "'Playfair Display', 'Lora', serif",
          fontSize: 24,
          fontWeight: 500,
          color: '#0D1B2A',
          margin: '16px 0 12px',
          letterSpacing: '-0.4px',
          lineHeight: 1.25,
        }}
      >
        {config.headline}
      </h2>

      {/* ── Subline (with optional green check) ─────────────────────────── */}
      <div
        style={{
          fontSize: 13,
          color: config.sublineMuted ? '#6B7280' : '#0D1B2A',
          margin: '0 0 24px',
          lineHeight: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        {config.sublineCheck && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#ECFDF5',
              color: '#059669',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ✓
          </span>
        )}
        <span>{config.subline}</span>
      </div>

      {/* ── Primary CTA ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={config.primaryCta.onClick}
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 320,
          margin: '0 auto 12px',
          padding: '12px 20px',
          background: '#0D1B2A',
          color: '#FAFAF7',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
          cursor: 'pointer',
        }}
      >
        {config.primaryCta.label} →
      </button>

      {/* ── Secondary CTA (text-link) ───────────────────────────────────── */}
      <button
        type="button"
        onClick={config.secondaryCta.onClick}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '8px 12px',
          fontSize: 13,
          color: '#6B7280',
          fontFamily: "'DM Sans', sans-serif",
          cursor: 'pointer',
          textDecoration: 'underline',
          textDecorationColor: '#9CA3AF',
        }}
      >
        {config.secondaryCta.label} →
      </button>
    </section>
  );
}

// ── Variant config resolver ──────────────────────────────────────────────────
// Returns headline / subline / icon / CTA pair for the requested variant.
// Kept as a function (not a top-level constant) so it can interpolate the
// followingCount into the subline copy and wire the parent's CTA handlers.
function getVariantConfig(variant, followingCount, handlers) {
  const { onBrowseAll, onManageFollowing } = handlers;

  if (variant === 'empty-zero') {
    return {
      icon: <PeopleIcon />,
      headline: 'Pick a few politicians to follow',
      subline: 'Browse 535 members of Congress',
      sublineMuted: false,
      sublineCheck: true,
      primaryCta: {
        label: 'Manage who you follow',
        onClick: onManageFollowing,
      },
      secondaryCta: {
        label: 'Browse all recent filings',
        onClick: onBrowseAll,
      },
    };
  }

  // Both 'empty-low' and 'empty-high' share copy + CTA order at v1. Separated
  // as variants so future tuning can differ — e.g. high-volume users might
  // benefit from "Most active politicians this week" framing while low-volume
  // users benefit from "your follows are all set" reassurance.
  return {
    icon: <CheckIcon />,
    headline: (
      <>
        All quiet —
        <br />0 filings this week
      </>
    ),
    subline: `Following ${followingCount} ${followingCount === 1 ? 'politician' : 'politicians'} — all set`,
    sublineMuted: false,
    sublineCheck: true,
    primaryCta: {
      label: 'Browse all recent filings',
      onClick: onBrowseAll,
    },
    secondaryCta: {
      label: 'Manage who you follow',
      onClick: onManageFollowing,
    },
  };
}

// ── Icons ────────────────────────────────────────────────────────────────────
// Inline SVGs — design system bans emoji.

// Three-people icon for empty-zero state (Lovable v2 mockup).
function PeopleIcon() {
  return (
    <svg
      width="56"
      height="40"
      viewBox="0 0 56 40"
      fill="none"
      stroke="#9CA3AF"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ margin: '0 auto', display: 'block' }}
    >
      <circle cx="28" cy="14" r="6" />
      <path d="M16 38c0-6.6 5.4-12 12-12s12 5.4 12 12" />
      <circle cx="10" cy="18" r="4.5" />
      <path d="M2 36c0-4 3-8 8-8" />
      <circle cx="46" cy="18" r="4.5" />
      <path d="M54 36c0-4-3-8-8-8" />
    </svg>
  );
}

// Green check-circle for empty-low/high states (Lovable v2 mockup).
function CheckIcon() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: '#ECFDF5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#059669"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="5 12 10 17 19 8" />
      </svg>
    </div>
  );
}

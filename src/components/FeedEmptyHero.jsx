// 1AM-145 / 1AM-169: FeedEmptyHero
// Watch-tab empty-state hero.
//
// Two distinct variants depending on follow-state:
//
// 1. empty-zero — user has zero followed politicians (post-onboarding edge
//    case via 1AM-42). Renders the legacy 1AM-145 "Pick a few politicians to
//    follow" hero with PeopleIcon and dual-CTA (manage / explore). Behaviour
//    intentionally preserved — that path isn't part of the v0.22.x
//    Lovable-mockup redesign.
//
// 2. empty-low / empty-high — user has follows but no trades within the
//    current watch-window. Renders the 1AM-169 mockup-2 design:
//      - Large mono `0` (Playfair, ~96px) centred
//      - Window-driven label below it ("filings today/this week/this month
//        /in 90 days")
//      - Single factual STOCK Act lag micro-line, no editorial stance
//      - Separate dashed-border row "Want to watch more politicians?" with
//        only a people-icon (no buttons, no labels). Tap = navigate to
//        BrowsePoliticiansScreen via the same handler that drives the
//        WatchHeader people-pill.
//
// Decisions logged:
//   - No "All quiet", "All set", or check-mark visuals (project-owner spec)
//   - No "Browse all recent filings" CTA in this hero (Explore-tab is the
//     escape hatch via the bottom-nav, no in-hero CTA needed)
//   - Politici-CTA is a separate dashed card under the hero card, not part
//     of it — visual restraint, separate intentions (status-feedback vs
//     follow-management)
//
// Props:
//   variant            — 'empty-zero' | 'empty-low' | 'empty-high'
//   followingCount     — number, used in micro-context line for empty-zero
//   watchWindow        — '24h' | '7d' | '30d' | '90d', drives copy
//   onBrowseAll        — callback when explore-link tapped (empty-zero only)
//   onManageFollowing  — callback when people-icon / manage tapped

const WINDOW_COPY = {
  '24h': 'today',
  '7d': 'this week',
  '30d': 'this month',
  '90d': 'in 90 days',
};

export default function FeedEmptyHero({
  variant,
  followingCount = 0,
  watchWindow = '30d',
  onBrowseAll,
  onManageFollowing,
}) {
  if (variant === 'empty-zero') {
    return (
      <EmptyZeroHero
        onBrowseAll={onBrowseAll}
        onManageFollowing={onManageFollowing}
      />
    );
  }

  // empty-low and empty-high share the same visual design — they only differ
  // in which user-segment we'd address differently in copy. v1 keeps them
  // identical; future tuning can branch here if needed.
  return (
    <EmptyWithFollowsHero
      followingCount={followingCount}
      watchWindow={watchWindow}
      onManageFollowing={onManageFollowing}
    />
  );
}

// ── empty-with-follows: 1AM-169 mockup 2 ─────────────────────────────────────
// Big `0` + window-driven label + STOCK Act lag micro-line. Politici-CTA is
// a separate dashed card below, not nested.
function EmptyWithFollowsHero({ followingCount, watchWindow, onManageFollowing }) {
  const windowLabel = WINDOW_COPY[watchWindow] || 'this month';

  return (
    <>
      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E5D8',
          borderRadius: 14,
          padding: '40px 24px',
          marginBottom: 16,
          textAlign: 'center',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Big 0 — Playfair, monospaced numerals via tabular-nums. */}
        <div
          style={{
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontSize: 96,
            fontWeight: 400,
            color: '#0D1B2A',
            lineHeight: 1,
            letterSpacing: '-2px',
            margin: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          0
        </div>

        {/* Window-driven label, slightly muted. */}
        <div
          style={{
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontSize: 22,
            color: '#374151',
            margin: '16px 0 24px',
            fontWeight: 400,
            lineHeight: 1.3,
          }}
        >
          filings {windowLabel}
        </div>

        {/* STOCK Act lag micro-line — factual, no apology, no relativering. */}
        <div
          style={{
            fontSize: 12,
            color: '#9CA3AF',
            margin: 0,
            lineHeight: 1.5,
            maxWidth: 320,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Filings can lag the actual trade by up to 45 days under the STOCK Act.
        </div>
      </section>

      {/* Politici-CTA blok — dashed border, single tap-target row. No button.
          Whole row is the click surface. */}
      <button
        type="button"
        onClick={onManageFollowing}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          marginBottom: 24,
          background: '#FAFAF7',
          border: '1.5px dashed #D1D5DB',
          borderRadius: 12,
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          transition: 'background 0.15s ease, border-color 0.15s ease',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#F3F4F6';
          e.currentTarget.style.borderColor = '#9CA3AF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#FAFAF7';
          e.currentTarget.style.borderColor = '#D1D5DB';
        }}
      >
        <span
          style={{
            fontSize: 14,
            color: '#374151',
            fontWeight: 500,
          }}
        >
          Want to watch more politicians?
        </span>
        <PeopleIcon />
      </button>
    </>
  );
}

// ── empty-zero: 1AM-145 legacy preserved ─────────────────────────────────────
// User has zero followed politicians. This isn't reached via the WatchHeader
// flow (you only see Watch-tab after picking at least one politician in
// onboarding), but is reachable via 1AM-42 edge cases (unfollowing all).
function EmptyZeroHero({ onBrowseAll, onManageFollowing }) {
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
      <PeopleIconLarge />
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
        Pick a few politicians to follow
      </h2>
      <div
        style={{
          fontSize: 13,
          color: '#0D1B2A',
          margin: '0 0 24px',
          lineHeight: 1.5,
        }}
      >
        Browse 535 members of Congress
      </div>
      <button
        type="button"
        onClick={onManageFollowing}
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
        Manage who you follow →
      </button>
      <button
        type="button"
        onClick={onBrowseAll}
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
        Explore all recent filings →
      </button>
    </section>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
// Inline SVGs — design system bans emoji.

// Compact people-icon for the dashed Politici-CTA row.
function PeopleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="#6B7280" strokeWidth="2" />
      <path
        d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="#6B7280"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="9.5" r="2.4" stroke="#6B7280" strokeWidth="2" />
      <path
        d="M15 14.5c2.5 0.4 4.5 2.5 4.5 5"
        stroke="#6B7280"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Larger version for the legacy empty-zero hero.
function PeopleIconLarge() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="#0D1B2A" strokeWidth="1.6" />
      <path
        d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"
        stroke="#0D1B2A"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="9.5" r="2.4" stroke="#0D1B2A" strokeWidth="1.6" />
      <path
        d="M15 14.5c2.5 0.4 4.5 2.5 4.5 5"
        stroke="#0D1B2A"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

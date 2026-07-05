// SAA-15 / 1AM-24 / 1AM-79 / 1AM-160: Onboarding step 3 — pick politicians
//
// 1AM-160 (2026-05-09): refactored from monolithic component into a thin
// wrapper around <PoliticianPickerList>. All search + filter + member-list
// behaviour now lives in the shared presentational component, consumed by
// both this onboarding wrapper and the new BrowsePoliticiansScreen
// (in-app directory-browse from FollowedListScreen "Add more" CTA).
//
// What this wrapper still owns:
//   - Page title "Who do you want to follow?" + intro copy
//   - Top padding (60px) for onboarding's spacious feel
//   - Sticky footer with Back + Continue buttons
//   - canContinue logic + onNext callback for step transition
//
// History (preserved for reference):
//   - 1AM-79: rewritten for full ~540-member directory + chip filters
//   - 1AM-68: refactored to use shared SearchBar / ChipGroup primitives
//   - 1AM-67 phase C: bioguideId-keyed storage migration (still pending)
//
// Selection contract: parent App.jsx owns `followedPoliticians` as an array
// of `name` strings, and `onToggle(name)` adds/removes. Unchanged from
// pre-1AM-160 monolithic version.
//
// 1AM-259: added the STOCK Act callout below the intro copy. Tester feedback
// (1AM-45) found new users didn't know what "STOCK Act" meant before hitting
// their first trade card, and that plain inline text blended into the
// surrounding grey copy enough to be skipped. The callout uses the same
// amber (#D97706) as AlertsScreen's late-filing indicator — that color
// already means "time/disclosure-rule context" elsewhere in the app, so
// this builds the same vocabulary before the user ever sees a trade.
// Deep-dive explanation (amount ranges, "why 45 days") stays out of scope
// here — that's 1AM-110's job on trade-detail + Settings.

import PoliticianPickerList from './PoliticianPickerList';

export default function OnboardingPickPoliticians({
  selected,
  onToggle,
  onNext,
  onBack,
}) {
  const canContinue = selected.length > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          maxWidth: 720,
          width: '100%',
          margin: '0 auto',
          padding: '60px 24px 120px',
        }}
      >
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36,
            fontWeight: 700,
            color: '#0D1B2A',
            marginBottom: 8,
          }}
        >
          Who do you want to follow?
        </h1>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 4 }}>
          Pick at least one to get started. You can always change this later.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            background: 'rgba(217, 119, 6, 0.08)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <ClockIcon />
          <p style={{ margin: 0, fontSize: 12.5, color: '#0D1B2A', lineHeight: 1.55 }}>
            Under the STOCK Act, members of Congress must disclose stock
            trades within 45 days of the trade — this app shows what they
            did and whether they filed on time.
          </p>
        </div>

        <p
          style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: '#9CA3AF',
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          We don't rank them by returns — congressional performance data is
          noisy and misleading. Just pick who you're curious about.
        </p>

        <PoliticianPickerList
          selected={selected}
          onToggle={onToggle}
          showSuggested={true}
        />
      </div>

      {/* Sticky footer — onboarding-specific (Continue gates onNext on
          ≥1 selection; directory-mode wraps with a different footer). */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'rgba(250, 250, 247, 0.95)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid #E5E7EB',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: '12px 20px',
            background: '#FFFFFF',
            color: '#0D1B2A',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue}
          style={{
            padding: '12px 28px',
            background: canContinue ? '#0D1B2A' : '#E5E7EB',
            color: canContinue ? '#FAFAF7' : '#9CA3AF',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          {canContinue
            ? `Continue (${selected.length} selected)`
            : 'Pick at least one'}
        </button>
      </div>
    </div>
  );
}

// 1AM-259: same shape as AlertsScreen's late-filing clock icon — reused
// inline here rather than imported, matching this codebase's convention of
// each screen owning its small icon components.
function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <circle cx="12" cy="12" r="8.5" stroke="#D97706" strokeWidth="2" />
      <path d="M12 7.5V12l3 2" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

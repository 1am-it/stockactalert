// SAA-15 / 1AM-24: Onboarding step 3 — pick politicians to follow
//
// Refactored in 1AM-24: the politician list and grid UI are now shared with
// the Politicians-tab management screen (see curatedPoliticians.js +
// PoliticianPickGrid.jsx). This file only handles the onboarding-specific
// chrome: heading, subtitle, disclaimer, and the sticky Back/Continue CTA bar.

import PoliticianPickGrid from './PoliticianPickGrid';
import { CURATED_POLITICIANS } from '../data/curatedPoliticians';

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
      {/* Scrollable content area (with bottom padding for sticky CTA bar) */}
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
        <p
          style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: '#9CA3AF',
            marginBottom: 32,
            lineHeight: 1.5,
          }}
        >
          We don't rank them by returns — congressional performance data is
          noisy and misleading. Just pick who you're curious about.
        </p>

        <PoliticianPickGrid
          politicians={CURATED_POLITICIANS}
          selected={selected}
          onToggle={onToggle}
        />
      </div>

      {/* Sticky bottom CTA bar */}
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

// SAA-15 / 1AM-24 / 1AM-79: Onboarding step 3 — pick politicians to follow
//
// Rewritten in 1AM-79 to support the full ~540-member Congress directory:
//   - Search bar (debounced 150ms, case-insensitive, matches name + nickname)
//   - Filter chips: Chamber (House/Senate) + Party (D/R/I), multi-select
//   - Suggested-to-follow section (8 hand-picked, only when no filters active)
//   - Member list (filtered + searched, native CSS content-visibility for perf)
//   - Empty state when filters yield no matches
//
// Refactored in 1AM-68 to use shared SearchBar/ChipGroup/MemberListEmptyState
// components for parity with the Politicians-tab management screen.
//
// Selection contract is preserved from the curated-22 era: parent `App.jsx`
// owns `followedPoliticians` as an array of `name` strings, and `onToggle(name)`
// adds/removes. Migration to bioguideId-keyed storage is Phase C of 1AM-67.
//
// Design language: matches existing onboarding aesthetic (Playfair h1 + DM Sans
// body, off-white #FAFAF7 background, navy primary, party-colored accents).

import { useState, useEffect, useMemo } from 'react';
import { applyFilters, getSuggested } from '../lib/congress';
import MemberListRow from './MemberListRow';
import SearchBar from './SearchBar';
import ChipGroup from './ChipGroup';
import MemberListEmptyState from './MemberListEmptyState';

const SEARCH_DEBOUNCE_MS = 150;

const PARTY_OPTIONS = [
  { value: 'D', label: 'Democrat' },
  { value: 'R', label: 'Republican' },
  { value: 'I', label: 'Independent' },
];

const CHAMBER_OPTIONS = [
  { value: 'Senate', label: 'Senate' },
  { value: 'House', label: 'House' },
];

export default function OnboardingPickPoliticians({
  selected,
  onToggle,
  onNext,
  onBack,
}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [chamber, setChamber] = useState([]);
  const [party, setParty] = useState([]);

  // Debounce search input → search (used for filtering)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isFiltered =
    search.trim().length > 0 || chamber.length > 0 || party.length > 0;

  const filtered = useMemo(
    () => applyFilters({ search, chamber, party }),
    [search, chamber, party]
  );

  const suggested = useMemo(() => getSuggested(), []);

  const canContinue = selected.length > 0;

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setChamber([]);
    setParty([]);
  };

  // When the user adds a follow, clear any active filters/search so the next
  // pick happens against the broader directory. Removing a follow keeps the
  // current filter context — useful when curating an existing list within a
  // filter view (e.g. "show me my Senate Democrats and unfollow some").
  const handleToggle = (name) => {
    const isAdding = !selected.includes(name);
    onToggle(name);
    if (isAdding && isFiltered) {
      clearAllFilters();
    }
  };

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

        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          onClear={() => setSearchInput('')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <ChipGroup
            label="Chamber"
            options={CHAMBER_OPTIONS}
            value={chamber}
            onChange={setChamber}
          />
          <ChipGroup
            label="Party"
            options={PARTY_OPTIONS}
            value={party}
            onChange={setParty}
          />
        </div>

        {!isFiltered && (
          <SuggestedSection
            members={suggested}
            selected={selected}
            onToggle={handleToggle}
          />
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginTop: 28,
            marginBottom: 12,
            gap: 12,
          }}
        >
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#0D1B2A',
              margin: 0,
            }}
          >
            {isFiltered ? 'Results' : 'All members'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            {isFiltered && (
              <button
                onClick={clearAllFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '2px 4px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0D1B2A',
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Clear filters
              </button>
            )}
            <span
              style={{
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#6B7280',
                letterSpacing: '0.04em',
              }}
            >
              {filtered.length}
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <MemberListEmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((member) => (
              <div
                key={member.bioguideId}
                style={{
                  contentVisibility: 'auto',
                  containIntrinsicSize: '0 60px',
                }}
              >
                <MemberListRow
                  member={member}
                  isSelected={selected.includes(member.name)}
                  onToggle={() => handleToggle(member.name)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

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

// ── Suggested-to-follow section ─────────────────────────────────────────────
// Onboarding-specific (the Politicians-tab uses a "Following" section instead).
function SuggestedSection({ members, selected, onToggle }) {
  if (members.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 700,
          color: '#0D1B2A',
          margin: '0 0 12px 0',
        }}
      >
        Suggested for you
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {members.map((member) => (
          <MemberListRow
            key={member.bioguideId}
            member={member}
            isSelected={selected.includes(member.name)}
            onToggle={() => onToggle(member.name)}
          />
        ))}
      </div>
    </div>
  );
}

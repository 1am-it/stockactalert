// 1AM-160: PoliticianPickerList — presentational component for browsing /
// filtering / following members of Congress. Extracted from
// OnboardingPickPoliticians (1AM-79) so two surfaces can consume the same
// search + filter + member-list behaviour without drift:
//
//   1. OnboardingPickPoliticians (existing) — wraps with page title +
//      "Continue (N selected)" sticky footer + onNext callback for step
//      transition.
//   2. BrowsePoliticiansScreen (new, 1AM-160) — wraps with "← Back" +
//      "Browse Politicians" title + "Done" sticky footer for in-app
//      directory-browse flow reached from FollowedListScreen "Add more"
//      (1AM-161 re-routes that CTA here).
//
// What lives here (presentational state):
//   - search input + debounce
//   - chamber + party chip-group filters
//   - clearAllFilters helper
//   - "Suggested for you" section (gated by `showSuggested` prop)
//   - "Results / All members" header with clear-filters + count
//   - filtered member list rendering (with content-visibility perf hint)
//   - empty state when filters yield no matches
//
// What lives in the WRAPPER (NOT in this component):
//   - page title + intro copy
//   - sticky footer with action buttons (Continue / Done / Back)
//   - canContinue logic, onNext / onBack callbacks
//   - top + bottom padding for footer-occlusion
//
// Selection contract: parent owns `selected` (array of `name` strings)
// and provides `onToggle(name)`. Same contract as OnboardingPickPoliticians
// pre-extraction, preserved for backwards-compatibility with App.jsx state.
//
// Filter-clearing-on-add: when a user adds a follow while filters are
// active, filters auto-clear so the next pick happens against the broader
// directory. Same behaviour the onboarding had — useful in directory-mode
// too (after picking your AZ senator you typically want to see everyone
// again, not stay in "Senate, Arizona" filter).

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

/**
 * @param {Object} props
 * @param {string[]} props.selected — currently followed politician names
 * @param {(name: string) => void} props.onToggle — add/remove follow
 * @param {boolean} [props.showSuggested=true] — render "Suggested for you" section
 *   when no filters are active. Onboarding shows this; directory mode hides
 *   it (user already follows someone, hence they're here).
 */
export default function PoliticianPickerList({
  selected,
  onToggle,
  showSuggested = true,
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

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setChamber([]);
    setParty([]);
  };

  // When user adds a follow, clear active filters so next pick happens
  // against the broader directory. Removing a follow keeps current filter
  // context — useful when curating an existing list within a filter view.
  const handleToggle = (name) => {
    const isAdding = !selected.includes(name);
    onToggle(name);
    if (isAdding && isFiltered) {
      clearAllFilters();
    }
  };

  return (
    <>
      <SearchBar
        value={searchInput}
        onChange={setSearchInput}
        onClear={() => setSearchInput('')}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 14,
        }}
      >
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

      {!isFiltered && showSuggested && (
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
    </>
  );
}

// ── Suggested-to-follow section ─────────────────────────────────────────────
// Onboarding-default; directory-mode hides via `showSuggested={false}`.
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

// 1AM-24 / 1AM-68: Politicians-tab management screen
//
// Rewritten in 1AM-68 to support the full ~540-member Congress directory.
// Replaces the curated 22-card grid with:
//   - Header: "Politicians" + "Following N of 536"
//   - Search bar (debounced 150ms, case-insensitive, name + nickname)
//   - Filter chips: Chamber (Senate/House) + Party (D/R/I), multi-select
//   - "Following" section (top): user's followed list, full directory members
//     resolved by name. Empty when user follows nobody.
//   - "Browse all" section (bottom): everyone else. Empty when user follows
//     all visible members.
//
// Search and filters apply to BOTH sections — keeps the user oriented if they
// search for someone they already follow (they appear at top in Following).
//
// Selection contract: same as before — `selected: string[]` of names,
// `onToggle(name)` callback. Migration to bioguideId-keyed storage is a
// separate Phase C item from 1AM-67.
//
// Design language: matches OnboardingPickPoliticians (shared components for
// SearchBar, ChipGroup, MemberListRow, MemberListEmptyState).

import { useState, useEffect, useMemo } from 'react';
import { MEMBERS, applyFilters } from '../lib/congress';
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

export default function PoliticiansScreen({ selected, onToggle }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [chamber, setChamber] = useState([]);
  const [party, setParty] = useState([]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isFiltered =
    search.trim().length > 0 || chamber.length > 0 || party.length > 0;

  // Apply search + filters once to the full directory
  const filtered = useMemo(
    () => applyFilters({ search, chamber, party }),
    [search, chamber, party]
  );

  // Split filtered results into Following + Browse all
  // (using a Set for O(1) membership lookup against the selected name list)
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const { followingList, browseList } = useMemo(() => {
    const following = [];
    const browse = [];
    for (const m of filtered) {
      if (selectedSet.has(m.name)) following.push(m);
      else browse.push(m);
    }
    return { followingList: following, browseList: browse };
  }, [filtered, selectedSet]);

  const totalFollowing = selected.length;

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setChamber([]);
    setParty([]);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Following indicator — page title is rendered by App.jsx page-wrapper,
          this only adds the unique-to-this-screen "N of M" count */}
      <div
        style={{
          fontSize: 11,
          color: '#9CA3AF',
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Following {totalFollowing} of {MEMBERS.length}
      </div>

      {/* Search bar */}
      <SearchBar
        value={searchInput}
        onChange={setSearchInput}
        onClear={() => setSearchInput('')}
      />

      {/* Filter chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, marginBottom: 8 }}>
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

      {/* Clear filters affordance — top-right when filters active */}
      {isFiltered && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
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
        </div>
      )}

      {/* Following section — only visible when user follows at least one
          AND at least one of those follows matches the current filter */}
      {totalFollowing > 0 && followingList.length > 0 && (
        <Section
          title="Following"
          count={followingList.length}
          totalCount={!isFiltered ? totalFollowing : undefined}
        >
          <MemberList
            members={followingList}
            selected={selected}
            onToggle={onToggle}
          />
        </Section>
      )}

      {/* Browse-all section — labelled differently if the user has nothing
          followed yet (they're discovering for the first time) */}
      <Section
        title={totalFollowing === 0 ? 'All members' : 'Browse all'}
        count={browseList.length}
      >
        {browseList.length === 0 ? (
          <MemberListEmptyState
            title={
              isFiltered ? 'No politicians match' : 'You follow everyone here'
            }
            message={
              isFiltered
                ? 'Try fewer filters or a different search.'
                : "Adjust filters to see members you're not following yet."
            }
          />
        ) : (
          <MemberList
            members={browseList}
            selected={selected}
            onToggle={onToggle}
          />
        )}
      </Section>
    </div>
  );
}

// ── Section header + content wrapper ─────────────────────────────────────────
function Section({ title, count, totalCount, children }) {
  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
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
          {title}
        </h2>
        <span
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#6B7280',
            letterSpacing: '0.04em',
          }}
        >
          {/* When totalCount is set and differs from count (filter-active state),
              show "shown / total" so the user sees what's hidden by the filter */}
          {totalCount !== undefined && totalCount !== count
            ? `${count} of ${totalCount}`
            : count}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Member list with native CSS virtualisation ──────────────────────────────
function MemberList({ members, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {members.map((member) => (
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
            onToggle={() => onToggle(member.name)}
          />
        </div>
      ))}
    </div>
  );
}

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
import SingleChipGroup from './SingleChipGroup';
import MemberListEmptyState from './MemberListEmptyState';
import { useActivePoliticians } from '../hooks/useActivePoliticians';

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

// 1AM-106: date-range chip options. Single-select because windows are nested
// (Past 7d ⊂ Past 30d ⊂ Past 90d) — multi-select would have no meaningful
// OR-semantic. "Any time" = no activity filter (returns null since to hook).
const ACTIVITY_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: 'past7d', label: 'Past 7d' },
  { value: 'past30d', label: 'Past 30d' },
  { value: 'past90d', label: 'Past 90d' },
];

const ACTIVITY_DAYS = {
  past7d: 7,
  past30d: 30,
  past90d: 90,
};

function computeSince(activity) {
  if (activity === 'any') return null;
  const days = ACTIVITY_DAYS[activity];
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function PoliticiansScreen({ selected, onToggle, onShowDetail }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [chamber, setChamber] = useState([]);
  const [party, setParty] = useState([]);
  // 1AM-106: date-range / activity chip state. 'any' = no activity filter.
  const [activity, setActivity] = useState('any');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 1AM-106: derive YYYY-MM-DD cutoff from the activity chip and feed it to
  // useActivePoliticians. Hook returns null Set when activity='any' (no filter)
  // so downstream code can short-circuit cheaply.
  const since = useMemo(() => computeSince(activity), [activity]);
  const { activeBioguideIds, loading: activityLoading, error: activityError } =
    useActivePoliticians(since);

  const isFiltered =
    search.trim().length > 0 ||
    chamber.length > 0 ||
    party.length > 0 ||
    activity !== 'any';

  // Apply search + filters once to the full directory
  const filtered = useMemo(
    () => applyFilters({ search, chamber, party }),
    [search, chamber, party]
  );

  // 1AM-106: layer the activity filter on top. When activeBioguideIds is null
  // (chip='any' or hook still loading), this is a no-op — pass-through.
  // When set, narrow to members whose bioguideId is in the active set. This
  // applies to BOTH Following and Browse per the chosen design (Pad B).
  const activityFiltered = useMemo(() => {
    if (!activeBioguideIds) return filtered;
    return filtered.filter((m) => activeBioguideIds.has(m.bioguideId));
  }, [filtered, activeBioguideIds]);

  // Split filtered results into Following + Browse all
  // (using a Set for O(1) membership lookup against the selected name list)
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const { followingList, browseList } = useMemo(() => {
    const following = [];
    const browse = [];
    for (const m of activityFiltered) {
      if (selectedSet.has(m.name)) following.push(m);
      else browse.push(m);
    }
    return { followingList: following, browseList: browse };
  }, [activityFiltered, selectedSet]);

  // 1AM-106: count of follows hidden by the activity filter — used for the
  // "X follows hidden by filter" affordance under the Following section.
  // Computed by comparing pre-activity-filter follows vs post-activity-filter.
  const followsHiddenByActivity = useMemo(() => {
    if (!activeBioguideIds) return 0;
    const preActivityFollowing = filtered.filter((m) => selectedSet.has(m.name));
    return preActivityFollowing.length - followingList.length;
  }, [filtered, selectedSet, followingList, activeBioguideIds]);

  const totalFollowing = selected.length;

  const clearAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setChamber([]);
    setParty([]);
    setActivity('any');
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
        {/* 1AM-106: activity chip — single-select date-range filter. */}
        <SingleChipGroup
          label="Activity"
          options={ACTIVITY_OPTIONS}
          value={activity}
          onChange={setActivity}
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
          AND at least one of those follows matches the current filter.
          1AM-106: when the activity filter hides ALL followed members, the
          section header drops and we render a small affordance instead so
          the user knows their follows are still there, just filtered out. */}
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
            onShowDetail={onShowDetail}
          />
          {followsHiddenByActivity > 0 && (
            <div
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                fontFamily: "'DM Sans', sans-serif",
                fontStyle: 'italic',
                marginTop: 8,
                paddingLeft: 4,
              }}
            >
              {followsHiddenByActivity}{' '}
              {followsHiddenByActivity === 1 ? 'follow' : 'follows'} hidden by
              activity filter
            </div>
          )}
        </Section>
      )}
      {totalFollowing > 0 && followingList.length === 0 && activeBioguideIds && (
        <div
          style={{
            fontSize: 11,
            color: '#9CA3AF',
            fontFamily: "'DM Sans', sans-serif",
            fontStyle: 'italic',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          {totalFollowing}{' '}
          {totalFollowing === 1 ? 'follow' : 'follows'} hidden by activity
          filter
        </div>
      )}

      {/* Browse-all section — labelled differently if the user has nothing
          followed yet (they're discovering for the first time) */}
      <Section
        title={totalFollowing === 0 ? 'All members' : 'Browse all'}
        count={browseList.length}
      >
        {browseList.length === 0 ? (
          (() => {
            // 1AM-106: empty-state is context-aware when the activity chip is
            // the sole non-default filter — gives a clearer signal than the
            // generic "try fewer filters" when the real cause is "archive
            // doesn't have trades in this window yet".
            const onlyActivityActive =
              activity !== 'any' &&
              search.trim().length === 0 &&
              chamber.length === 0 &&
              party.length === 0;
            const activityLabel = ACTIVITY_OPTIONS.find(
              (o) => o.value === activity
            )?.label.toLowerCase();
            const widerSuggestion =
              activity === 'past7d'
                ? 'Past 30d or Past 90d'
                : activity === 'past30d'
                  ? 'Past 90d'
                  : 'Any time';
            return (
              <MemberListEmptyState
                title={
                  onlyActivityActive
                    ? `No politicians active in ${activityLabel}`
                    : isFiltered
                      ? 'No politicians match'
                      : 'You follow everyone here'
                }
                message={
                  onlyActivityActive
                    ? `Try a wider window — ${widerSuggestion}.`
                    : isFiltered
                      ? 'Try fewer filters or a different search.'
                      : "Adjust filters to see members you're not following yet."
                }
              />
            );
          })()
        ) : (
          <MemberList
            members={browseList}
            selected={selected}
            onToggle={onToggle}
            onShowDetail={onShowDetail}
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
function MemberList({ members, selected, onToggle, onShowDetail }) {
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
            onClickRow={
              onShowDetail ? () => onShowDetail(member.name) : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}

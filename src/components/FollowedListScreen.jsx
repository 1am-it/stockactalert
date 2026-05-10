// 1AM-28 phase 3: FollowedListScreen — adds high-volume features
//
// Builds on phase 2. Variant 1 (empty-zero) and variant 2 (1-9 rows) are
// unchanged. Variant 3 (10+ follows) adds:
//
//   - Search input (placeholder "Search your follows", debounced 300ms,
//     same pattern as BrowseAllFilingsScreen search)
//   - Sort dropdown right-aligned ('most-active' default, 'alphabetical',
//     'recently-added'). Persists via onSortChange → App.jsx → storage.
//   - Chamber-tabs row: "All N · Senate N · House N", individual tab hidden
//     when its count is 0. If the active tab's count drops to 0 (e.g. user
//     unfollows the last Senator while on Senate tab), silently fall back
//     to All.
//   - Per-row mute icon (bell ↔ bell-with-slash) between sub-line and the
//     Following toggle. Tap toggles mute via onToggleMute.
//   - Empty-search state ("No matches in your follows" + Clear button)
//     when searchQuery is set and filtered rows is empty.
//
// Muted-row visual treatment (dimmed avatar + "Muted" pill badge): applied
// in BOTH variant 2 and variant 3 — extends the ticket's strict reading
// (where muted styling only appears in variant 3) so a user with 1-9 follows
// can still see at a glance which politicians they've muted via the
// PoliticianDetailScreen mute toggle. The variant-3-only thing per the
// ticket is the toggle icon (the affordance), not the indication.
//
// Phase 4: edit mode toggles destructive red Unfollow buttons in place of
// the navy Following pills. Same onClick (calls onUnfollow), purely a
// visual emphasis on the destructive intent. Auto-resets when count drops
// to 0 so editMode never persists silently behind variant 1.

import { useEffect, useMemo, useState } from 'react';
import Avatar from './Avatar';
import { findByName } from '../lib/congress';
import { fullStateName } from '../lib/states';
import { deriveInitials } from '../lib/politicianAggregation';

// 1AM-28: high-volume variant threshold. Matches FOLLOW_VOLUME_HIGH in
// FeedScreen.jsx (1AM-145) for consistency across the two surfaces that
// switch behaviour at this size.
const FOLLOW_VOLUME_HIGH = 10;

// Debounce for search input — same 300ms as BrowseAllFilingsScreen.
const SEARCH_DEBOUNCE_MS = 300;

export default function FollowedListScreen({
  followedPoliticians = [],
  mutedPoliticians = [],
  trades = [],
  sortOption = 'most-active',
  onSortChange,
  onTogglePolitician,
  onToggleMute,
  onShowPoliticianDetail,
  onBack,
  // eslint-disable-next-line no-unused-vars
  onSettingsClick,
  onAddMore,
  onSearchByName,
}) {
  const [editMode, setEditMode] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chamberFilter, setChamberFilter] = useState('all');

  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const count = followedPoliticians.length;
  const isHighVolume = count >= FOLLOW_VOLUME_HIGH;
  const mutedSet = useMemo(() => new Set(mutedPoliticians), [mutedPoliticians]);

  // 1AM-28 phase 4: auto-exit edit mode when count drops to 0. Otherwise
  // editMode would stay true silently while variant 1 (empty-zero) renders,
  // and a future re-follow would land back in variant 2 still in edit mode
  // — surprising and unwanted state persistence.
  useEffect(() => {
    if (count === 0 && editMode) {
      setEditMode(false);
    }
  }, [count, editMode]);

  const tradeCountByName = useMemo(() => {
    const map = new Map();
    for (const t of trades) {
      map.set(t.politician, (map.get(t.politician) || 0) + 1);
    }
    return map;
  }, [trades]);

  const allRows = useMemo(() => {
    return followedPoliticians.map((name, idx) => {
      const matches = findByName(name);
      const member =
        Array.isArray(matches) && matches.length > 0 ? matches[0] : null;
      return {
        name,
        bioguideId: member?.bioguideId || null,
        party: member?.party || null,
        chamber: member?.chamber || '',
        state: member?.state || '',
        initials: deriveInitials(name),
        count: tradeCountByName.get(name) || 0,
        addedIndex: idx,
        isMuted: mutedSet.has(name),
      };
    });
  }, [followedPoliticians, tradeCountByName, mutedSet]);

  const senateCount = useMemo(
    () => allRows.filter((r) => r.chamber === 'Senate').length,
    [allRows]
  );
  const houseCount = useMemo(
    () => allRows.filter((r) => r.chamber === 'House').length,
    [allRows]
  );

  useEffect(() => {
    if (chamberFilter === 'senate' && senateCount === 0) {
      setChamberFilter('all');
    } else if (chamberFilter === 'house' && houseCount === 0) {
      setChamberFilter('all');
    }
  }, [chamberFilter, senateCount, houseCount]);

  const filteredRows = useMemo(() => {
    let list = allRows;

    if (isHighVolume && chamberFilter !== 'all') {
      const wanted = chamberFilter === 'senate' ? 'Senate' : 'House';
      list = list.filter((r) => r.chamber === wanted);
    }

    if (isHighVolume && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }

    const effectiveSort = isHighVolume ? sortOption : 'most-active';
    const sorted = [...list];
    if (effectiveSort === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (effectiveSort === 'recently-added') {
      sorted.sort((a, b) => b.addedIndex - a.addedIndex);
    } else {
      sorted.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }, [allRows, isHighVolume, chamberFilter, searchQuery, sortOption]);

  const hasActiveSearch = isHighVolume && searchQuery.trim().length > 0;
  const hasNoSearchMatches = hasActiveSearch && filteredRows.length === 0;

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        padding: '20px 24px 100px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          minHeight: 36,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Watch"
          style={{
            background: 'transparent',
            border: 'none',
            padding: '8px 4px',
            fontSize: 14,
            fontWeight: 500,
            color: '#0D1B2A',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          ← Watch
        </button>
        {count > 0 && (
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            aria-label={editMode ? 'Exit edit mode' : 'Edit followed politicians'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px 4px',
              fontSize: 14,
              fontWeight: 500,
              color: '#0D1B2A',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      <h1
        style={{
          fontFamily: "'Playfair Display', 'Lora', serif",
          fontSize: 32,
          fontWeight: 500,
          color: '#0D1B2A',
          margin: '0 0 8px',
          letterSpacing: '-0.5px',
          lineHeight: 1.1,
        }}
      >
        Following
      </h1>
      <div
        style={{
          fontSize: 13,
          color: '#6B7280',
          marginBottom: 24,
        }}
      >
        {count === 0
          ? 'No politicians yet'
          : `${count} ${count === 1 ? 'politician' : 'politicians'}`}
      </div>

      {count === 0 ? (
        <EmptyZeroState
          onAddMore={onAddMore}
          onSearchByName={onSearchByName}
        />
      ) : (
        <>
          {isHighVolume && (
            <HighVolumeFilters
              searchInput={searchInput}
              onSearchInputChange={setSearchInput}
              onClearSearch={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
              hasActiveSearch={hasActiveSearch}
              chamberFilter={chamberFilter}
              onChamberFilterChange={setChamberFilter}
              totalCount={count}
              senateCount={senateCount}
              houseCount={houseCount}
              sortOption={sortOption}
              onSortChange={onSortChange}
            />
          )}

          {hasNoSearchMatches ? (
            <NoSearchMatchesState
              onClear={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredRows.map((row) => (
                <PoliticianRow
                  key={row.bioguideId || row.name}
                  row={row}
                  showMuteIcon={isHighVolume}
                  editMode={editMode}
                  onShowDetail={() => onShowPoliticianDetail?.(row.name)}
                  onUnfollow={() => onTogglePolitician?.(row.name)}
                  onToggleMute={() => onToggleMute?.(row.name)}
                />
              ))}
            </div>
          )}

          {!hasActiveSearch && (
            <button
              type="button"
              onClick={onAddMore}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 16,
                padding: '10px 14px',
                background: 'transparent',
                color: '#6B7280',
                border: '1px dashed #E8E5D8',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              + Add more
            </button>
          )}
        </>
      )}
    </div>
  );
}

function EmptyZeroState({ onAddMore, onSearchByName }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '32px 16px 0',
      }}
    >
      <PeopleIcon />
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
      <p
        style={{
          fontSize: 13,
          color: '#6B7280',
          margin: '0 0 24px',
          lineHeight: 1.5,
        }}
      >
        Start with the most active traders, or search for a specific senator
        or representative.
      </p>
      <button
        type="button"
        onClick={onAddMore}
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
        Browse Most Active →
      </button>
      <button
        type="button"
        onClick={onSearchByName}
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
        Search by name
      </button>
    </div>
  );
}

function HighVolumeFilters({
  searchInput,
  onSearchInputChange,
  onClearSearch,
  hasActiveSearch,
  chamberFilter,
  onChamberFilterChange,
  totalCount,
  senateCount,
  houseCount,
  sortOption,
  onSortChange,
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          position: 'relative',
          marginBottom: 12,
        }}
      >
        <input
          type="search"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder="Search your follows"
          aria-label="Search your followed politicians"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 36px 10px 14px',
            background: '#FFFFFF',
            border: '1px solid #E8E5D8',
            borderRadius: 10,
            fontSize: 13,
            color: '#0D1B2A',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
          }}
        />
        {hasActiveSearch && (
          <button
            type="button"
            onClick={onClearSearch}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              padding: '4px 8px',
              fontSize: 14,
              color: '#9CA3AF',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ChamberTab
            label="All"
            count={totalCount}
            active={chamberFilter === 'all'}
            onClick={() => onChamberFilterChange('all')}
          />
          {senateCount > 0 && (
            <ChamberTab
              label="Senate"
              count={senateCount}
              active={chamberFilter === 'senate'}
              onClick={() => onChamberFilterChange('senate')}
            />
          )}
          {houseCount > 0 && (
            <ChamberTab
              label="House"
              count={houseCount}
              active={chamberFilter === 'house'}
              onClick={() => onChamberFilterChange('house')}
            />
          )}
        </div>

        <select
          value={sortOption}
          onChange={(e) => onSortChange?.(e.target.value)}
          aria-label="Sort followed politicians"
          style={{
            padding: '6px 10px',
            background: '#FFFFFF',
            border: '1px solid #E8E5D8',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            color: '#0D1B2A',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          <option value="most-active">Most active</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="recently-added">Recently added</option>
        </select>
      </div>
    </div>
  );
}

function ChamberTab({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '6px 12px',
        background: active ? '#0D1B2A' : 'transparent',
        color: active ? '#FAFAF7' : '#6B7280',
        border: active ? '1px solid #0D1B2A' : '1px solid #E8E5D8',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'DM Sans', sans-serif",
        cursor: 'pointer',
      }}
    >
      {label} {count}
    </button>
  );
}

function NoSearchMatchesState({ onClear }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5D8',
        borderRadius: 12,
        padding: '24px 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: '#0D1B2A',
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 12,
        }}
      >
        No matches in your follows
      </div>
      <button
        type="button"
        onClick={onClear}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '6px 12px',
          fontSize: 13,
          color: '#6B7280',
          fontFamily: "'DM Sans', sans-serif",
          cursor: 'pointer',
          textDecoration: 'underline',
          textDecorationColor: '#9CA3AF',
        }}
      >
        Clear search
      </button>
    </div>
  );
}

function PoliticianRow({
  row,
  showMuteIcon,
  editMode,
  onShowDetail,
  onUnfollow,
  onToggleMute,
}) {
  const stateLabel = row.state ? fullStateName(row.state) : '';
  const subline = formatSubline({
    chamber: row.chamber,
    state: stateLabel,
    count: row.count,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#FFFFFF',
        border: '1px solid #E8E5D8',
        borderRadius: 12,
        padding: 0,
        gap: 0,
      }}
    >
      <button
        type="button"
        onClick={onShowDetail}
        aria-label={`View ${row.name} profile`}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 6px 10px 12px',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          minWidth: 0,
          fontFamily: 'inherit',
          color: 'inherit',
          borderRadius: 12,
        }}
      >
        <div style={{ opacity: row.isMuted ? 0.45 : 1, transition: 'opacity 0.15s' }}>
          <Avatar
            bioguideId={row.bioguideId}
            initials={row.initials}
            party={row.party}
            size="md"
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontFamily: "'Playfair Display', 'Lora', serif",
                fontSize: 16,
                fontWeight: 500,
                color: row.isMuted ? '#6B7280' : '#0D1B2A',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.2px',
                minWidth: 0,
              }}
            >
              {row.name}
            </div>
            {row.isMuted && <MutedPill />}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              letterSpacing: '0.06em',
              color: '#6B7280',
              textTransform: 'uppercase',
              marginTop: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subline}
          </div>
        </div>
      </button>

      {showMuteIcon && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute?.();
          }}
          aria-label={row.isMuted ? `Unmute ${row.name}` : `Mute ${row.name}`}
          aria-pressed={row.isMuted}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            padding: '8px 6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {row.isMuted ? <BellSlashIcon /> : <BellIcon />}
        </button>
      )}

      <FollowingOrUnfollowToggle
        editMode={editMode}
        onClick={onUnfollow}
        name={row.name}
      />
    </div>
  );
}

// 1AM-28 phase 4: right-edge toggle. Renders the navy "✓ Following" pill in
// normal mode and a red destructive "Unfollow" pill in edit mode. Both
// affordances call the same onClick — Edit-modus is purely a visual
// emphasis on the destructive intent (per ticket: "shows red unfollow
// buttons in place of Following toggles"). No confirmation modal in v1
// per ticket open-design-question proposal; undo is via re-tapping Follow
// on any other surface.
function FollowingOrUnfollowToggle({ editMode, onClick, name }) {
  if (editMode) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        aria-label={`Unfollow ${name}`}
        style={{
          flexShrink: 0,
          margin: '8px 10px 8px 0',
          padding: '6px 14px',
          background: '#FFFFFF',
          color: '#DC2626',
          border: '1px solid rgba(220, 38, 38, 0.4)',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
          cursor: 'pointer',
        }}
      >
        Unfollow
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={`Unfollow ${name}`}
      aria-pressed="true"
      style={{
        flexShrink: 0,
        margin: '8px 10px 8px 0',
        padding: '6px 12px',
        background: '#0D1B2A',
        color: '#FAFAF7',
        border: '1px solid #0D1B2A',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "'DM Sans', sans-serif",
        cursor: 'pointer',
      }}
    >
      ✓ Following
    </button>
  );
}

function MutedPill() {
  return (
    <span
      style={{
        flexShrink: 0,
        background: '#F3F4F6',
        color: '#6B7280',
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        fontFamily: "'DM Sans', sans-serif",
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      Muted
    </span>
  );
}

function formatSubline({ chamber, state, count }) {
  const parts = [];
  if (chamber) parts.push(chamber);
  if (state) parts.push(state);
  if (count > 0) {
    parts.push(`${count} ${count === 1 ? 'trade' : 'trades'}`);
  } else {
    parts.push('no recent activity');
  }
  return parts.join(' · ');
}

// ── Icons ──────────────────────────────────────────────────────────────────

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

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6B7280"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function BellSlashIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#374151"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <path d="M6.26 6.26A6 6 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 17s-1-2-2-5" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
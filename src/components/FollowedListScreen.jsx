// 1AM-28 phase 2: FollowedListScreen — empty-zero + low-volume variants
//
// Replaces the phase 1 stub with the real UI for variants 1 and 2:
//
//   Variant 1 (Following 0):
//     - Three-people SVG icon (matches FeedEmptyHero empty-zero for visual
//       consistency — copied inline rather than shared because the two
//       variants may diverge in v2)
//     - Headline + body copy + primary/secondary CTA
//     - No Edit button, no gear (no list to edit; settings reachable via
//       other tabs through the bottom-nav)
//
//   Variant 2 (Following 1-9):
//     - Header with Edit button top-right (button visible from phase 2; the
//       destructive red Unfollow + Done UI is wired in phase 4 by reading
//       the `editMode` state set here)
//     - List of rows. Each row:
//         Avatar (party-color circle, deriveInitials fallback)
//         Name (Playfair Display, prominent)
//         Sub-line: chamber · state · N trades  (or "no recent activity"
//                   when count === 0 — drops "recent" / "90d" suffix per
//                   design discussion 2026-05-08; useTrades returns ~50
//                   most-recent filings without a 90d window guarantee)
//         Following ✓ toggle (filled-navy pill, right-aligned)
//         Tap-on-body navigates to PoliticianDetailScreen via split-mode
//         pattern from MemberListRow; toggle stays a separate target.
//     - "+ Add more" button at bottom (full-width, dashed border) →
//       Browse-tab Most Active section.
//
// High-volume variant 3 (search + sort + chamber-tabs + mute icons) ships
// in phase 3. Edit-modus destructive UI ships in phase 4.
//
// Trade-count per politician computed by exact name match against the
// trades prop. Mark-Warner-class name-matching mismatches deferred to
// 1AM-148 — for canonical-name follows (Pelosi, McConnell, Schumer) the
// counts are correct.
//
// Sort: phase 2 always renders 'most-active' (count desc, alphabetical
// tiebreaker). The sortOption prop is accepted but ignored until phase 3
// wires the dropdown.

import { useMemo, useState } from 'react';
import Avatar from './Avatar';
import { findByName } from '../lib/congress';
import { fullStateName } from '../lib/states';
import { deriveInitials } from '../lib/politicianAggregation';

export default function FollowedListScreen({
  followedPoliticians = [],
  // eslint-disable-next-line no-unused-vars
  mutedPoliticians = [],
  trades = [],
  // eslint-disable-next-line no-unused-vars
  sortOption = 'most-active',
  // eslint-disable-next-line no-unused-vars
  onSortChange,
  onTogglePolitician,
  // eslint-disable-next-line no-unused-vars
  onToggleMute,
  onShowPoliticianDetail,
  onBack,
  // eslint-disable-next-line no-unused-vars
  onSettingsClick,
  onAddMore,
  onSearchByName,
}) {
  // Edit-modus state — phase 4 reads this to flip row affordances to
  // destructive red Unfollow + Done. Phase 2 only toggles the button label.
  const [editMode, setEditMode] = useState(false);

  const count = followedPoliticians.length;

  // Trade-count per politician by exact name match. Mark-Warner-class
  // name mismatches tracked in 1AM-148 — counts are accurate for the
  // canonical-name follows the directory resolves cleanly.
  const tradeCountByName = useMemo(() => {
    const map = new Map();
    for (const t of trades) {
      map.set(t.politician, (map.get(t.politician) || 0) + 1);
    }
    return map;
  }, [trades]);

  // Resolve each followed name → row object with directory metadata + count.
  // Sorted by 'most-active' (count desc, alphabetical tiebreaker). Phase 3
  // wires alternate sorts via sortOption.
  const rows = useMemo(() => {
    const list = followedPoliticians.map((name) => {
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
      };
    });
    return list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [followedPoliticians, tradeCountByName]);

  return (
    <div
      style={{
        maxWidth: 420,
        margin: '0 auto',
        padding: '20px 24px 100px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Header bar — back chevron + (variant 2 only) Edit toggle ── */}
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
          aria-label="Back to Feed"
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
          ← Feed
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

      {/* ── Title + subtitle ───────────────────────────────────────────── */}
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

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {count === 0 ? (
        <EmptyZeroState
          onAddMore={onAddMore}
          onSearchByName={onSearchByName}
        />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row) => (
              <PoliticianRow
                key={row.bioguideId || row.name}
                row={row}
                onShowDetail={() => onShowPoliticianDetail?.(row.name)}
                onUnfollow={() => onTogglePolitician?.(row.name)}
              />
            ))}
          </div>
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
        </>
      )}
    </div>
  );
}

// ── Empty-zero variant ─────────────────────────────────────────────────────

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

// ── Politician row (variant 2) ─────────────────────────────────────────────

function PoliticianRow({ row, onShowDetail, onUnfollow }) {
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
        <Avatar initials={row.initials} party={row.party} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Playfair Display', 'Lora', serif",
              fontSize: 16,
              fontWeight: 500,
              color: '#0D1B2A',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.2px',
            }}
          >
            {row.name}
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
      <FollowingToggle
        onClick={onUnfollow}
        ariaLabel={`Unfollow ${row.name}`}
      />
    </div>
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

function FollowingToggle({ onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={ariaLabel}
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

// ── Three-people SVG icon (matches FeedEmptyHero empty-zero) ───────────────

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

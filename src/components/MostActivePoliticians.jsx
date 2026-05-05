// 1AM-124 fase 6: MostActivePoliticians
// Renders the top 3 most-active politicians (by trade count) in a fixed
// window above the Recent Trades section in BrowseAllFilingsScreen. Each row
// shows avatar + name + chamber/state metadata + trade count + Follow toggle.
//
// Aggregation is performed by the parent (BrowseAllFilingsScreen) on a separate
// trades fetch — independent of the user's chamber/action/time filters on the
// Recent Trades section. Same rationale as TrendingTickers: discovery signal,
// not filtered view. Adaptive window cascade applies (parent does 7d → 30d
// → all-time selection).
//
// Follow toggle (per user-validation 2026-05-03):
//   - Variant B from the Follow button design exploration: icon + label
//     ("+ Follow" outline / "✓ Following" filled-navy)
//   - Tapping toggles the politician in App.jsx `selected` follows state
//   - Visual feedback is immediate via the `followedNames` prop
//
// Empty state: when fewer than 1 politician has trades in the window, the
// section renders nothing rather than a placeholder. Same quiet-UX rule as
// TrendingTickers.
//
// Loading state: 3 skeleton rows so the page doesn't jump when data arrives.
//
// Props:
//   politicians     — array of { name, bioguideId, party, chamber, state, count, initials }, length 0-3
//   loading         — boolean, show skeleton while true
//   windowLabel     — string shown in the section header right side, e.g. "30 days"
//   followedNames   — array of currently-followed politician names (for toggle state)
//   onToggleFollow  — callback(name: string) when Follow button is tapped

import Avatar from './Avatar';

export default function MostActivePoliticians({
  politicians = [],
  loading = false,
  windowLabel = '7 days',
  followedNames = [],
  onToggleFollow,
}) {
  // Hide section entirely when not loading and no data — quieter UX.
  if (!loading && politicians.length === 0) {
    return null;
  }

  // O(1) lookup for "is this politician followed". Set<string> built from the
  // array prop; rebuilt on every render but the array is small (~tens of
  // names) so cost is negligible compared to a useMemo here.
  const followedSet = new Set(followedNames);

  return (
    <section style={{ marginBottom: 24 }}>
      {/* ── Section header ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontSize: 18,
            fontWeight: 500,
            color: '#0D1B2A',
            margin: 0,
            letterSpacing: '-0.2px',
          }}
        >
          Most Active
        </h2>
        <span
          style={{
            fontSize: 11,
            color: '#9CA3AF',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {windowLabel}
        </span>
      </div>

      {/* ── Politician rows ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading
          ? // Skeleton: 3 placeholder rows. Keeps height stable so the
            // search input below doesn't jump when data arrives.
            [0, 1, 2].map((i) => (
              <div
                key={`skel-${i}`}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8E5D8',
                  borderRadius: 10,
                  padding: '10px 14px',
                  height: 60,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: '#F1EFE6',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      width: 100,
                      height: 12,
                      background: '#F1EFE6',
                      borderRadius: 4,
                      marginBottom: 6,
                    }}
                  />
                  <div
                    style={{
                      width: 70,
                      height: 10,
                      background: '#F1EFE6',
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 80,
                    height: 28,
                    background: '#F1EFE6',
                    borderRadius: 999,
                  }}
                />
              </div>
            ))
          : politicians.map((p) => {
              const isFollowed = followedSet.has(p.name);
              return (
                <div
                  key={p.bioguideId || p.name}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E8E5D8',
                    borderRadius: 10,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Avatar initials={p.initials} party={p.party} size="md" />

                  {/* Name + chamber/state + trade count.
                      Layout: name on top line, "Chamber · State · N trades"
                      compactly on second line. */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#0D1B2A',
                        fontFamily: "'DM Sans', sans-serif",
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#6B7280',
                        fontFamily: "'DM Sans', sans-serif",
                        marginTop: 2,
                      }}
                    >
                      {p.chamber}
                      {p.state ? ` · ${p.state}` : ''} · {p.count}{' '}
                      {p.count === 1 ? 'trade' : 'trades'}
                    </div>
                  </div>

                  {/* Follow toggle. Variant B — icon + label.
                      Outline pill in unfollowed state, navy-filled in
                      followed state. Aria-pressed exposes toggle semantics. */}
                  <button
                    onClick={() => onToggleFollow?.(p.name)}
                    aria-pressed={isFollowed}
                    aria-label={
                      isFollowed
                        ? `Unfollow ${p.name}`
                        : `Follow ${p.name}`
                    }
                    style={{
                      background: isFollowed ? '#0D1B2A' : '#FFFFFF',
                      color: isFollowed ? '#FAFAF7' : '#0D1B2A',
                      border: '1px solid #0D1B2A',
                      borderRadius: 999,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition:
                        'background 0.15s ease, color 0.15s ease',
                    }}
                  >
                    {isFollowed ? '✓ Following' : '+ Follow'}
                  </button>
                </div>
              );
            })}
      </div>
    </section>
  );
}

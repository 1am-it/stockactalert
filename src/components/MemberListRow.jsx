// 1AM-79 / 1AM-69: Single row in the member list
//
// Compact horizontal row for the onboarding picker (and re-used in the
// 1AM-68 Politicians-tab redesign).
//
// Tap behaviour depends on whether `onClickRow` is provided:
//
//   - Without `onClickRow` (onboarding picker): tap anywhere on the row
//     toggles follow. Same as the original 1AM-79 behaviour.
//
//   - With `onClickRow` (Politicians-tab from 1AM-69 onwards): tap on the
//     row body navigates to the politician's detail page; only the trailing
//     selection indicator is the toggle target. This separation lets users
//     drill in to manage one politician without accidentally unfollowing.
//
// Props:
//   member     — Member object (see src/data/schema.js)
//   isSelected — boolean
//   onToggle   — () => void
//   onClickRow — () => void  (optional; when set, splits row body from toggle)

const PARTY_COLORS = {
  D: { fg: '#1D4ED8', bg: '#DBEAFE' }, // blue
  R: { fg: '#B91C1C', bg: '#FEE2E2' }, // red
  I: { fg: '#6B7280', bg: '#F3F4F6' }, // grey
};

export default function MemberListRow({ member, isSelected, onToggle, onClickRow }) {
  const partyColor = PARTY_COLORS[member.party] || PARTY_COLORS.I;
  const districtSuffix =
    member.chamber === 'House' && member.district !== undefined
      ? `-${member.district}`
      : '';

  // Mode A: legacy / onboarding — entire row toggles
  // Mode B: split — body navigates, toggle button toggles
  const isSplitMode = typeof onClickRow === 'function';

  const sharedRowStyle = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    background: isSelected ? '#0D1B2A' : '#FFFFFF',
    border: isSelected ? '1px solid #0D1B2A' : '1px solid #E5E7EB',
    borderRadius: 12,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'background 120ms ease, border-color 120ms ease',
  };

  const bodyContent = (
    <>
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: isSelected ? '#1F2937' : partyColor.bg,
          color: isSelected ? '#FAFAF7' : partyColor.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {member.initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: isSelected ? '#FAFAF7' : '#0D1B2A',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {member.name}
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            letterSpacing: '0.06em',
            color: isSelected ? '#9CA3AF' : '#6B7280',
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          {member.party} · {member.state}
          {districtSuffix} · {member.chamber}
        </div>
      </div>
    </>
  );

  const indicatorVisual = (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: isSelected ? '#059669' : 'transparent',
        border: isSelected ? 'none' : '1.5px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {isSelected && '✓'}
    </div>
  );

  // ── Mode A: full-row toggle (onboarding) ──────────────────────────────
  if (!isSplitMode) {
    return (
      <button onClick={onToggle} style={sharedRowStyle}>
        {bodyContent}
        {indicatorVisual}
      </button>
    );
  }

  // ── Mode B: split — body → onClickRow, toggle button → onToggle ───────
  // Outer wrapper is a div to avoid nested-button ARIA. Body is its own button
  // for keyboard a11y; toggle is a separate button with stopPropagation so
  // its click never bubbles to the body.
  return (
    <div style={{ ...sharedRowStyle, padding: 0, gap: 0 }}>
      <button
        onClick={onClickRow}
        aria-label={`View ${member.name} profile`}
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
        {bodyContent}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={isSelected ? `Unfollow ${member.name}` : `Follow ${member.name}`}
        aria-pressed={isSelected}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '10px 12px 10px 6px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {indicatorVisual}
      </button>
    </div>
  );
}

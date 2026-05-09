// 1AM-153: FilterPill — generic active-filter pill component
//
// A FilterPill represents a currently-applied filter that the user can
// dismiss with one tap (× button) or tap-to-edit (body click). Designed
// to be filter-type-agnostic — the same component renders search-as-pill
// in Browse, action filters ("Buy only"), amount filters ("≥$50K"), and
// any future filter dimensions without per-type styling drift.
//
// Design contract per Lovable v2 mockup:
//   - Light bg (#F3F4F6), 0.5px border (#E5E7EB), small × icon
//   - Distinct from filled-navy chamber tabs / time-range chips:
//     pills represent CONFIRMED filters, chips/tabs represent OPTIONS.
//   - No active/inactive state — a pill exists ⇔ a filter is active.
//
// API (per design Q&A 2026-05-09):
//   - `label` (required): what's shown inside the pill (e.g. "NVDA",
//     "Buy only", "≥$50K"). String only — formatting upstream.
//   - `onRemove` (required): callback when × is tapped. Should clear
//     the filter (set state back to default), not remove the pill from
//     a list — the pill un-renders automatically when its filter is no
//     longer active.
//   - `onClick` (optional): tap-on-pill-body callback for editable pills
//     (e.g. search-pill where tapping switches back to input mode).
//     When omitted, body is non-interactive (only × works). When
//     present, body gets cursor:pointer and aria-role="button".
//
// onRemove vs onClick separation per design Q&A: kept distinct so future
// pill variants ("amount filter pill that opens a slider on tap") don't
// require API overload. × always = remove, body tap = optional secondary.

export default function FilterPill({ label, onRemove, onClick }) {
  const isClickable = typeof onClick === 'function';

  const handleRemoveClick = (e) => {
    // Stop propagation so onRemove fires without also firing onClick when
    // the pill body is clickable. Critical for edit-affordance pills.
    e.stopPropagation();
    onRemove();
  };

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: '#F3F4F6',
        border: '1px solid #E5E7EB',
        borderRadius: 999,
        padding: '4px 4px 4px 10px',
        fontSize: 12,
        color: '#0D1B2A',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 500,
        cursor: isClickable ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        // Subtle hover-feedback only on clickable pills
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={
        isClickable
          ? (e) => {
              e.currentTarget.style.background = '#E5E7EB';
            }
          : undefined
      }
      onMouseLeave={
        isClickable
          ? (e) => {
              e.currentTarget.style.background = '#F3F4F6';
            }
          : undefined
      }
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={handleRemoveClick}
        aria-label={`Remove ${label} filter`}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6B7280',
          fontSize: 14,
          lineHeight: 1,
          // Slightly larger tap target than the visual circle
          transition: 'background 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#D1D5DB';
          e.currentTarget.style.color = '#0D1B2A';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#6B7280';
        }}
      >
        {/* Unicode × is wider than svg-x at this size and matches the
            inline-text aesthetic of the pill better than a stroked icon. */}
        ×
      </button>
    </div>
  );
}

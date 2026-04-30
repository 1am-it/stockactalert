// 1AM-112: SingleChipGroup — single-select filter chips with explicit "All"
//
// Used by BrowseAllFilingsScreen for chamber + action filters. Differs from
// the multi-select `ChipGroup` (used by Politicians-tab and onboarding) in
// two important ways:
//
//   1. Single-select: only one option active at a time. Tapping another chip
//      replaces the current selection (doesn't add to it).
//   2. Explicit "All" option: there's always a selection. "All" is the
//      default and represents the no-filter state. Tapping "All" resets to
//      no filter applied; tapping a non-All option narrows the result set.
//
// Visual style matches ChipGroup for consistency:
//   - active: navy filled (#0D1B2A bg + #FAFAF7 text)
//   - inactive: white surface, navy text, light grey border
//
// Props:
//   label    — short uppercase label shown to the left (e.g. "CHAMBER")
//   options  — array of { value, label } objects. The first option SHOULD
//              be the "All" option per convention.
//   value    — currently active value (string, never null/undefined)
//   onChange — (newValue) => void

export default function SingleChipGroup({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
          minWidth: 56,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              style={{
                padding: '6px 12px',
                background: active ? '#0D1B2A' : '#FFFFFF',
                color: active ? '#FAFAF7' : '#374151',
                border: active ? '1px solid #0D1B2A' : '1px solid #E5E7EB',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

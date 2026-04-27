// 1AM-79 / 1AM-68: Shared chip-group filter (multi-select)
//
// Used by:
//   - OnboardingPickPoliticians (onboarding step 3)
//   - PoliticiansScreen (Politicians-tab management screen)
//
// Props:
//   label    — short uppercase label shown to the left (e.g. "Chamber", "Party")
//   options  — array of { value, label } objects
//   value    — array of currently active values (multi-select)
//   onChange — (newValueArray) => void

export default function ChipGroup({ label, options, value, onChange }) {
  const toggle = (optionValue) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

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
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
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

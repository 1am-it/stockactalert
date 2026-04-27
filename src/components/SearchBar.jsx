// 1AM-79 / 1AM-68: Shared search bar
//
// Used by:
//   - OnboardingPickPoliticians (onboarding step 3)
//   - PoliticiansScreen (Politicians-tab management screen)
//
// Props:
//   value       — string (current input value, controlled)
//   onChange    — (newValue) => void
//   onClear     — () => void (called when × button is tapped)
//   placeholder — optional, defaults to "Search by name…"
//   ariaLabel   — optional, defaults to placeholder

export default function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search by name…',
  ariaLabel,
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 14,
          fontSize: 14,
          color: '#9CA3AF',
          pointerEvents: 'none',
        }}
      >
        ⌕
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        style={{
          width: '100%',
          padding: '12px 14px 12px 38px',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          fontSize: 15,
          fontFamily: "'DM Sans', sans-serif",
          color: '#0D1B2A',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#0D1B2A')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: 8,
            background: 'transparent',
            border: 'none',
            color: '#9CA3AF',
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

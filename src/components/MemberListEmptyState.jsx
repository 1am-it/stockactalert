// 1AM-79 / 1AM-68: Shared empty state for member lists
//
// Used by:
//   - OnboardingPickPoliticians (when filters yield no matches)
//   - PoliticiansScreen (when filters yield no matches in Browse-all section)
//
// Props:
//   title   — optional, defaults to "No politicians match"
//   message — optional, defaults to "Try fewer filters or a different search."

export default function MemberListEmptyState({
  title = 'No politicians match',
  message = 'Try fewer filters or a different search.',
}) {
  return (
    <div
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        background: '#FFFFFF',
        border: '1px dashed #E5E7EB',
        borderRadius: 14,
      }}
    >
      <div
        style={{
          fontSize: 24,
          marginBottom: 8,
          color: '#9CA3AF',
        }}
      >
        ⌕
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#0D1B2A',
          marginBottom: 4,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#6B7280',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {message}
      </div>
    </div>
  );
}

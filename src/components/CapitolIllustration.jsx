// 1AM-111: CapitolIllustration — decorative SVG for Personal feed empty state
//
// Stylised Capitol building used as visual anchor in the empty state when
// the user follows politicians but no recent filings match. Colours pulled
// strictly from the existing app palette:
//   - Circle background: #E5F0FF (Politicians-tab blue avatar background)
//   - All building elements: #0D1B2A (navy) at varying opacity (25%/35%/55%)
//   - Cloud accents: pure white at 60% opacity
//
// Decorative-only — `aria-hidden="true"` on the root svg.
//
// Sized via `size` prop. Default 140px matches the empty-state mockup.
// Kept as a separate component so it can be reused elsewhere later (Settings
// About page, FAQ, etc.) without copying inline SVG.

export default function CapitolIllustration({ size = 140 }) {
  return (
    <svg
      width={size}
      height={(size * 120) / 140}
      viewBox="0 0 140 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Soft circle background */}
      <circle cx="70" cy="62" r="56" fill="#E5F0FF" />

      {/* Subtle clouds */}
      <g opacity="0.6">
        <ellipse cx="32" cy="42" rx="11" ry="3.5" fill="#FFFFFF" />
        <ellipse cx="108" cy="36" rx="13" ry="4" fill="#FFFFFF" />
      </g>

      {/* Trees (foliage) */}
      <g fill="#0D1B2A" fillOpacity="0.25">
        <ellipse cx="20" cy="92" rx="9" ry="14" />
        <ellipse cx="120" cy="92" rx="9" ry="14" />
      </g>
      {/* Tree trunks */}
      <g fill="#0D1B2A" fillOpacity="0.55">
        <rect x="19" y="92" width="2" height="14" />
        <rect x="119" y="92" width="2" height="14" />
      </g>

      {/* Building base */}
      <rect x="42" y="78" width="56" height="28" fill="#0D1B2A" fillOpacity="0.35" />
      {/* Cornice / entablature */}
      <rect x="38" y="74" width="64" height="6" fill="#0D1B2A" fillOpacity="0.55" />

      {/* Column lines */}
      <g stroke="#FFFFFF" strokeWidth="1" opacity="0.7">
        <line x1="50" y1="80" x2="50" y2="105" />
        <line x1="58" y1="80" x2="58" y2="105" />
        <line x1="66" y1="80" x2="66" y2="105" />
        <line x1="74" y1="80" x2="74" y2="105" />
        <line x1="82" y1="80" x2="82" y2="105" />
        <line x1="90" y1="80" x2="90" y2="105" />
      </g>

      {/* Dome drum (cylindrical base of the dome) */}
      <rect x="48" y="62" width="44" height="14" fill="#0D1B2A" fillOpacity="0.55" />
      {/* Dome itself */}
      <path d="M 50 62 Q 70 38 90 62 Z" fill="#0D1B2A" fillOpacity="0.35" />

      {/* Flagpole + finial */}
      <rect x="69" y="32" width="2" height="10" fill="#0D1B2A" fillOpacity="0.55" />
      <circle cx="70" cy="32" r="2" fill="#0D1B2A" fillOpacity="0.55" />

      {/* Ground line */}
      <rect x="46" y="106" width="48" height="2" fill="#0D1B2A" fillOpacity="0.55" />
    </svg>
  );
}

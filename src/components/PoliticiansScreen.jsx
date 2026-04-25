// 1AM-24: Politicians management screen
// Lets the user add/remove followed politicians after onboarding.
//
// Renders the same grid as the onboarding step (via PoliticianPickGrid),
// but with a count header instead of a sticky CTA bar. Tap-to-toggle
// updates state immediately — no save button, modern app convention.
//
// Props:
//   selected — array of currently followed politician names
//   onToggle — callback (name) => void

import PoliticianPickGrid from './PoliticianPickGrid';
import { CURATED_POLITICIANS } from '../data/curatedPoliticians';

export default function PoliticiansScreen({ selected, onToggle }) {
  const totalCount = selected.length;

  return (
    <div>
      {/* Count header — minimal, in the same monospace style as feed indicators */}
      <div
        style={{
          fontSize: 11,
          color: '#9CA3AF',
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 16,
          padding: '0 2px',
        }}
      >
        Following {totalCount} {totalCount === 1 ? 'politician' : 'politicians'}
      </div>

      <PoliticianPickGrid
        politicians={CURATED_POLITICIANS}
        selected={selected}
        onToggle={onToggle}
      />
    </div>
  );
}

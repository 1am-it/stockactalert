// SAA-2: Avatar Component
// Used across feed, politician cards, profiles and bottom sheets
// Props: bioguideId (optional), initials, party, size (sm/md/lg/xl), onClick
//
// 1AM-146 (photos-only scope): when `bioguideId` is provided, render a
// <img> from the public-domain unitedstates/images Congress portraits.
// On load failure (404, network error, missing portrait), the image is
// hidden and the existing initials block remains visible underneath —
// graceful degradation without layout shift. With no `bioguideId`, the
// avatar behaves identically to the v1 component.
//
// Source: https://unitedstates.github.io/images/congress/225x275/{bioguideId}.jpg
// Licence: CC0 1.0 / public domain (acknowledged in Settings)

import { useState } from 'react';
import { getPartyColor } from '../styles/theme';

const SIZES = {
  sm: { diameter: '32px', fontSize: '11px' },
  md: { diameter: '44px', fontSize: '14px' },
  lg: { diameter: '56px', fontSize: '18px' },
  xl: { diameter: '64px', fontSize: '22px' },
};

const PHOTO_BASE = 'https://unitedstates.github.io/images/congress/225x275';

function buildPhotoUrl(bioguideId) {
  if (!bioguideId || typeof bioguideId !== 'string') return null;
  // Bioguide IDs are alphanumeric (e.g. P000197). Defensive guard against
  // unexpected input that would yield a malformed URL.
  if (!/^[A-Za-z]\d{6}$/.test(bioguideId)) return null;
  return `${PHOTO_BASE}/${bioguideId}.jpg`;
}

export default function Avatar({ bioguideId, initials, party, size = 'md', onClick }) {
  const { diameter, fontSize } = SIZES[size] || SIZES.md;
  const partyColor = getPartyColor(party);
  const photoUrl = buildPhotoUrl(bioguideId);

  // photoStatus: 'pending' (img loading) | 'ok' (loaded) | 'failed' (404/error)
  // When 'failed', the <img> is removed and initials remain visible. When
  // 'pending', initials render underneath the loading <img> so the avatar
  // is never empty during network latency — the photo simply replaces the
  // initials when ready (or never, if it fails).
  const [photoStatus, setPhotoStatus] = useState(photoUrl ? 'pending' : 'failed');

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        background: `${partyColor}12`,
        border: `2px solid ${partyColor}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 800,
        color: partyColor,
        fontFamily: "'DM Sans', sans-serif",
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {initials}
      {photoUrl && photoStatus !== 'failed' && (
        <img
          src={photoUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onLoad={() => setPhotoStatus('ok')}
          onError={() => setPhotoStatus('failed')}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
            opacity: photoStatus === 'ok' ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}
    </div>
  );
}

// ── Usage examples ────────────────────────────────────────────────────────────
// <Avatar bioguideId="P000197" initials="NP" party="D" size="md" />
// <Avatar initials="TT" party="R" size="lg" /> // initials-only when bioguideId unknown
// <Avatar bioguideId="J000001" initials="JG" party="D" size="sm" onClick={() => navigate('/politicians/1')} />
//
// Notes:
// - `objectPosition: 'center 20%'` shifts framing slightly upward so faces
//   sit centered rather than mid-torso when cropped to a circle. Tuned
//   against the GPO-portrait composition (head-and-shoulders).
// - Family-member trades (spouse/joint/dependent) should NOT pass bioguideId
//   to this component — initials-only is the right treatment for non-public
//   figures. The TradeCard owner-pill logic handles the visual disambiguation.

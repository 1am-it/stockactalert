// 1AM-160: BrowsePoliticiansScreen — full-directory politicus browse for
// in-app follow management.
//
// Surfaced as a sub-screen of FollowedListScreen via the "Add more" CTA
// (re-routing to this screen lives in 1AM-161 — the existing CTA still
// points at Browse-tab trades-list until that ticket lands, so this screen
// is reachable only via the App.jsx feedSubScreen route added in 1AM-160).
//
// Closes the discovery gap that opened when 1AM-123 (3-tab IA redesign)
// dropped the Politicians-tab from the v6 vision in favour of Browse-tab.
// Use cases this restores:
//   - "I want to follow my Arizona senators" — browse + filter to find
//     them without waiting for them to appear in the feed
//   - "Who am I not yet following?" — browse to find new politici outside
//     the Most Active section
//   - "Filter by chamber/party to expand my follow-set deliberately" —
//     previously only available during one-time onboarding
//
// Layout:
//   - Header: ← Back + "Browse Politicians" + count "Following N of M"
//   - Body: <PoliticianPickerList showSuggested={false} ...>
//     (suggestions hidden — user is here BECAUSE they already follow ≥1)
//   - Sticky footer: Done button → returns to FollowedListScreen
//   - TabBar via App.jsx wrapper (sub-screen consistency with FollowedList)
//
// Selection semantics:
//   - Filled star/checkmark in MemberListRow indicates currently followed
//   - Tap row to toggle follow/unfollow directly (no confirm dialog)
//   - No section split for "Already following" — sort stays consistent
//     with onboarding (alphabetic / activity-based via applyFilters)

import { useMemo } from 'react';
import PoliticianPickerList from './PoliticianPickerList';
import { MEMBERS } from '../lib/congress';
import { useTrades } from '../hooks/useTrades';

// 1AM-171: 90d window for activity-signal aggregation. Hardcoded — Browse
// Politicians is a directory, not a tunable dashboard. 90d is broad enough
// to surface recent activity without noise from much-older trades.
const ACTIVITY_WINDOW_DAYS = 90;

export default function BrowsePoliticiansScreen({
  followedPoliticians,
  onTogglePolitician,
  onBack,
}) {
  const totalMembers = MEMBERS.length;
  const followingCount = followedPoliticians.length;

  // 1AM-171: name normalisation matching the lib/congress `normaliseSearchString`
  // (NFKD + diacritics-strip + lowercase + trim) so this lookup map agrees with
  // any future cross-checks against findByName-derived data.
  const normName = (s) =>
    (s || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // 1AM-171: build a normalised-name → bioguideId Map covering the compound-
  // lastName mismatch between roster and FMP feed. Roster lastName for ~15
  // members includes a middle component (e.g. "McClain Delaney") that FMP
  // omits — its display form is just first + last-word ("April Delaney").
  // Four strategy keys per member ensure we resolve both forms, plus the
  // `name` and `officialFull` variants for completeness. Done in module scope
  // (no useMemo deps on MEMBERS — it's a static import) but wrapped in
  // useMemo to avoid rebuilding per render.
  const bioguideByName = useMemo(() => {
    const m = new Map();
    for (const member of MEMBERS) {
      const first = member.firstName || '';
      const last = member.lastName || '';
      const lastWord = last.split(' ').pop();
      const keys = [
        member.name,
        member.officialFull,
        `${first} ${last}`,
        `${first} ${lastWord}`,
      ];
      for (const k of keys) {
        const nk = normName(k);
        if (nk && !m.has(nk)) m.set(nk, member.bioguideId);
      }
    }
    return m;
  }, []);

  // 1AM-171: aggregate trade-count per politician (keyed on bioguideId) within
  // 90d window. Bioguide-keying is the durable form — name-string keying
  // breaks for any member whose roster entry includes a middle name that the
  // upstream feed omits (April McClain Delaney roster vs April Delaney feed).
  // Politicians with 0 trades simply absent from the Map — MemberListRow's
  // default of 0 handles that case (no suffix rendered). Trades whose
  // politician name fails to resolve to a roster member are skipped (no
  // suffix anywhere is preferable to a misattributed count).
  const { trades } = useTrades();
  const tradeCountsByBioguide = useMemo(() => {
    const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const counts = new Map();
    for (const t of trades) {
      if (t.tradeDate && t.tradeDate < since) continue;
      const bioguideId = bioguideByName.get(normName(t.politician));
      if (!bioguideId) continue;
      counts.set(bioguideId, (counts.get(bioguideId) || 0) + 1);
    }
    return counts;
  }, [trades, bioguideByName]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          maxWidth: 720,
          width: '100%',
          margin: '0 auto',
          padding: '24px 24px 120px',
        }}
      >
        {/* Back link — consistent with FollowedListScreen / detail screen
            chevron-and-text styling. */}
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            fontSize: 13,
            color: '#6B7280',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: 14,
          }}
        >
          ← Back
        </button>

        {/* Title + count meta-line. Count uses monospace + muted gray
            (consistent with existing meta-line typography). */}
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            fontWeight: 700,
            color: '#0D1B2A',
            lineHeight: 1.1,
            margin: 0,
            marginBottom: 6,
          }}
        >
          Browse Politicians
        </h1>
        <div
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#6B7280',
            letterSpacing: '0.04em',
            marginBottom: 24,
          }}
        >
          Following {followingCount} of {totalMembers}
        </div>

        <PoliticianPickerList
          selected={followedPoliticians}
          onToggle={onTogglePolitician}
          showSuggested={false}
          tradeCountsByBioguide={tradeCountsByBioguide}
        />
      </div>

      {/* Sticky footer — Done returns to FollowedListScreen. Symmetric with
          onboarding's Continue but semantically different: directory-mode
          allows leaving with zero selections (you can unfollow everyone). */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'rgba(250, 250, 247, 0.95)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid #E5E7EB',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: '12px 28px',
            background: '#0D1B2A',
            color: '#FAFAF7',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

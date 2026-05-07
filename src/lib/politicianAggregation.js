// 1AM-145: Shared politician aggregation helpers
// Extracted from BrowseAllFilingsScreen.jsx (1AM-124 fase 6) so the Feed-tab
// empty-state (1AM-145) can render its own "While you wait — Most Active"
// embed using the same aggregation logic. DRY: aggregator changes (e.g. new
// member fallback fields) ripple to both consumers without duplication.
//
// Original location: BrowseAllFilingsScreen.jsx ~line 203 (1AM-124 fase 6).
// Constants:
//   MOST_ACTIVE_TOP_N — default top-N count for Most Active rendering. Used
//     as the default arg for `aggregateMostActivePoliticians`. Browse-tab
//     uses this directly; Feed-tab uses it too for visual consistency
//     (3 rows on both surfaces).
//
// Note: MOST_ACTIVE_MIN_POLITICIANS (cascade threshold) stays in
// BrowseAllFilingsScreen — it's specific to the cascade pattern (7d → 30d →
// all-time) which Feed-tab doesn't use. Feed aggregates from whatever data
// is already loaded by useTrades(); no separate cascade.

import { findByName } from './congress';

export const MOST_ACTIVE_TOP_N = 3;

// Best-effort initials from a name. Used as Avatar fallback content when
// theunitedstates.io image is not yet wired (see 1AM-146).
export function deriveInitials(fullName) {
  if (!fullName || typeof fullName !== 'string') return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Aggregate trades into top-N politicians by trade count.
 *
 * Uses bioguideId as bucket key when the directory resolves the name;
 * falls back to the raw name string when resolution fails. Sort is by
 * count desc, alphabetical tiebreaker.
 *
 * @param {Array} trades  — array of trade objects with `politician` field
 * @param {number} topN   — maximum rows returned (default MOST_ACTIVE_TOP_N)
 * @returns {Array} sorted array of { name, bioguideId, party, chamber,
 *                                    state, count, initials }
 */
export function aggregateMostActivePoliticians(trades, topN = MOST_ACTIVE_TOP_N) {
  if (!Array.isArray(trades) || trades.length === 0) return [];

  // Bucket by resolved bioguideId when possible; fall back to raw name as key
  // if directory lookup fails. The bucket key is a string either way so Map
  // works uniformly.
  const buckets = new Map(); // key → { name, bioguideId, party, chamber, state, count, initials }

  for (const t of trades) {
    const rawName = (t.politician || '').trim();
    if (!rawName) continue;

    const matches = findByName(rawName);
    const member = Array.isArray(matches) && matches.length > 0 ? matches[0] : null;

    const key = member?.bioguideId || rawName;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    // Prefer Member directory data (canonical name, state, bioguideId);
    // fall back to trade-level fields when directory lookup failed.
    const displayName = member?.name || rawName;
    buckets.set(key, {
      name: displayName,
      bioguideId: member?.bioguideId || null,
      party: member?.party || t.party || null,
      chamber: member?.chamber || t.chamber || '',
      state: member?.state || '',
      count: 1,
      initials: deriveInitials(displayName),
    });
  }

  return Array.from(buckets.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      // Stable tiebreaker: alphabetical by name.
      return a.name.localeCompare(b.name);
    })
    .slice(0, topN);
}

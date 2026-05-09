// src/lib/formatChamberLine.js — 1AM-37 phase 2
//
// Canonical formatter for the "chamber · state[-district]" line shown in:
//   - Trade Detail Drawer header (1AM-70, upcoming)
//   - PoliticianDetailScreen (existing, may migrate to this helper later)
//   - FollowedListScreen sub-line (1AM-28, currently uses ad-hoc format)
//
// Goal: ONE place that decides how to render chamber + state + district so
// the four edge cases (Senate, standard House district, at-large state,
// non-voting delegate) are handled uniformly across the app.
//
// Decision tree (top-to-bottom; first match wins):
//
//   1. chamber === 'Senate'           → "Senate · {state}"
//   2. chamber === 'House' + delegate → "House · {state}"           (e.g. DC, PR)
//   3. chamber === 'House' + at-large → "House · {state}-AL"        (e.g. AK, WY)
//   4. chamber === 'House' + district → "House · {state}-{district}"
//   5. fallback                       → "{chamber} · {state}" or just "{chamber}"
//
// Why DELEGATE_STATES is needed (and not just `district === null` check):
//   The unitedstates/congress-legislators source returns `district: 0` for
//   BOTH at-large states (AK, WY, etc.) AND non-voting delegates (DC, PR,
//   etc.). The numeric value alone can't distinguish them. We hardcode the
//   delegate set explicitly — it's stable, defined by the U.S. Constitution
//   + congressional acts, and doesn't change frequently.
//
// Why AT_LARGE_STATES is needed (and not just `district === 0`):
//   Same reason — district=0 is ambiguous. Hardcoded set per current
//   apportionment (post-2020 census). Refresh on next census (2030+).

// Non-voting delegates: DC + 5 U.S. territories. These politicians sit in
// the House but have no voting district — they represent their territory
// at-large but the "AL" suffix would be misleading (delegates are a
// distinct constitutional category from at-large representatives).
const DELEGATE_STATES = new Set(['DC', 'PR', 'GU', 'VI', 'AS', 'MP']);

// At-large states: states with a single House seat where the rep represents
// the entire state. Industry convention (Capitol Trades, Quiver) renders
// the district as "AL" suffix. Current as of 119th Congress (post-2020
// reapportionment). MT moved from at-large to 2 districts after 2020,
// hence absent from this list.
const AT_LARGE_STATES = new Set(['AK', 'DE', 'ND', 'SD', 'VT', 'WY']);

/**
 * Format a politician's chamber line for display.
 *
 * @param {Object} member
 * @param {string} member.chamber  - 'Senate' | 'House' (case-sensitive)
 * @param {string} member.state    - 2-letter USPS code (e.g. 'CA', 'AK', 'DC')
 * @param {number} [member.district] - House district number, or 0 for at-large/delegate, or absent for Senate
 * @returns {string} Formatted line (e.g. "House · CA-11", "Senate · NY", "House · AK-AL", "House · DC")
 */
export function formatChamberLine({ chamber, state, district } = {}) {
  // Defensive: normalise inputs to handle weird upstream data without throwing
  const ch = (chamber || '').trim();
  const st = (state || '').trim().toUpperCase();

  // Case 1: Senate — districts don't apply, even for senators from at-large states
  if (ch === 'Senate') {
    return st ? `Senate · ${st}` : 'Senate';
  }

  // Cases 2-4: House
  if (ch === 'House') {
    if (!st) return 'House';

    // Case 2: Non-voting delegate (DC + territories) — no district suffix
    if (DELEGATE_STATES.has(st)) {
      return `House · ${st}`;
    }

    // Case 3: At-large state — single House seat, "AL" suffix per industry convention
    if (AT_LARGE_STATES.has(st)) {
      return `House · ${st}-AL`;
    }

    // Case 4: Standard House district — "{state}-{district}"
    if (typeof district === 'number' && district > 0) {
      return `House · ${st}-${district}`;
    }

    // Defensive fallback: House but no usable district info — just chamber + state.
    // Shouldn't happen with congress-legislators data, but degrades gracefully.
    return `House · ${st}`;
  }

  // Case 5: Unknown chamber — return what we have
  if (ch && st) return `${ch} · ${st}`;
  if (ch) return ch;
  return '';
}

// Exported for tests + any consumer that wants to check membership directly
// (e.g. drawer rendering an "(at-large)" hint elsewhere).
export const _DELEGATE_STATES = DELEGATE_STATES;
export const _AT_LARGE_STATES = AT_LARGE_STATES;

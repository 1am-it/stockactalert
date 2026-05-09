// 1AM-153: FilterSummaryLine — generic count + context summary line
//
// Single source of truth for the small monospace strip that tells the user
// "what they're looking at" — count of visible items, optional total
// universe size, and optional filter-context labels.
//
// Used by:
//   - BrowseAllFilingsScreen — replaces the inline count strip above the
//     filings list. Shows active filter labels alongside the count.
//   - FeedScreen FilterBar — replaces the bespoke monospace label. In
//     Show-all mode shows magnitude ("of N") to communicate the broader
//     Congress universe; in Followed mode keeps the existing politicus-
//     count formulation (different relation: "of N politicians", not "of N
//     trades").
//
// API:
//   - `count` (required): the visible-item count (e.g. 24, 12).
//   - `noun` (optional): label for the count item, defaults to 'filing'.
//     Pluralised automatically based on count. Pass 'trade' for Feed,
//     'filing' for Browse — they're synonyms here, but match each surface's
//     established copy.
//   - `of` (optional): total universe size when meaningful (Show-all mode).
//     Renders as "X of Y" when present. When null/undefined, just shows X.
//   - `contextParts` (optional): array of strings appended after the count
//     with separator (e.g. ['NVDA', 'Senate'] → "12 filings · NVDA · Senate").
//     Falsy entries are filtered out so callers can pass conditional values
//     without pre-filtering.
//
// Separator constant per design Q&A 2026-05-09: middle-dot ' · ' matches
// existing conventions (TradeCard owner-line, BrowseAllFilingsScreen footer).
// Defined as a constant so a future change is one edit, not a search-and-
// replace across the file.
//
// Typography (1AM-153 phase 4 design Q&A 2026-05-09): muted gray (#6B7280)
// + sentence-case + DM Sans 12px. Filter-summary is meta/secondary content,
// not primary — typography reflects that. Replaces the old monospace-
// uppercase Feed FilterBar styling (1AM-66) and the navy Browse count
// styling (1AM-114). Single muted treatment for both surfaces — unification
// is the explicit goal of 1AM-153.

const SEPARATOR = ' · ';

/**
 * @param {Object} props
 * @param {number} props.count
 * @param {string} [props.noun='filing']
 * @param {number} [props.of]
 * @param {string[]} [props.contextParts=[]]
 */
export default function FilterSummaryLine({
  count,
  noun = 'filing',
  of,
  contextParts = [],
}) {
  const pluralNoun = count === 1 ? noun : `${noun}s`;

  const countPart =
    typeof of === 'number'
      ? `${count} of ${of} ${pluralNoun}`
      : `${count} ${pluralNoun}`;

  const cleanContext = (contextParts || []).filter(Boolean);

  const fullLine =
    cleanContext.length > 0
      ? [countPart, ...cleanContext].join(SEPARATOR)
      : countPart;

  return (
    <div
      style={{
        fontSize: 12,
        color: '#6B7280',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {fullLine}
    </div>
  );
}

// Exported separator for consumers who want to render their own variants
// in lockstep with this component's typography (e.g. screen-reader-only
// labels that mirror the visual line).
export const FILTER_SUMMARY_SEPARATOR = SEPARATOR;

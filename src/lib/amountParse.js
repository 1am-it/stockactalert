// 1AM-260: extracted from BrowseAllFilingsScreen.jsx and
// PoliticianDetailScreen.jsx, which each had their own copy of this exact
// parser (both comments flagged it as "should be DRY-ed... when next
// touched"). This ticket's new "most notable trade" highlight is a third
// consumer, crossing this codebase's own documented extraction threshold.

/**
 * Parses a STOCK Act amount-range string (e.g. "$1,001 - $15,000") into a
 * midpoint estimate. Single-value / "+"-suffixed formats (e.g. "$1M+") fall
 * back to parsing that one number. Returns 0 on unparseable input.
 *
 * @param {string} amountStr
 * @returns {number}
 */
export function parseAmountMidpoint(amountStr) {
  if (!amountStr || typeof amountStr !== 'string') return 0;
  const cleaned = amountStr.replace(/[$,]/g, '').replace(/–|—/g, '-');
  const parts = cleaned.split('-').map((s) => s.trim());
  if (parts.length !== 2) {
    return parseAmountSingle(parts[0]);
  }
  const lo = parseAmountSingle(parts[0]);
  const hi = parseAmountSingle(parts[1]);
  return (lo + hi) / 2;
}

function parseAmountSingle(s) {
  if (!s) return 0;
  const trimmed = s.trim().toUpperCase();
  const num = parseFloat(trimmed);
  if (isNaN(num)) return 0;
  if (trimmed.includes('M')) return num * 1_000_000;
  if (trimmed.includes('K')) return num * 1_000;
  return num;
}

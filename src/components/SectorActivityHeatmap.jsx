// 1AM-170: SectorActivityHeatmap
// Watch-tab card that shows buys vs sells per sector across the user's
// followed politicians within the current watch-window. Meta-information
// only — no rendementen, no rankings, no rood/groen. Pure factual data
// in two neutral hues (zwart-buys, grijs-sells, dezelfde hue).
//
// Visual design (per Lovable mockup, variant B — neutral split-bars):
//
//   ┌─ Sector activity ──────────────────────────────────────────────┐
//   │  Buys vs sells across followed · last 30d                       │
//   │                                                                 │
//   │  ● Buys  ○ Sells                                                │
//   │                                                                 │
//   │  Defense                                              6B · 1S   │
//   │  ████████████████░░░░                                           │
//   │  Tech                                                 7B · 2S   │
//   │  ████████████████████████░░░                                    │
//   │  Energy                                               1B · 3S   │
//   │  ░░░░░░░░░░░░░░░░░░░░░                                          │
//   │  ...                                                            │
//   └─────────────────────────────────────────────────────────────────┘
//
// Decisions logged:
//   - Top 5 sectors by total trade-count (buys + sells), descending
//   - Bar widths normalised to the highest-total sector — gives a visual
//     hierarchy without absolute-magnitude misreading
//   - Auto-hide: component returns null when there are no sector entries
//     to show (e.g. quiet 90d window). No "no sector activity yet" placeholder
//     — restraint pattern, weglaten is sterker
//   - Trades with empty `t.sector` (uncovered tickers, ~14% per 1AM-159) are
//     silently skipped, not bucketed into "Unknown". Surfacing "Unknown" as
//     its own bar would dilute the signal without adding actionable info.
//   - Long sector names truncated with ellipsis (max ~16 chars) — Consumer
//     Discretionary becomes "Consumer Discr…" same way Net Positions does.
//   - Tap-to-filter: calls onSectorTap with the sector string. App.jsx wires
//     this to a transient hand-off (pendingExploreFilter) that pre-sets
//     Explore-tab's sector filter + maps the current watch-window to
//     Explore's closest time-period chip (1AM-172).
//
// Props:
//   trades         — array of normalised Trade objects (already filtered to
//                    followed + window by the caller — typically `watchTrades`
//                    from FeedScreen)
//   windowLabel    — '24h' | '7d' | '30d' | '90d', drives subtitle copy
//   onSectorTap    — optional callback(sectorName) when a row is tapped

const TOP_N_SECTORS = 5;
const SECTOR_NAME_MAX_CHARS = 16;

// Truncate sector names that would overflow the row label area. Same
// pattern as Net Positions (1AM-159) — preserves leading characters,
// adds an ellipsis. Short names pass through unchanged.
function truncateSectorName(name) {
  if (!name) return '';
  if (name.length <= SECTOR_NAME_MAX_CHARS) return name;
  return name.slice(0, SECTOR_NAME_MAX_CHARS - 1) + '…';
}

// Aggregate trades into Map<sector, {buys, sells, total}>, return top-N
// sorted by total trade-count descending. Empty-sector trades skipped.
function aggregateSectorActivity(trades) {
  const buckets = new Map();
  for (const trade of trades) {
    if (!trade.sector) continue;
    const existing = buckets.get(trade.sector) || { buys: 0, sells: 0 };
    if (trade.action === 'Purchase') existing.buys++;
    else if (trade.action === 'Sale') existing.sells++;
    buckets.set(trade.sector, existing);
  }
  return Array.from(buckets.entries())
    .map(([sector, counts]) => ({
      sector,
      buys: counts.buys,
      sells: counts.sells,
      total: counts.buys + counts.sells,
    }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N_SECTORS);
}

const WINDOW_LABEL_COPY = {
  '24h': 'last 24h',
  '7d': 'last 7d',
  '30d': 'last 30d',
  '90d': 'last 90d',
};

export default function SectorActivityHeatmap({
  trades = [],
  windowLabel = '30d',
  onSectorTap,
}) {
  const sectors = aggregateSectorActivity(trades);

  // Auto-hide when there's nothing to show. Restraint: no "no activity"
  // placeholder. The user will infer from the empty-state hero ("0 filings
  // in 90 days") that there's no activity at all.
  if (sectors.length === 0) {
    return null;
  }

  // Normalise bar widths to the highest-total sector so the visual hierarchy
  // is preserved across both quiet and busy windows.
  const maxTotal = sectors[0].total;

  const subtitleCopy = `Buys vs sells across followed · ${WINDOW_LABEL_COPY[windowLabel] || 'last 30d'}`;

  return (
    <section
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5D8',
        borderRadius: 14,
        padding: '20px 18px',
        marginBottom: 24,
        marginTop: 16,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Header: title + subtitle ─────────────────────────────────────── */}
      <h2
        style={{
          fontFamily: "'Playfair Display', 'Lora', serif",
          fontSize: 18,
          fontWeight: 500,
          color: '#0D1B2A',
          margin: 0,
          letterSpacing: '-0.2px',
        }}
      >
        Sector activity
      </h2>
      <div
        style={{
          fontSize: 12,
          color: '#9CA3AF',
          marginTop: 4,
          marginBottom: 16,
        }}
      >
        {subtitleCopy}
      </div>

      {/* ── Legend: zwarte dot Buys + grijze dot Sells ───────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          marginBottom: 14,
          fontSize: 11,
          color: '#6B7280',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#0D1B2A',
            }}
          />
          Buys
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#9CA3AF',
            }}
          />
          Sells
        </span>
      </div>

      {/* ── Sector rows ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sectors.map((s) => (
          <SectorBar
            key={s.sector}
            sector={s.sector}
            buys={s.buys}
            sells={s.sells}
            total={s.total}
            maxTotal={maxTotal}
            windowCopy={WINDOW_LABEL_COPY[windowLabel] || 'last 30d'}
            onTap={onSectorTap ? () => onSectorTap(s.sector) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

// ── Single sector bar row ────────────────────────────────────────────────────
function SectorBar({ sector, buys, sells, total, maxTotal, windowCopy, onTap }) {
  const widthPct = Math.max(4, Math.round((total / maxTotal) * 100));
  const buyPctOfBar = total > 0 ? (buys / total) * 100 : 0;

  // Whole row is one tap target when onTap is wired. Falls back to a
  // non-interactive div when onTap is undefined (renders fine on Browse
  // surfaces that don't yet route the tap-to-filter contract).
  const rowContent = (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: '#374151',
            fontWeight: 500,
          }}
        >
          {truncateSectorName(sector)}
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#6B7280',
            letterSpacing: '0.04em',
          }}
        >
          {buys}B · {sells}S
        </span>
      </div>
      {/* Split-bar: full width is total-relative; inner segments split on
          buy/sell ratio. Background is muted-gray so empty-bar areas are
          visible but not distracting. */}
      <div
        style={{
          width: '100%',
          height: 6,
          borderRadius: 3,
          background: '#F3F4F6',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${widthPct}%`,
            height: '100%',
            display: 'flex',
          }}
        >
          {buys > 0 && (
            <div
              style={{
                width: `${buyPctOfBar}%`,
                height: '100%',
                background: '#0D1B2A',
              }}
            />
          )}
          {sells > 0 && (
            <div
              style={{
                width: `${100 - buyPctOfBar}%`,
                height: '100%',
                background: '#9CA3AF',
              }}
            />
          )}
        </div>
      </div>
    </>
  );

  if (onTap) {
    return (
      <button
        onClick={onTap}
        aria-label={`Filter Explore by ${sector} — ${buys} buys, ${sells} sells in ${windowCopy}`}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '6px 0',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          transition: 'background 0.12s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#FAFAF7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {rowContent}
      </button>
    );
  }

  return <div style={{ padding: '6px 0' }}>{rowContent}</div>;
}

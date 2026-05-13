// 1AM-163: Disclosure Timeline — flagship visual component for TradeDetailDrawer.
// Three discrete price datapoints (trade-date · filing-date · today) with
// proportional time-spacing — NOT equidistant. The time-asymmetry IS the feature:
// it shows the STOCK Act filing-window vs the time since filing.
//
// Bloomberg-restrained styling: navy + gray on transparent, monospace labels,
// dotted connecting line (1px 30% opacity, dasharray "2 3") — locked-in after
// 12-cell Lovable neutrality-test (3 line-variants × 4 price-trajectories).
//
// Design rationale captured in Linear 1AM-163. Key constraints:
//   - NOT a chart: no Y-axis, no gridlines, no fill-area, no percentages
//   - NOT directional: color stays navy regardless of buy/sell or up/down
//   - NOT interactive: static SVG only, no hover/tooltip/animation
//   - Edge cases: label-collision (30px min-gap) + same-day spacing (5px floor)
//
// Component is data-agnostic — takes 6 props, returns SVG. Data is supplied by
// useDisclosurePrices hook (currently mock-data; future swap-point for real
// FMP/Quiver historical-price + latest-quote integration when 1AM-174 lands).
//
// USAGE:
//   <DisclosureTimeline
//     tradeDate="2026-03-28"
//     tradePrice={452.10}
//     filedDate="2026-04-06"
//     filedPrice={461.50}
//     todayPrice={468.20}
//     todayTimestamp="as of 14:32 ET"
//   />

const MONO = `ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
const FG = '#0D1B2A';
const MUTED = '#9CA3AF';
const TIMESTAMP = '#6B7280';

/**
 * @typedef {Object} DisclosureTimelineProps
 * @property {string} tradeDate - ISO date "YYYY-MM-DD"
 * @property {number} tradePrice - Closing price on tradeDate
 * @property {string} filedDate - ISO date "YYYY-MM-DD"
 * @property {number} filedPrice - Closing price on filedDate
 * @property {number} todayPrice - Current/intraday price
 * @property {string} todayTimestamp - Display string e.g. "as of 14:32 ET" or "as of Mon 09:30 ET (market closed)"
 */

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function daysBetween(a, b) {
  const ms =
    new Date(b + 'T00:00:00Z').getTime() -
    new Date(a + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

/**
 * @param {DisclosureTimelineProps} props
 */
export default function DisclosureTimeline({
  tradeDate,
  tradePrice,
  filedDate,
  filedPrice,
  todayPrice,
  todayTimestamp,
}) {
  const todayDate = new Date().toISOString().slice(0, 10);

  const t0 = 0;
  const t1Raw = daysBetween(tradeDate, filedDate);
  const t2Raw = Math.max(t1Raw + 1, daysBetween(tradeDate, todayDate));

  const W = 320;
  const H = 120;
  const padL = 30;
  const padR = 30;
  const innerW = W - padL - padR;
  const projX = (t) => padL + (t / t2Raw) * innerW;

  // 1AM-163 edge case handling:
  // - 30px minimum gap between adjacent datapoints (prevents label collision)
  // - 5px hard-floor when adjacent dates are within 2 days (same-day-ish case
  //   per ticket spec — fast filings or filed-yesterday-or-today scenarios)
  let x0 = projX(t0);
  let x1 = projX(t1Raw);
  let x2 = projX(t2Raw);

  const minGap = 30;
  const nearSameDayFloor = 5;
  const tradeFiledClose = t1Raw - t0 < 2;
  const filedTodayClose = t2Raw - t1Raw < 2;

  const gap01 = tradeFiledClose ? nearSameDayFloor : minGap;
  if (x1 - x0 < gap01) x1 = x0 + gap01;
  const gap12 = filedTodayClose ? nearSameDayFloor : minGap;
  if (x2 - x1 < gap12) x2 = x1 + gap12;

  const maxX = W - padR;
  if (x2 > maxX) {
    const shift = x2 - maxX;
    x2 = maxX;
    x1 = Math.max(x0 + gap01, x1 - shift);
  }

  // Stack filed/today labels vertically when crammed (prevents text overlap
  // when filing-date and today are within 2 days of each other).
  const stackFiledTodayLabels = filedTodayClose && x2 - x1 <= minGap;
  const dateY1 = 15;
  const dateY2 = stackFiledTodayLabels ? 30 : 15;
  const priceY1 = 100;
  const priceY2 = stackFiledTodayLabels ? 88 : 100;

  const yMid = 60;

  const points = [
    { x: x0, date: fmtDate(tradeDate), price: tradePrice, dateY: dateY1, priceY: priceY1 },
    { x: x1, date: fmtDate(filedDate), price: filedPrice, dateY: dateY1, priceY: priceY1 },
    { x: x2, date: 'Today',            price: todayPrice, dateY: dateY2, priceY: priceY2 },
  ];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Disclosure timeline showing three price points across the filing window"
      style={{ display: 'block' }}
    >
      {/* Variant B — dotted connecting line, locked-in after Lovable neutrality test.
          1px stroke at 30% opacity with dasharray "2 3" — quiet enough to avoid
          trend-suggestion in V-shape / Inverted-V scenarios, present enough to
          establish timeline-affordance (component would otherwise read as three
          unrelated floating points). */}
      <line
        x1={x0}
        x2={x2}
        y1={yMid}
        y2={yMid}
        stroke={MUTED}
        strokeWidth={1}
        opacity={0.3}
        strokeDasharray="2 3"
      />

      {points.map((p, i) => (
        <circle key={`c-${i}`} cx={p.x} cy={yMid} r={4} fill={FG} />
      ))}

      {points.map((p, i) => (
        <text
          key={`d-${i}`}
          x={p.x}
          y={p.dateY}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={12}
          fill={FG}
          dominantBaseline="hanging"
        >
          {p.date}
        </text>
      ))}

      {points.map((p, i) => (
        <text
          key={`p-${i}`}
          x={p.x}
          y={p.priceY}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={12}
          fill={FG}
        >
          ${Math.round(p.price)}
        </text>
      ))}

      <text
        x={x2}
        y={(stackFiledTodayLabels ? priceY2 : 100) + 14}
        textAnchor="middle"
        fontFamily={MONO}
        fontSize={11}
        fill={TIMESTAMP}
      >
        {todayTimestamp}
      </text>
    </svg>
  );
}

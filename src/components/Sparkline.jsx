// SAA-6: Sparkline Component
// SVG sparkline showing politician performance vs S&P 500
// Used in PoliticianCard and Full Profile screen
// Props: data, snp, color, width, height

export default function Sparkline({
  data = [],
  snp = [],
  color = '#059669',
  width = 80,
  height = 36,
}) {
  if (!data.length || !snp.length) return null;

  const allVals = [...data, ...snp];
  const min = Math.min(...allVals) - 2;
  const max = Math.max(...allVals) + 2;
  const range = max - min;

  // Convert data array to SVG polyline points string
  const toPoints = (arr) =>
    arr
      .map(
        (v, i) =>
          `${(i / (arr.length - 1)) * width},${
            height - ((v - min) / range) * height
          }`
      )
      .join(' ');

  // End dot position
  const lastX = width;
  const lastY = height - ((data[data.length - 1] - min) / range) * height;

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      {/* S&P 500 dashed comparison line */}
      <polyline
        points={toPoints(snp)}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={1.5}
        strokeDasharray="3,2"
        strokeLinecap="round"
      />

      {/* Politician performance line */}
      <polyline
        points={toPoints(data)}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      <circle
        cx={lastX}
        cy={lastY}
        r={3}
        fill={color}
      />
    </svg>
  );
}

// ── Usage examples ────────────────────────────────────────────────────────────
// Performance data — 12 monthly data points
// const perfData = [82, 88, 79, 95, 102, 98, 115, 121, 118, 130, 128, 134];
// const snpData  = [82, 85, 83, 88, 91,  90,  97, 100,  98, 103, 102, 100];
//
// Small inline sparkline (used in PoliticianCard):
// <Sparkline data={perfData} snp={snpData} color="#059669" width={64} height={28} />
//
// Larger sparkline (used in Full Profile):
// <Sparkline data={perfData} snp={snpData} color="#059669" width={300} height={56} />
//
// Negative performance (red):
// <Sparkline data={perfData} snp={snpData} color="#DC2626" width={64} height={28} />

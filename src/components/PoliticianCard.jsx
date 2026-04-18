// SAA-5: PoliticianCard Component
// Card shown in the Politicians Directory
// Shows politician stats, committee badges and inline sparkline
// Props: politician, onClick

import Avatar from './Avatar';
import { CommitteeBadge, PartyBadge } from './Badge';

// ─── Inline Sparkline ─────────────────────────────────────────────────────────
// Small SVG chart showing politician performance vs S&P 500
function Sparkline({ data = [], snp = [], color = '#059669', width = 72, height = 32 }) {
  if (!data.length || !snp.length) return null;

  const allVals = [...data, ...snp];
  const min = Math.min(...allVals) - 2;
  const max = Math.max(...allVals) + 2;
  const range = max - min;

  const toPoints = (arr) =>
    arr
      .map((v, i) => `${(i / (arr.length - 1)) * width},${height - ((v - min) / range) * height}`)
      .join(' ');

  const lastX = width;
  const lastY = height - ((data[data.length - 1] - min) / range) * height;

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {/* S&P 500 dashed line */}
      <polyline
        points={toPoints(snp)}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={1.5}
        strokeDasharray="3,2"
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
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}

// ─── PoliticianCard ───────────────────────────────────────────────────────────
export default function PoliticianCard({ politician, onClick }) {
  const {
    name,
    initials,
    party,
    chamber,
    state,
    trades,
    volume,
    vsSnP,
    positive,
    committees = [],
    perfData = [],
    snpData = [],
    lastTrade,
  } = politician;

  const perfColor = positive ? '#059669' : '#DC2626';

  return (
    <div
      onClick={() => onClick?.(politician)}
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E5E7EB',
        padding: '16px',
        marginBottom: '10px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(13, 27, 42, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* ── Top row: avatar + name + sparkline ── */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        {/* Avatar */}
        <Avatar initials={initials} party={party} size="md" />

        {/* Name + party + committees */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: '15px',
              color: '#0D1B2A',
              marginBottom: '3px',
              fontFamily: "'DM Sans', sans-serif",
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#6B7280',
              marginBottom: '6px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <span
              style={{
                color: party === 'D' ? '#1D4ED8' : '#DC2626',
                fontWeight: 700,
              }}
            >
              {party}
            </span>
            {' · '}
            {chamber}
            {' · '}
            {state}
          </div>

          {/* Committee badges */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {committees.slice(0, 2).map((c) => (
              <CommitteeBadge key={c} name={c} small />
            ))}
          </div>
        </div>

        {/* Sparkline + performance */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <Sparkline
            data={perfData}
            snp={snpData}
            color={perfColor}
            width={64}
            height={28}
          />
          <div
            style={{
              fontSize: '13px',
              fontWeight: 800,
              color: perfColor,
              marginTop: '4px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {vsSnP}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#9CA3AF',
              fontFamily: 'monospace',
            }}
          >
            vs S&P
          </div>
        </div>
      </div>

      {/* ── Bottom row: stats ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: '1px solid #F3F4F6',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#0D1B2A',
              fontFamily: "'Playfair Display', serif",
            }}
          >
            {trades}
          </div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>
            Trades
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#0D1B2A',
              fontFamily: "'Playfair Display', serif",
            }}
          >
            {volume}
          </div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>
            Volume
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6B7280',
              fontFamily: 'monospace',
            }}
          >
            {lastTrade}
          </div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>
            Last trade
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Usage example ─────────────────────────────────────────────────────────────
// const politician = {
//   id: 1,
//   name: 'Nancy Pelosi',
//   initials: 'NP',
//   party: 'D',
//   chamber: 'House',
//   state: 'CA',
//   trades: 47,
//   volume: '$62.9M',
//   vsSnP: '+34%',
//   positive: true,
//   committees: ['Armed Services', 'Intelligence'],
//   perfData: [82, 88, 79, 95, 102, 98, 115, 121, 118, 130, 128, 134],
//   snpData:  [82, 85, 83, 88, 91,  90,  97, 100,  98, 103, 102, 100],
//   lastTrade: 'Apr 10',
// };
//
// <PoliticianCard
//   politician={politician}
//   onClick={(p) => navigate(`/politicians/${p.id}`)}
// />

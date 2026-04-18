// SAA-7: BottomSheet Component
// Slide-up overlay for Quick Preview of a politician
// Triggered by tapping a PoliticianCard in the directory
// Props: politician, isOpen, onClose, onFollow, onSetAlert, onViewProfile

import Avatar from './Avatar';
import { CommitteeBadge } from './Badge';
import Sparkline from './Sparkline';

export default function BottomSheet({
  politician,
  isOpen,
  onClose,
  onFollow,
  onSetAlert,
  onViewProfile,
}) {
  if (!isOpen || !politician) return null;

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
    recentTrades = [],
  } = politician;

  const perfColor = positive ? '#059669' : '#DC2626';

  // Check for conflict of interest committees
  const hasConflict =
    committees.some((c) =>
      ['Armed Services', 'Intelligence', 'Financial Services', 'Finance'].includes(c)
    ) && recentTrades.some((t) => t.action === 'Purchase');

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(13, 27, 42, 0.45)',
          zIndex: 40,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* ── Sheet ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FFFFFF',
          borderRadius: '24px 24px 0 0',
          zIndex: 50,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 -8px 32px rgba(13, 27, 42, 0.15)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 0',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: '2px',
              background: '#E5E7EB',
            }}
          />
        </div>

        {/* Content */}
        <div style={{ padding: '16px 22px 32px' }}>

          {/* ── Header: avatar + name + badges ── */}
          <div
            style={{
              display: 'flex',
              gap: '14px',
              alignItems: 'center',
              marginBottom: '14px',
            }}
          >
            <Avatar initials={initials} party={party} size="lg" />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: '18px',
                  color: '#0D1B2A',
                  fontFamily: "'Playfair Display', serif",
                  marginBottom: '3px',
                }}
              >
                {name}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#6B7280',
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
              <div
                style={{
                  display: 'flex',
                  gap: '5px',
                  flexWrap: 'wrap',
                  marginTop: '6px',
                }}
              >
                {committees.map((c) => (
                  <CommitteeBadge key={c} name={c} small />
                ))}
              </div>
            </div>
          </div>

          {/* ── Conflict of interest warning ── */}
          {hasConflict && (
            <div
              style={{
                padding: '10px 14px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: '#DC2626',
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                ⚠ Committee member — recent purchases in related sector
              </div>
            </div>
          )}

          {/* ── Stats row ── */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            {[[trades, 'Trades'], [volume, 'Volume'], [vsSnP, 'vs S&P']].map(
              ([val, label]) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    background: '#FAFAF7',
                    borderRadius: '10px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color:
                        label === 'vs S&P'
                          ? perfColor
                          : '#0D1B2A',
                      fontFamily: "'Playfair Display', serif",
                    }}
                  >
                    {val}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#9CA3AF',
                      fontFamily: 'monospace',
                      marginTop: '2px',
                    }}
                  >
                    {label}
                  </div>
                </div>
              )
            )}
          </div>

          {/* ── Performance chart ── */}
          {perfData.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#9CA3AF',
                  fontFamily: 'monospace',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                }}
              >
                12-MONTH PERFORMANCE
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#FAFAF7',
                  borderRadius: '12px',
                }}
              >
                <Sparkline
                  data={perfData}
                  snp={snpData}
                  color={perfColor}
                  width={280}
                  height={48}
                />
                <div
                  style={{
                    display: 'flex',
                    gap: '14px',
                    marginTop: '8px',
                    fontSize: '11px',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <span style={{ color: perfColor, fontWeight: 700 }}>
                    — {name.split(' ').pop()} ({vsSnP})
                  </span>
                  <span style={{ color: '#9CA3AF' }}>--- S&P 500</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Latest trade ── */}
          {recentTrades.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#9CA3AF',
                  fontFamily: 'monospace',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                }}
              >
                LATEST TRADE
              </div>
              {recentTrades.slice(0, 1).map((t) => {
                const isBuy = t.action === 'Purchase';
                return (
                  <div
                    key={t.ticker + t.date}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '13px 14px',
                      background: '#FAFAF7',
                      borderRadius: '12px',
                      borderLeft: `3px solid ${isBuy ? '#059669' : '#DC2626'}`,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '17px',
                          color: '#0D1B2A',
                          fontFamily: "'Playfair Display', serif",
                        }}
                      >
                        {t.ticker}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#9CA3AF',
                          marginTop: '2px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {t.date}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isBuy ? '#059669' : '#DC2626',
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        {isBuy ? '▲ BUY' : '▼ SELL'}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#9CA3AF',
                          marginTop: '2px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {t.amount}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onViewProfile?.(politician)}
              style={{
                flex: 2,
                padding: '13px',
                background: '#0D1B2A',
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.target.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.target.style.opacity = '1')}
            >
              View Full Profile →
            </button>
            <button
              onClick={() => onSetAlert?.(politician)}
              style={{
                flex: 1,
                padding: '13px',
                background: '#FAFAF7',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                color: '#0D1B2A',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.target.style.background = '#F3F4F6')}
              onMouseLeave={(e) => (e.target.style.background = '#FAFAF7')}
            >
              🔔 Alert
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Usage example ─────────────────────────────────────────────────────────────
// const [selectedPolitician, setSelectedPolitician] = useState(null);
//
// <PoliticianCard
//   politician={politician}
//   onClick={(p) => setSelectedPolitician(p)}
// />
//
// <BottomSheet
//   politician={selectedPolitician}
//   isOpen={!!selectedPolitician}
//   onClose={() => setSelectedPolitician(null)}
//   onFollow={(p) => console.log('follow', p)}
//   onSetAlert={(p) => console.log('alert', p)}
//   onViewProfile={(p) => navigate(`/politicians/${p.id}`)}
// />

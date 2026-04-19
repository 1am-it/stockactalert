// SAA-12: FeedScreen component
// Renders the live congressional trade feed.
// Uses useTrades() hook → renders TradeCard list.
// Handles loading, error, and empty states.
//
// This is the first screen where users see *real* congressional trades,
// fetched live from /api/trades (which proxies FMP STOCK Act data).

import TradeCard from './TradeCard';
import { useTrades } from '../hooks/useTrades';

export default function FeedScreen() {
  const { trades, loading, error, refetch } = useTrades();

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          padding: '40px 0',
          textAlign: 'center',
          color: '#9CA3AF',
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Loading trades…
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 16,
          color: '#B91C1C',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
          Couldn't load trades
        </div>
        <div style={{ fontSize: 12, color: '#991B1B', marginBottom: 16 }}>
          {error}
        </div>
        <button
          onClick={refetch}
          style={{
            padding: '8px 20px',
            background: '#0D1B2A',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!trades.length) {
    return (
      <div
        style={{
          padding: '40px 16px',
          textAlign: 'center',
          color: '#6B7280',
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        No trades to show right now.
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          padding: '0 2px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: '#9CA3AF',
            fontFamily: 'monospace',
            letterSpacing: '0.06em',
          }}
        >
          {trades.length} RECENT TRADES
        </div>
        <button
          onClick={refetch}
          style={{
            padding: '4px 10px',
            background: 'transparent',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            color: '#6B7280',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {trades.map((trade) => (
        <TradeCard
          key={trade.id}
          trade={trade}
          onSetAlert={(t) => console.log('alert', t)}
          onViewProfile={(t) => console.log('profile', t)}
          onViewTicker={(t) => console.log('ticker', t)}
        />
      ))}
    </div>
  );
}

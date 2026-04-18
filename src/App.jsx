// TIJDELIJK TESTBESTAND — wordt later vervangen
// Test voor SAA-4: TradeCard component

import TradeCard from './components/TradeCard';

const MOCK_TRADES = [
  {
    id: 1,
    source: 'capitoltrades',
    politician: 'Nancy Pelosi',
    party: 'D',
    chamber: 'House',
    ticker: 'NVDA',
    action: 'Purchase',
    amount: '$500K–$1M',
    tradeDate: '2026-04-10',
    filedDate: '2026-04-15',
  },
  {
    id: 2,
    source: 'unusualwhales',
    politician: 'Tommy Tuberville',
    party: 'R',
    chamber: 'Senate',
    ticker: 'LMT',
    action: 'Sale',
    amount: '$100K–$250K',
    tradeDate: '2026-04-07',
    filedDate: '2026-04-14',
  },
  {
    id: 3,
    source: 'quiver',
    politician: 'Josh Gottheimer',
    party: 'D',
    chamber: 'House',
    ticker: 'AAPL',
    action: 'Purchase',
    amount: '$50K–$100K',
    tradeDate: '2026-04-08',
    filedDate: '2026-04-12',
  },
];

function App() {
  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 24, fontSize: 28 }}>StockActAlert</h1>
      {MOCK_TRADES.map((trade) => (
        <TradeCard
          key={trade.id}
          trade={trade}
          onSetAlert={(t) => alert(`Alert ingesteld voor ${t.politician}`)}
          onViewProfile={(t) => alert(`Profiel van ${t.politician}`)}
          onViewTicker={(t) => alert(`Ticker: ${t.ticker}`)}
          highlighted={trade.id === 1}
        />
      ))}
    </div>
  );
}

export default App;

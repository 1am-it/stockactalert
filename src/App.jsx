// TIJDELIJK TESTBESTAND — wordt later vervangen
// Test voor SAA-7: BottomSheet component

import { useState } from 'react';
import PoliticianCard from './components/PoliticianCard';
import BottomSheet from './components/BottomSheet';

const MOCK_POLITICIANS = [
  {
    id: 1,
    name: 'Nancy Pelosi',
    initials: 'NP',
    party: 'D',
    chamber: 'House',
    state: 'CA',
    trades: 47,
    volume: '$62.9M',
    vsSnP: '+34%',
    positive: true,
    committees: ['Armed Services', 'Intelligence'],
    perfData: [82, 88, 79, 95, 102, 98, 115, 121, 118, 130, 128, 134],
    snpData:  [82, 85, 83, 88, 91,  90,  97, 100,  98, 103, 102, 100],
    lastTrade: 'Apr 10',
    recentTrades: [
      { ticker: 'NVDA', action: 'Purchase', amount: '$500K–$1M', date: 'Apr 10' },
    ],
  },
  {
    id: 2,
    name: 'Tommy Tuberville',
    initials: 'TT',
    party: 'R',
    chamber: 'Senate',
    state: 'AL',
    trades: 132,
    volume: '$38.4M',
    vsSnP: '+18%',
    positive: true,
    committees: ['Armed Services', 'Agriculture'],
    perfData: [82, 86, 84, 90, 94, 93, 98, 101, 99, 104, 103, 100],
    snpData:  [82, 85, 83, 88, 91, 90, 97, 100, 98, 103, 102, 100],
    lastTrade: 'Apr 7',
    recentTrades: [
      { ticker: 'LMT', action: 'Purchase', amount: '$100K–$250K', date: 'Apr 7' },
    ],
  },
];

function App() {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 8, fontSize: 28 }}>Politicians</h1>
      <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24 }}>
        Tap a card to open the bottom sheet
      </p>
      {MOCK_POLITICIANS.map((politician) => (
        <PoliticianCard
          key={politician.id}
          politician={politician}
          onClick={(p) => setSelected(p)}
        />
      ))}
      <BottomSheet
        politician={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        onFollow={(p) => alert(`Following ${p.name}`)}
        onSetAlert={(p) => alert(`Alert set for ${p.name}`)}
        onViewProfile={(p) => alert(`Navigate to profile of ${p.name}`)}
      />
    </div>
  );
}

export default App;

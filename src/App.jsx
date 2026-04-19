// SAA-12: App entry — renders FeedScreen in the "feed" tab
// Other tabs (politicians, alerts, settings) remain placeholder for now;
// they get their own screens in later tickets.

import { useState } from 'react';
import TabBar from './components/TabBar';
import FeedScreen from './components/FeedScreen';

function App() {
  const [activeTab, setActiveTab] = useState('feed');

  const screens = {
    feed: {
      title: 'Your Feed',
      description: 'Live congressional trades — filed under the STOCK Act',
      color: '#059669',
    },
    politicians: {
      title: 'Politicians',
      description: 'Directory of all tracked politicians',
      color: '#1D4ED8',
    },
    alerts: {
      title: 'Alerts',
      description: 'Your active alerts — get notified on new trades',
      color: '#D97706',
    },
    settings: {
      title: 'Settings',
      description: 'App settings and preferences',
      color: '#6B7280',
    },
  };

  const current = screens[activeTab];

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
      {/* Page content */}
      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '40px 24px 100px',
        }}
      >
        <h1
          style={{
            fontSize: 32,
            marginBottom: 8,
            color: '#0D1B2A',
          }}
        >
          {current.title}
        </h1>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 32 }}>
          {current.description}
        </p>

        {/* ── Active tab content ── */}
        {activeTab === 'feed' ? (
          <FeedScreen />
        ) : (
          // Placeholder for tabs not yet implemented
          <div
            style={{
              padding: '20px',
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E5E7EB',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: `${current.color}18`,
                border: `2px solid ${current.color}30`,
                margin: '0 auto 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              {activeTab === 'politicians' && '👤'}
              {activeTab === 'alerts' && '🔔'}
              {activeTab === 'settings' && '⚙️'}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#0D1B2A',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {current.title} — coming soon
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
              This screen is built in a later ticket
            </div>
          </div>
        )}
      </div>

      {/* TabBar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;

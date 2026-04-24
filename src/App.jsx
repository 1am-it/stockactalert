// SAA-15 + SAA-16: App entry — 3-step onboarding + feed filter by followed
// Steps: 'welcome' → 'explainer' → 'pick-politicians' → 'done' (main app)
// followedPoliticians is now wired through to FeedScreen for client-side filtering.
//
// State is in-memory only: refresh resets the flow. localStorage
// persistence is a separate ticket.

import { useState } from 'react';
import TabBar from './components/TabBar';
import FeedScreen from './components/FeedScreen';
import OnboardingWelcome from './components/OnboardingWelcome';
import OnboardingDataExplainer from './components/OnboardingDataExplainer';
import OnboardingPickPoliticians from './components/OnboardingPickPoliticians';

function App() {
  // Onboarding step machine
  const [onboardingStep, setOnboardingStep] = useState('welcome');
  // Selected politicians during onboarding — drives feed filter in SAA-16
  const [followedPoliticians, setFollowedPoliticians] = useState([]);
  const [activeTab, setActiveTab] = useState('feed');

  const togglePolitician = (name) => {
    setFollowedPoliticians((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // ── Onboarding flow ─────────────────────────────────────────────────────────
  if (onboardingStep === 'welcome') {
    return (
      <OnboardingWelcome
        onNext={() => setOnboardingStep('explainer')}
      />
    );
  }

  if (onboardingStep === 'explainer') {
    return (
      <OnboardingDataExplainer
        onNext={() => setOnboardingStep('pick-politicians')}
        onBack={() => setOnboardingStep('welcome')}
      />
    );
  }

  if (onboardingStep === 'pick-politicians') {
    return (
      <OnboardingPickPoliticians
        selected={followedPoliticians}
        onToggle={togglePolitician}
        onNext={() => setOnboardingStep('done')}
        onBack={() => setOnboardingStep('explainer')}
      />
    );
  }

  // ── Main app (onboardingStep === 'done') ───────────────────────────────────
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
          <FeedScreen followedPoliticians={followedPoliticians} />
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

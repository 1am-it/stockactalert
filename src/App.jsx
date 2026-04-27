// SAA-15 + SAA-16 + SAA-18 + 1AM-24: App entry
// Steps: 'welcome' → 'explainer' → 'pick-politicians' → 'done' (main app)
//
// 1AM-24: Politicians tab is now functional — same grid as onboarding,
// minus the Back/Continue chrome. State is shared with the feed via
// `followedPoliticians`, so tapping a card in Politicians-tab live-updates
// the feed filter.
//
// 1AM-60: activeTab is now persisted to localStorage so users return to
// the tab they last visited instead of always landing on 'feed'.
// Same lazy-init + useEffect pattern as the other persisted state above.

import { useEffect, useState } from 'react';
import TabBar from './components/TabBar';
import FeedScreen from './components/FeedScreen';
import PoliticiansScreen from './components/PoliticiansScreen';
import OnboardingWelcome from './components/OnboardingWelcome';
import OnboardingDataExplainer from './components/OnboardingDataExplainer';
import OnboardingPickPoliticians from './components/OnboardingPickPoliticians';
import { getJSON, setJSON, STORAGE_KEYS } from './lib/storage';

// 1AM-67/1AM-68: Legacy name migration
// When the curated-22 list was replaced by the full Congress directory, two
// curated names didn't match the new Member.name format (firstName + lastName):
//   - "Bernie Sanders" — directory uses legal name "Bernard Sanders"
//   - "Shelley Moore Capito" — directory drops middle name → "Shelley Capito"
// Existing users following these via localStorage need their stored names
// remapped on hydration, otherwise the new picker shows them as not-followed.
//
// The migration is idempotent (passing already-migrated names through as-is)
// and runs once at hydration. Persisted to localStorage by the existing
// useEffect that watches followedPoliticians.
const FOLLOWED_NAME_ALIASES = {
  'Bernie Sanders': 'Bernard Sanders',
  'Shelley Moore Capito': 'Shelley Capito',
};

function migrateFollowedNames(names) {
  return names.map((n) => FOLLOWED_NAME_ALIASES[n] || n);
}

function App() {
  // Hydrate initial state from localStorage. Lazy initial state so we only
  // touch storage once on mount.
  const [onboardingStep, setOnboardingStep] = useState(() =>
    getJSON(STORAGE_KEYS.ONBOARDING_DONE, false) ? 'done' : 'welcome'
  );
  const [followedPoliticians, setFollowedPoliticians] = useState(() =>
    migrateFollowedNames(getJSON(STORAGE_KEYS.FOLLOWED_POLITICIANS, []))
  );
  // Whitelist of valid tab IDs — guards against stale or corrupted localStorage
  // values (e.g. after a tab is renamed or removed in a future version).
  const VALID_TABS = ['feed', 'politicians', 'alerts', 'settings'];
  const [activeTab, setActiveTab] = useState(() => {
    const saved = getJSON(STORAGE_KEYS.ACTIVE_TAB, 'feed');
    return VALID_TABS.includes(saved) ? saved : 'feed';
  });

  // Persist onboarding completion whenever step transitions to/from 'done'
  useEffect(() => {
    setJSON(STORAGE_KEYS.ONBOARDING_DONE, onboardingStep === 'done');
  }, [onboardingStep]);

  // Persist followed politicians on every change
  useEffect(() => {
    setJSON(STORAGE_KEYS.FOLLOWED_POLITICIANS, followedPoliticians);
  }, [followedPoliticians]);

  // 1AM-60: Persist active tab on every change so reopening the app lands
  // on the same tab the user last visited.
  useEffect(() => {
    setJSON(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

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
      description: 'Tap to follow or unfollow — see trades in your Feed',
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
        {activeTab === 'feed' && (
          <FeedScreen
            followedPoliticians={followedPoliticians}
            onUnfollow={togglePolitician}
            onNavigateToPoliticians={() => setActiveTab('politicians')}
          />
        )}

        {activeTab === 'politicians' && (
          <PoliticiansScreen
            selected={followedPoliticians}
            onToggle={togglePolitician}
          />
        )}

        {(activeTab === 'alerts' || activeTab === 'settings') && (
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

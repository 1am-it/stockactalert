// SAA-15 + SAA-16 + SAA-18 + 1AM-24: App entry
// Steps: 'discovery' → 'pick-politicians' → 'done' (main app)
// 1AM-66 v0.13.1: Welcome + Explainer removed (replaced by Discovery feed).
//
// 1AM-24: Politicians tab is now functional — same grid as onboarding,
// minus the Back/Continue chrome. State is shared with the feed via
// `followedPoliticians`, so tapping a card in Politicians-tab live-updates
// the feed filter.
//
// 1AM-60: activeTab is now persisted to localStorage so users return to
// the tab they last visited instead of always landing on 'feed'.
// Same lazy-init + useEffect pattern as the other persisted state above.
//
// 1AM-69: PoliticianDetailScreen renders as a full-screen overlay when
// `detailPolitician` is non-null. No router — state-overlay pattern keeps
// the architecture minimal. Mute state lives here too (mutedPoliticians)
// so the toggle persists across renders even though no alert system reads
// it yet (1AM-71 wires that part).

import { useEffect, useState } from 'react';
import TabBar from './components/TabBar';
import FeedScreen from './components/FeedScreen';
import DiscoveryFeedScreen from './components/DiscoveryFeedScreen';
import BrowseAllFilingsScreen from './components/BrowseAllFilingsScreen';
import PoliticiansScreen from './components/PoliticiansScreen';
import PoliticianDetailScreen from './components/PoliticianDetailScreen';
// 1AM-66 v0.13.1: Welcome + Explainer screens removed; Discovery makes them
// redundant. Steps simplified to 'discovery' → 'pick-politicians' → 'done'.
// Migration of explainer content tracked in 1AM-110.
import OnboardingPickPoliticians from './components/OnboardingPickPoliticians';
import { getJSON, setJSON, STORAGE_KEYS } from './lib/storage';
import { useTrades } from './hooks/useTrades';

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
  // 1AM-66: First-time visitors land on Discovery feed (anonymous landing) —
  // not on Welcome onboarding screen. The CTA in DiscoveryFeedScreen advances
  // to 'welcome' which then walks the original onboarding chain.
  const [onboardingStep, setOnboardingStep] = useState(() =>
    getJSON(STORAGE_KEYS.ONBOARDING_DONE, false) ? 'done' : 'discovery'
  );
  const [followedPoliticians, setFollowedPoliticians] = useState(() =>
    migrateFollowedNames(getJSON(STORAGE_KEYS.FOLLOWED_POLITICIANS, []))
  );
  // 1AM-69: muted-alerts preference, persisted but currently no-op for actual
  // delivery (alert system wired later in 1AM-71). Same migration aliases as
  // followedPoliticians so legacy stored names map to current directory.
  const [mutedPoliticians, setMutedPoliticians] = useState(() =>
    migrateFollowedNames(getJSON(STORAGE_KEYS.MUTED_POLITICIANS, []))
  );
  // Whitelist of valid tab IDs — guards against stale or corrupted localStorage
  // values (e.g. after a tab is renamed or removed in a future version).
  const VALID_TABS = ['feed', 'politicians', 'alerts', 'settings'];
  const [activeTab, setActiveTab] = useState(() => {
    const saved = getJSON(STORAGE_KEYS.ACTIVE_TAB, 'feed');
    return VALID_TABS.includes(saved) ? saved : 'feed';
  });
  // 1AM-69: detail-page overlay. null = no overlay; otherwise the politician
  // name being viewed. Not persisted — feels right that returning to the app
  // lands on the last tab, not on a stale detail page.
  const [detailPolitician, setDetailPolitician] = useState(null);
  // 1AM-112: Browse All Filings overlay state. When true, render the
  // dedicated browse screen with no TabBar (overlay pattern, similar to
  // detailPolitician). Reached from FeedScreen `Show all` button or from
  // the FilterEmptyState recovery CTA.
  const [isBrowsingAll, setIsBrowsingAll] = useState(false);

  // 1AM-69: trades shared between FeedScreen and PoliticianDetailScreen.
  // Lifted to App level so the detail page can compute stats/holdings/history
  // from the same dataset the feed uses, without re-fetching FMP.
  // FeedScreen still calls useTrades() too — that's fine; the hook's outer
  // request is cached at CDN level (s-maxage=3600), so a second render
  // shouldn't add real load.
  const { trades } = useTrades();

  // Persist onboarding completion whenever step transitions to/from 'done'
  useEffect(() => {
    setJSON(STORAGE_KEYS.ONBOARDING_DONE, onboardingStep === 'done');
  }, [onboardingStep]);

  // Persist followed politicians on every change
  useEffect(() => {
    setJSON(STORAGE_KEYS.FOLLOWED_POLITICIANS, followedPoliticians);
  }, [followedPoliticians]);

  // 1AM-69: Persist muted politicians on every change
  useEffect(() => {
    setJSON(STORAGE_KEYS.MUTED_POLITICIANS, mutedPoliticians);
  }, [mutedPoliticians]);

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

  // 1AM-69
  const toggleMute = (name) => {
    setMutedPoliticians((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // ── Onboarding flow ─────────────────────────────────────────────────────────
  // 1AM-66 v0.13.1: Discovery → Pick directly. Welcome + Explainer were
  // removed because Discovery already shows real STOCK Act filings, making
  // the generic "See what Congress trades" pitch and the data-conventions
  // explainer redundant friction. Migrated explainer content lives in 1AM-110.
  if (onboardingStep === 'discovery') {
    return (
      <DiscoveryFeedScreen
        onStartOnboarding={() => setOnboardingStep('pick-politicians')}
      />
    );
  }

  if (onboardingStep === 'pick-politicians') {
    return (
      <OnboardingPickPoliticians
        selected={followedPoliticians}
        onToggle={togglePolitician}
        onNext={() => setOnboardingStep('done')}
        onBack={() => setOnboardingStep('discovery')}
      />
    );
  }

  // ── Browse All Filings overlay (1AM-112) ─────────────────────────────────
  // Full-screen overlay reached from the Personal feed `Show all` button or
  // from the FilterEmptyState recovery CTA. Replaces the previous in-place
  // toggle on FeedScreen — that behaviour is deprecated.
  // No TabBar while browsing — page-style header has its own ← Back link.
  if (isBrowsingAll) {
    return (
      <BrowseAllFilingsScreen
        onBack={() => setIsBrowsingAll(false)}
      />
    );
  }

  // ── Detail-page overlay (1AM-69) ───────────────────────────────────────────
  // When a politician name is clicked anywhere, we render the detail screen
  // instead of the active tab. TabBar still visible underneath because users
  // expect bottom-nav to remain available. "← Back" cleans the state.
  if (detailPolitician) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
        <PoliticianDetailScreen
          politicianName={detailPolitician}
          trades={trades}
          isFollowing={followedPoliticians.includes(detailPolitician)}
          isMuted={mutedPoliticians.includes(detailPolitician)}
          onToggleFollow={() => togglePolitician(detailPolitician)}
          onToggleMute={() => toggleMute(detailPolitician)}
          onBack={() => setDetailPolitician(null)}
        />
        <TabBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            // Tab-tap closes the detail overlay AND switches tabs
            setDetailPolitician(null);
            setActiveTab(tab);
          }}
        />
      </div>
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
            onShowPoliticianDetail={setDetailPolitician}
            onBrowseAll={() => setIsBrowsingAll(true)}
          />
        )}

        {activeTab === 'politicians' && (
          <PoliticiansScreen
            selected={followedPoliticians}
            onToggle={togglePolitician}
            onShowDetail={setDetailPolitician}
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

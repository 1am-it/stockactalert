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
//
// 1AM-124: IA redesign — 4 tabs reduced to 3 (Feed / Browse / Alerts).
// - Politicians-tab removed; functionality moved to Browse-tab Most Active
//   section + Feed-tab follows.
// - Settings-tab removed from bottom-nav; reachable via gear icon top-right
//   of each screen header (rendered inside each tab component).
// - Browse-tab promoted from `isBrowsingAll` overlay to full top-level tab.
// - Stale localStorage activeTab values ('politicians', 'settings') fall
//   through to 'feed' via VALID_TABS whitelist.

import { useEffect, useState } from 'react';
import TabBar from './components/TabBar';
import FeedScreen from './components/FeedScreen';
import DiscoveryFeedScreen from './components/DiscoveryFeedScreen';
import BrowseAllFilingsScreen from './components/BrowseAllFilingsScreen';
// 1AM-124: PoliticiansScreen import removed — Politicians-tab gone.
// Component file kept in repo for now in case we need to reference parts
// of it during Browse-tab implementation; deletion in a follow-up cleanup.
import PoliticianDetailScreen from './components/PoliticianDetailScreen';
// 1AM-124: SettingsScreen overlay reached via gear icon in HeaderBar (top-right
// of each tab). Replaces the Settings-tab in the bottom-nav.
import SettingsScreen from './components/SettingsScreen';
// 1AM-125 fase 1: HeaderBar imported directly so Feed and Alerts tabs share
// the same editorial header pattern as Browse-tab. Previously each tab had
// inline h1+description rendered via the `screens` config; with this change
// all three tabs use HeaderBar — Browse renders it internally,
// Feed/Alerts wrap it here in App.jsx around their respective screens.
import HeaderBar from './components/HeaderBar';
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
  // 1AM-124: reduced to 3 tabs (feed / browse / alerts). Stale values
  // 'politicians' or 'settings' fall back to 'feed' on hydration.
  // 1AM-125 fase 2: smart default routing for first-time users. If there is
  // no saved tab (or it's invalid), default to 'browse' for users with no
  // follows (browsing exists, exploring needed) and 'feed' for users with
  // follows (their personalized stream is the destination). Existing users
  // with a saved valid tab are unaffected — saved tab always wins.
  const VALID_TABS = ['feed', 'browse', 'alerts'];
  const [activeTab, setActiveTab] = useState(() => {
    const saved = getJSON(STORAGE_KEYS.ACTIVE_TAB, null);
    if (VALID_TABS.includes(saved)) return saved;
    // No saved tab: route based on whether user follows anyone.
    const initialFollows = migrateFollowedNames(
      getJSON(STORAGE_KEYS.FOLLOWED_POLITICIANS, [])
    );
    return initialFollows.length > 0 ? 'feed' : 'browse';
  });
  // 1AM-69: detail-page overlay. null = no overlay; otherwise the politician
  // name being viewed. Not persisted — feels right that returning to the app
  // lands on the last tab, not on a stale detail page.
  const [detailPolitician, setDetailPolitician] = useState(null);
  // 1AM-124: Settings overlay state. true = SettingsScreen rendered as a
  // full-page overlay (variant A from the architecture decision). Reached
  // from the gear icon in HeaderBar. Not persisted — same reasoning as
  // detailPolitician.
  const [isShowingSettings, setIsShowingSettings] = useState(false);
  // 1AM-124: isBrowsingAll state removed — Browse-tab is now a top-level
  // tab (formerly an overlay reachable from FeedScreen `Show all`). The
  // `Show all` button on FeedScreen now switches activeTab to 'browse'
  // instead of triggering the overlay.

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

  // ── Browse All Filings overlay (1AM-112) — REMOVED in 1AM-124 ───────────
  // Browse is now a top-level tab. The full-screen overlay pattern is gone.
  // Existing entry-points (FeedScreen `Show all`, FilterEmptyState CTA) now
  // call setActiveTab('browse') instead of toggling the overlay.

  // ── Settings overlay (1AM-124) ────────────────────────────────────────────
  // Reached from the gear icon in HeaderBar (top-right of any tab). Renders
  // above any other tab content. `← Back` in SettingsScreen returns the user
  // to whichever tab they came from — activeTab is preserved underneath.
  // Rendered before detailPolitician so that tapping the gear from a detail
  // page also lands on Settings cleanly.
  if (isShowingSettings) {
    return (
      <SettingsScreen
        onBack={() => setIsShowingSettings(false)}
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
  // 1AM-124: screens metadata reduced to 3 tabs. The global header (h1 +
  // description in App.jsx) is preserved for `feed` and `alerts` so existing
  // FeedScreen + Alerts placeholder still get rendered the same way. For
  // `browse` we render BrowseAllFilingsScreen directly without the global
  // header — that screen has its own page-style header (1AM-112) which we'll
  // refine in fase 4 of this ticket to match the Lovable v3-rounded mockup.
  // 1AM-125 fase 1: Feed and Alerts tabs share the HeaderBar pattern with
  // Browse-tab. Title-only — no description line. Previous "Your Feed" +
  // "Live congressional trades — filed under the STOCK Act" tagline removed
  // for visual consistency across all three tabs (Browse has no tagline,
  // Feed/Alerts shouldn't either).
  const screenTitles = {
    feed: 'Feed',
    alerts: 'Alerts',
  };

  const currentTitle = screenTitles[activeTab];

  // 1AM-124: Browse-tab gets its own render path without the global header
  // wrapper. BrowseAllFilingsScreen renders HeaderBar internally (title
  // "Browse" + gear icon top-right). Gear icon opens SettingsScreen overlay
  // via onSettingsClick.
  // 1AM-124 fase 6: followedPoliticians + togglePolitician are passed in so
  // the Most Active section's Follow toggle drives the same `selected` state
  // used by Feed and other parts of the app.
  if (activeTab === 'browse') {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
        <BrowseAllFilingsScreen
          // 1AM-124: onBack kept for backwards compat (no UI link anymore
          // after fase 4 header redesign — see BrowseAllFilingsScreen header
          // comment). Switches to feed-tab if anything calls it programmatically.
          onBack={() => setActiveTab('feed')}
          onSettingsClick={() => setIsShowingSettings(true)}
          followedPoliticians={followedPoliticians}
          onTogglePolitician={togglePolitician}
        />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
      {/* Page content */}
      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '20px 24px 100px',
        }}
      >
        {/* 1AM-125 fase 1: HeaderBar replaces the previous inline h1+p block.
            Same component as Browse-tab uses internally — title in Playfair
            32px navy + gear icon top-right that opens SettingsScreen. */}
        <HeaderBar
          title={currentTitle}
          onSettingsClick={() => setIsShowingSettings(true)}
        />

        {/* ── Active tab content ── */}
        {activeTab === 'feed' && (
          <FeedScreen
            followedPoliticians={followedPoliticians}
            onUnfollow={togglePolitician}
            // 1AM-124: Politicians-tab is gone; Browse-tab Most Active section
            // is the new entry point for following politicians. FeedScreen
            // empty-state CTA "Discover politicians to follow" now navigates
            // to Browse instead of Politicians.
            onNavigateToPoliticians={() => setActiveTab('browse')}
            onShowPoliticianDetail={setDetailPolitician}
            // 1AM-124: Show all button on FeedScreen now switches to Browse-tab
            // (was: triggered isBrowsingAll overlay).
            onBrowseAll={() => setActiveTab('browse')}
          />
        )}

        {activeTab === 'alerts' && (
          // Placeholder — content built in 1AM-126.
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
              🔔
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

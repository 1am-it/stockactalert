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
import WatchHeader from './components/WatchHeader';
// 1AM-66 v0.13.1: Welcome + Explainer screens removed; Discovery makes them
// redundant. Steps simplified to 'discovery' → 'pick-politicians' → 'done'.
// Migration of explainer content tracked in 1AM-110.
import OnboardingPickPoliticians from './components/OnboardingPickPoliticians';
// 1AM-28 phase 1: FollowedListScreen — full-page management surface for
// followed politicians, reachable from the "Manage who you follow" CTA in
// FeedScreen empty-state. Renders as a feed sub-screen (not a separate tab).
import FollowedListScreen from './components/FollowedListScreen';
import BrowsePoliticiansScreen from './components/BrowsePoliticiansScreen';
import { STORAGE_KEYS } from './lib/storage';
import { readUserState, writeUserState } from './lib/userState';
import { useAuth } from './lib/useAuth';
import { useTrades } from './hooks/useTrades';
import { AuthProvider } from './lib/AuthProvider';
import SignInOverlay from './components/SignInOverlay';

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
  // 1AM-148: FMP emits "Mark R. Warner" (with middle initial) but the
  // directory canonical is "Mark Warner". Without this alias, MostActive
  // shows "+ Follow" on Warner's row even when he's already in selected[].
  'Mark R. Warner': 'Mark Warner',
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
    readUserState(STORAGE_KEYS.ONBOARDING_DONE, false) ? 'done' : 'discovery'
  );
  const [followedPoliticians, setFollowedPoliticians] = useState(() =>
    migrateFollowedNames(readUserState(STORAGE_KEYS.FOLLOWED_POLITICIANS, []))
  );
  // 1AM-69: muted-alerts preference, persisted but currently no-op for actual
  // delivery (alert system wired later in 1AM-71). Same migration aliases as
  // followedPoliticians so legacy stored names map to current directory.
  const [mutedPoliticians, setMutedPoliticians] = useState(() =>
    migrateFollowedNames(readUserState(STORAGE_KEYS.MUTED_POLITICIANS, []))
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
    const saved = readUserState(STORAGE_KEYS.ACTIVE_TAB, null);
    if (VALID_TABS.includes(saved)) return saved;
    // No saved tab: route based on whether user follows anyone.
    const initialFollows = migrateFollowedNames(
      readUserState(STORAGE_KEYS.FOLLOWED_POLITICIANS, [])
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
  // 1AM-181: Sign-in overlay state. true = SignInOverlay rendered. State-
  // overlay pattern consistent with detailPolitician + isShowingSettings.
  // Not persisted — overlay opens via Sign In CTA, closes via × button or
  // successful auth (then dismissed automatically by App reactive re-render).
  const [isShowingSignIn, setIsShowingSignIn] = useState(false);

  // 1AM-181 TEMPORARY (remove when 1AM-184 ships): expose window.signIn()
  // so we can test the overlay before the Header sign-in CTA exists.
  // Open browser DevTools console, type signIn(), overlay appears.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.signIn = () => setIsShowingSignIn(true);
    }
  }, []);
  // 1AM-28: Feed sub-screen state. null = render the regular FeedScreen;
  // 'followedList' = render FollowedListScreen instead. Same overlay pattern
  // as detailPolitician — not persisted, returns to feed on tab-switch.
  // Lives at App level (not inside FeedScreen) so the bottom-nav and gear
  // icon stay wired without prop-drilling through the feed.
  const [feedSubScreen, setFeedSubScreen] = useState(null);
  // 1AM-28: sort preference for FollowedListScreen, persisted across sessions.
  // Valid values: 'most-active' (default), 'alphabetical', 'recently-added'.
  // Whitelist guards against stale or malformed localStorage values.
  const VALID_FOLLOWED_SORT = ['most-active', 'alphabetical', 'recently-added'];
  const [followedListSort, setFollowedListSort] = useState(() => {
    const saved = readUserState(STORAGE_KEYS.FOLLOWED_LIST_SORT, null);
    return VALID_FOLLOWED_SORT.includes(saved) ? saved : 'most-active';
  });
  // 1AM-168: persist time-window selection on Watch-tab. Single source of
  // truth for all Watch sections. Whitelist guards against stale or
  // malformed values from older builds.
  const VALID_WATCH_WINDOWS = ['24h', '7d', '30d', '90d'];
  const [watchWindow, setWatchWindow] = useState(() => {
    const saved = readUserState(STORAGE_KEYS.WATCH_WINDOW, null);
    return VALID_WATCH_WINDOWS.includes(saved) ? saved : '30d';
  });
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
  // 1AM-168: lastUpdatedAt + refetch added so WatchHeader can render
  // "Last update N min ago" and tap-to-refresh from the same hook call.
  const { trades, lastUpdatedAt, refetch } = useTrades();

  // 1AM-183: User-change re-hydration.
  //
  // When a user signs in, AuthProvider awaits userState.handleAuthChange()
  // BEFORE committing the new session to React state. That means by the
  // time this useEffect fires (in response to user.id changing via
  // useAuth), localStorage has already been reconciled with server-side
  // state by userState — either via "migrate up" (first sign-in) or
  // "sync down" (subsequent sign-in / second-device).
  //
  // The lazy-init useState calls above only read localStorage ONCE on
  // mount. Without this effect, App.jsx's React state would diverge from
  // localStorage after every server-sync (showing stale follows until
  // the user manually refreshes the page).
  //
  // Re-hydrates Tier 1 + Tier 2a state only. Tier 2b (activeTab,
  // watchWindow) is intentionally NOT re-hydrated — those are device-
  // prefs and don't change across users on the same device.
  const { user } = useAuth();
  const [lastSeenUserId, setLastSeenUserId] = useState(null);
  useEffect(() => {
    const newUserId = user?.id ?? null;
    if (newUserId === lastSeenUserId) return;

    setOnboardingStep(
      readUserState(STORAGE_KEYS.ONBOARDING_DONE, false) ? 'done' : 'discovery'
    );
    setFollowedPoliticians(
      migrateFollowedNames(readUserState(STORAGE_KEYS.FOLLOWED_POLITICIANS, []))
    );
    setMutedPoliticians(
      migrateFollowedNames(readUserState(STORAGE_KEYS.MUTED_POLITICIANS, []))
    );
    const savedSort = readUserState(STORAGE_KEYS.FOLLOWED_LIST_SORT, null);
    if (
      savedSort === 'most-active' ||
      savedSort === 'alphabetical' ||
      savedSort === 'recently-added'
    ) {
      setFollowedListSort(savedSort);
    } else {
      setFollowedListSort('most-active');
    }

    setLastSeenUserId(newUserId);
  }, [user?.id, lastSeenUserId]);

  // Persist onboarding completion whenever step transitions to/from 'done'
  useEffect(() => {
    writeUserState(STORAGE_KEYS.ONBOARDING_DONE, onboardingStep === 'done');
  }, [onboardingStep]);

  // 1AM-181: Clean up access_token from URL hash after magic-link callback.
  // Supabase client (via detectSessionInUrl: true) picks up the token
  // automatically and establishes the session — we just need to scrub the
  // URL so the token doesn't linger in browser history or get shared via
  // copy-paste. Standard routing libraries do this implicitly; in our
  // state-overlay pattern we do it explicitly.
  //
  // Done-when criterium for 1AM-181: "after callback processing, URL no
  // longer contains auth token". This is the implementation of that.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token') || hash.includes('error')) {
      // Wait for Supabase client to consume the hash, then clear it.
      // 100ms is empirically enough; Supabase's detectSessionInUrl runs
      // synchronously during client init but onAuthStateChange fires async.
      const timer = setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  // Persist followed politicians on every change
  useEffect(() => {
    writeUserState(STORAGE_KEYS.FOLLOWED_POLITICIANS, followedPoliticians);
  }, [followedPoliticians]);

  // 1AM-69: Persist muted politicians on every change
  useEffect(() => {
    writeUserState(STORAGE_KEYS.MUTED_POLITICIANS, mutedPoliticians);
  }, [mutedPoliticians]);

  // 1AM-60: Persist active tab on every change so reopening the app lands
  // on the same tab the user last visited.
  useEffect(() => {
    writeUserState(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  // 1AM-28: Persist FollowedListScreen sort preference on every change.
  useEffect(() => {
    writeUserState(STORAGE_KEYS.FOLLOWED_LIST_SORT, followedListSort);
  }, [followedListSort]);

  // 1AM-168: Persist Watch-tab window selection on every change.
  useEffect(() => {
    writeUserState(STORAGE_KEYS.WATCH_WINDOW, watchWindow);
  }, [watchWindow]);

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
  // ── Sign-in overlay (1AM-181) ──────────────────────────────────────────────
  // Rendered as an early return BEFORE every other render branch so sign-in
  // works from any tab (Browse, Watch, Alerts) and from any sub-screen state.
  // Earlier attempt at putting this conditional in the main render block
  // (below all early returns) failed because tab-specific returns at
  // activeTab === 'browse' intercepted the render before reaching it.
  // SignInOverlay has its own position:fixed full-screen background so
  // returning it standalone (without TabBar underneath) is acceptable — the
  // user is in a focused auth flow, not navigating tabs.
  if (isShowingSignIn) {
    return <SignInOverlay onClose={() => setIsShowingSignIn(false)} />;
  }

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

  // ── 1AM-28: FollowedListScreen sub-screen of Feed-tab ─────────────────────
  // Reached from the "Manage who you follow" CTA in FeedScreen empty-state.
  // Renders standalone (no global HeaderBar wrapper) because the screen has
  // its own back-chevron + count + Edit-button header. TabBar stays visible.
  // Tab-tap clears the sub-screen + switches tabs (same pattern as
  // detailPolitician). Tapping a row opens the politician detail page —
  // detailPolitician is checked above this block, so detail overlays the
  // sub-screen and back from detail returns the user here.
  if (activeTab === 'feed' && feedSubScreen === 'followedList') {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
        <FollowedListScreen
          followedPoliticians={followedPoliticians}
          mutedPoliticians={mutedPoliticians}
          trades={trades}
          sortOption={followedListSort}
          onSortChange={setFollowedListSort}
          onTogglePolitician={togglePolitician}
          onToggleMute={toggleMute}
          onShowPoliticianDetail={setDetailPolitician}
          onBack={() => setFeedSubScreen(null)}
          onSettingsClick={() => setIsShowingSettings(true)}
          onAddMore={() => {
            // 1AM-161: re-route from Browse-tab trades-list (misleading
            // affordance — "Add more" promised politici but delivered
            // trades) to the new BrowsePoliticiansScreen sub-screen.
            // Drops the stale most-active-section scroll-anchor (1AM-151
            // moved Most Active out of Browse-tab; the anchor no longer
            // exists in the DOM).
            setFeedSubScreen('browsePoliticians');
          }}
          onSearchByName={() => {
            setActiveTab('browse');
            setFeedSubScreen(null);
          }}
        />
        <TabBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            // Tab-tap closes the sub-screen AND switches tabs
            setFeedSubScreen(null);
            setActiveTab(tab);
          }}
        />
      </div>
    );
  }

  // 1AM-160: BrowsePoliticiansScreen sub-screen route. Reachable via the
  // FollowedListScreen "Add more" CTA once 1AM-161 re-routes that callback;
  // currently routable via direct state set for testing. Tab-tap clears
  // sub-screen state and switches tabs (same pattern as followedList route).
  if (activeTab === 'feed' && feedSubScreen === 'browsePoliticians') {
    return (
      <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
        <BrowsePoliticiansScreen
          followedPoliticians={followedPoliticians}
          onTogglePolitician={togglePolitician}
          onBack={() => setFeedSubScreen('followedList')}
        />
        <TabBar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setFeedSubScreen(null);
            setActiveTab(tab);
          }}
        />
      </div>
    );
  }

  const screenTitles = {
    feed: 'Watch',
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
          //
          // 1AM-70 phase 3: followedPoliticians + onTogglePolitician are
          // back (1AM-151 had dropped them when the Most Active section was
          // removed from Browse). The trade detail drawer now consumes both:
          // Follow CTA reads followed state and toggles via the same callback
          // that drives Feed-tab's follow state. onPoliticianClick is new —
          // drawer's "View all trades" navigates to PoliticianDetailScreen
          // by setting detailPolitician, which our existing route renders.
          onBack={() => setActiveTab('feed')}
          onSettingsClick={() => setIsShowingSettings(true)}
          followedPoliticians={followedPoliticians}
          onTogglePolitician={togglePolitician}
          onPoliticianClick={setDetailPolitician}
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
        {/* 1AM-168: Watch-tab gets WatchHeader (window-selector + Last
            update + Following-pill). Alerts-tab keeps the simpler HeaderBar
            for now. Browse-tab renders its own header internally and is
            handled by the early-return path above. */}
        {activeTab === 'feed' ? (
          <WatchHeader
            followingCount={followedPoliticians.length}
            onManageFollowingClick={() => setFeedSubScreen('followedList')}
            onSettingsClick={() => setIsShowingSettings(true)}
            watchWindow={watchWindow}
            onWindowChange={setWatchWindow}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={refetch}
          />
        ) : (
          <HeaderBar
            title={currentTitle}
            onSettingsClick={() => setIsShowingSettings(true)}
          />
        )}

        {/* ── Active tab content ── */}
        {activeTab === 'feed' && (
          <FeedScreen
            followedPoliticians={followedPoliticians}
            // 1AM-168: window from WatchHeader as single source of truth.
            // FeedScreen filters visible trades by trade_date >= since(window)
            // and propagates the label to FeedEmptyHero for window-driven copy.
            watchWindow={watchWindow}
            // 1AM-28: pass muted list so Feed cards from muted politicians
            // are filtered out (in both filterActive and showAll views).
            mutedPoliticians={mutedPoliticians}
            onUnfollow={togglePolitician}
            // 1AM-124: Politicians-tab is gone; Browse-tab Most Active section
            // is the new entry point for following politicians. FeedScreen
            // empty-state CTA "Discover politicians to follow" now navigates
            // to Browse instead of Politicians.
            onNavigateToPoliticians={() => setActiveTab('browse')}
            onShowPoliticianDetail={setDetailPolitician}
            // 1AM-145 / 1AM-28: Feed empty-state CTAs.
            //   onBrowseAll       → Browse + scroll #recent-trades-section
            //   onManageFollowing → FollowedListScreen sub-screen (1AM-28
            //                       rewire from the Pad B placeholder that
            //                       previously scrolled to Most Active).
            // 50ms setTimeout on the Browse-bound handler gives React one
            // paint cycle for the tab switch before scrollIntoView fires —
            // same pattern as 1AM-134.
            onBrowseAll={() => {
              setActiveTab('browse');
              setTimeout(() => {
                document
                  .getElementById('recent-trades-section')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            }}
            onManageFollowing={() => setFeedSubScreen('followedList')}
            // 1AM-169: Explore-all hand-off from "Your most active" card.
            // Switches to Explore-tab; sort-preset wiring is intentionally
            // deferred (BrowseAllFilingsScreen already shows Most Active
            // on its own surface, so a tab-switch is enough — the user
            // sees the cross-Congress Most Active section there).
            onExploreAll={() => setActiveTab('browse')}
            // 1AM-170 (4a): Sector tap → navigate to Explore-tab. Preset
            // sector-filter wiring deferred to 4b — for v1 the user lands
            // on Explore where they can re-apply the sector filter via
            // the existing sector-filter UI.
            onSectorTap={() => setActiveTab('browse')}
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
                background: '#0D1B2A18',
                border: '2px solid #0D1B2A30',
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
              Alerts — coming soon
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

export default function AppWithAuth() {
  // 1AM-181: AuthProvider wraps the App tree so any component can call
  // useAuth() without prop-drilling. Session state is read from localStorage
  // synchronously on mount, so there's no flash of unauthenticated content
  // for returning users.
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

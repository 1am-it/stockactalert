# Changelog

All notable changes to StockActAlert are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No unreleased changes yet._

---

## [0.26.0] — 2026-05-16

Auth-epic [1AM-31](https://linear.app/1am-it/issue/1AM-31) sub-ticket [1AM-183](https://linear.app/1am-it/issue/1AM-183) — the localStorage → Supabase data-migration layer — plus the [1AM-186](https://linear.app/1am-it/issue/1AM-186) Alerts-placeholder crash discovered during [1AM-181](https://linear.app/1am-it/issue/1AM-181) tab-coverage testing. With this release, signed-in users have their `followedPoliticians` and onboarding-completion state mirrored to `public.follows` and `public.user_profiles` automatically; data accumulated as an anonymous user migrates UP to the server on first sign-in, and second-device sign-ins sync server-side state DOWN to localStorage. MINOR bump: new abstraction layer (`src/lib/userState.js`) with three explicit storage tiers, new `useAuth` re-export per spec, and the first end-to-end auth-aware data path through the app — but no user-visible UX surface yet (the Sign-in CTA in the header still ships with [1AM-184](https://linear.app/1am-it/issue/1AM-184)).

### Added

- **`src/lib/userState.js` — auth-aware storage abstraction (1AM-183)** — single gateway for all user-bound state reads/writes, replacing the 13 direct `getJSON`/`setJSON` call sites in `App.jsx`. Classifies every `STORAGE_KEYS.*` entry into one of three explicit tiers documented at the top of the file: **Tier 1** (user-data, syncs to Supabase: `FOLLOWED_POLITICIANS` → `public.follows`, `ONBOARDING_DONE` → `public.user_profiles.onboarding_completed`); **Tier 2a** (user-pref, device-local, wiped on user-switch: `MUTED_POLITICIANS`, `FOLLOWED_LIST_SORT`); **Tier 2b** (device-pref, user-agnostic, never wiped: `ACTIVE_TAB`, `WATCH_WINDOW`). Reads are synchronous from localStorage cache; writes are synchronous to localStorage with fire-and-forget Supabase mirror for SYNCED_KEYS. No client-side rollback in v1 — convergence is via `syncUserStateFromServer` on next sign-in. `ONBOARDING_DONE` writes are monotone (`true` once, never back to `false`); server-side guard via `.eq('onboarding_completed', false)` so concurrent updates from another device don't clobber state.
- **`STORAGE_KEYS.LAST_USER_ID` — device-fingerprint for user-switch detection (1AM-183)** — new localStorage key (`saa.lastUserId`) that records which `user.id` last touched the user-bound keys on this device. On every sign-in, `handleAuthChange` compares `lastUserId` with the current user's id; mismatch triggers a wipe of all Tier 1 + Tier 2a keys before the new user's state loads, preventing user A's leftover state from being silently migrated into user B's account. Set **before** the migration runs (not after) so partial-failure scenarios don't loop. Critical invariant: `LAST_USER_ID` is NOT cleared on sign-out — it's a device-state marker, not session-state. Sign-out is an auth-event, this key tracks "who last used this device". The two are intentionally decoupled. Only `userState.js` reads/writes this key.
- **`src/lib/useAuth.js` — one-liner re-export (1AM-183)** — `export { useAuth } from './AuthProvider'` to satisfy the ticket spec referencing `./lib/useAuth` as the import path, without duplicating the React context. Single source of truth remains `AuthProvider.jsx`.
- **User-change re-hydration in `App.jsx` (1AM-183)** — new `useEffect` watching `user?.id` from `useAuth()`. When sign-in completes (or user-switch occurs), re-reads Tier 1 + Tier 2a state from localStorage into React state, so the UI reflects server-synced values without requiring a page refresh. Tier 2b state intentionally NOT re-hydrated — device-prefs don't change across users on the same device. AuthProvider awaits `handleAuthChange` BEFORE committing the new session, so by the time React re-renders with the new `user.id`, localStorage is already reconciled.

### Fixed

- **Alerts tab placeholder crash — `ReferenceError: current is not defined` (1AM-186)** — pre-existing bug from the [1AM-126](https://linear.app/1am-it/issue/1AM-126) placeholder era; three references to an undefined `current` object in the Alerts-tab render block (`${current.color}18` background, `2px solid ${current.color}30` border, `{current.title}` title). Hard-coded the values to navy `#0D1B2A` + literal "Alerts" since the placeholder gets replaced entirely when [1AM-126](https://linear.app/1am-it/issue/1AM-126) ships — no abstraction warranted for throwaway code. Also unblocked the `signIn()` overlay-hoist from [1AM-181](https://linear.app/1am-it/issue/1AM-181) on the Alerts tab (overlay couldn't render before the tab itself rendered).
- **Postgres GRANTs missing on 1AM-180 tables (1AM-183)** — discovered during 1AM-183 mirror testing: every DELETE/INSERT/UPDATE against `public.follows` / `public.user_profiles` returned HTTP 403 with PostgREST error `42501` ("insufficient_privilege"), regardless of RLS policy correctness. Postgres has two access-control layers — table-level GRANTs and row-level security policies — and RLS only matters if the role has been granted access to the table in the first place. Supabase's newer project defaults no longer auto-grant DML on public schema to the `authenticated` role; explicit grants are required. New migration `20260516194500_1AM-183_table_grants.sql` adds `GRANT SELECT ON public.users`, `GRANT SELECT, UPDATE ON public.user_profiles`, and `GRANT SELECT, INSERT, DELETE ON public.follows` — all to `authenticated`. No grants for `anon` (anonymous users only use localStorage).
- **Schema column-name mismatch in userState queries (1AM-183)** — initial 1AM-183 implementation assumed `user_profiles.id` and `onboarding_completed_at` (timestamp), but the actual 1AM-180 schema uses `user_profiles.user_id` (primary key + FK) and `onboarding_completed` (boolean, not timestamp). All `.eq('id', ...)` calls in `userState.js` updated to `.eq('user_id', ...)`; all `onboarding_completed_at` references updated to `onboarding_completed` with corresponding boolean-vs-timestamp semantics in monotone-write guards. Lesson learned: schema assumptions must be cross-checked against the migration file, not built from memory.
- **Gotrue auth-token lock contention from dual `handleAuthChange` invocation (1AM-183)** — initial AuthProvider triggered `handleAuthChange` from BOTH the `getSession().then(...)` initial-load path AND `onAuthStateChange`'s `INITIAL_SESSION` event (auto-fires on subscribe). Concurrent Supabase REST calls then fought for the gotrue auth-token lock, surfacing as `@supabase/gotrue-js: Lock "lock:sb-...-auth-token" was not released within 5000ms ... Forcefully acquiring the lock to recover`. The forced lock-release left a window where `auth.uid()` returned null server-side, causing all RLS-protected mirror calls to fail with 403 (separate from the GRANT-403 above, same status code coincidentally). Fix: `handleAuthChange` is now invoked from `onAuthStateChange` ONLY; `getSession()` only sets initial UI loading state.

### Out of scope (future tickets)

- **Header sign-in CTA + Settings drawer ([1AM-184](https://linear.app/1am-it/issue/1AM-184))** — until this ships in the next Sprint-1 release, `SignInOverlay` is still only reachable via the temporary `window.signIn()` console-trigger from [1AM-181](https://linear.app/1am-it/issue/1AM-181). End-users still can't sign in via UI; v0.26.0 is the data-layer foundation, the UI entry-point comes next.
- **`followedPoliticians` semantic gap (no ticket yet)** — `App.jsx` stores `followedPoliticians` as an array of politician name-strings (`['Nancy Pelosi', 'Chip Roy', ...]`), not bioguideIds. The 1AM-180 schema column `follows.bioguide_id` is a generic `text` column so accepts names technically, but the schema-intent is bioguideIds and the push-notification fan-out work post-launch will need real bioguideIds for efficient cross-user lookups. The names → bioguideId migration is deferred to a future ticket that touches `App.jsx`'s state model directly. For v1, the mirror writes whatever localStorage contains.
- **`MUTED_POLITICIANS` server-sync ([1AM-71](https://linear.app/1am-it/issue/1AM-71) context)** — Tier 2a, intentionally kept local-only in v0.26.0. Currently the mute preference doesn't affect alert delivery anywhere (no push notifications wired yet), so server-sync has zero functional value. Cross-device mute sync ships alongside the [1AM-71](https://linear.app/1am-it/issue/1AM-71) push notification work.
- **Migration-UP completeness under rapid user-action (1AM-183 known limitation)** — there's a narrow race window where, if a user clicks a Follow/Unfollow button within ~500ms of completing sign-in, the resulting `writeUserState` call's delete-then-insert pattern can clobber rows that the initial migration just inserted. Acceptable for v1 (low-probability, single-device, not a data-integrity risk since the user's intentional click wins). Resolution: either debounce post-migration writes briefly, or switch from delete-then-insert to true diff-based upserts. Tracked informally; will surface if it bites in user testing.

---

## [0.25.0] — 2026-05-14

Auth-foundation track for the [1AM-31](https://linear.app/1am-it/issue/1AM-31) auth epic. Supabase schema + auth-trigger for `users` / `user_profiles` / `follows`, plus magic-link sign-in via Resend SMTP. Foundation-only: there is no Sign In CTA in the header yet (that ships with [1AM-184](https://linear.app/1am-it/issue/1AM-184)), so end-users won't see a change from this release until the entry-point lands. Until then, `SignInOverlay` is only reachable via the temporary `window.signIn()` console-trigger in the bundle — usable for preview testing, not exposed in production UI. MINOR bump: new schema, new auth surface, no breaking API changes.

### Added

- **Supabase auth schema + RLS (1AM-180)** — three new tables in `public`: `users` (mirrors `auth.users` via UUID FK cascade), `user_profiles` (per-user settings: display_name, email_notifications, onboarding_completed_at, auto-`updated_at` trigger), and `follows` (`user_id` + `bioguide_id`, unique constraint, index on `bioguide_id` for future push fan-out). New `handle_new_auth_user()` security-definer trigger fires on `auth.users` insert and cascades rows into `public.users` + `public.user_profiles` automatically. RLS enabled with conservative policies: users read/write only their own rows on `follows`, read-only on `users` + `user_profiles` (writes are trigger-managed). Migration tracked under `supabase/migrations/20260514075835_1AM-180_users_profiles_follows.sql` via the official Supabase CLI (no Docker dependency — `npx supabase link` + `db push` works headless).
- **Magic-link sign-in via Resend SMTP (1AM-181)** — full magic-link auth flow built on Supabase Auth + Resend Custom SMTP. New `SignInOverlay` state-overlay (consistent with `PoliticianDetailScreen` + `SettingsScreen` overlay patterns; not a dedicated route). New `AuthProvider` Context exposing `useAuth()` hook returning `{ session, user, loading }` — single source of truth for "is the user signed in", subscribes to `onAuthStateChange` for sign-in / sign-out / token-refresh / magic-link-callback events. New `supabaseClient` singleton (browser-side, uses anon key with RLS, not the service-role key from `api/trades.js`). Resend account live in sandbox mode (verification-email-only delivery until custom domain DNS verified — parallel work with Theory7 DNS configuration); production sender-address rollout to `@stockactalert.com` deferred to pre-launch DNS pass.

### Changed

- **`SignInOverlay` hoisted above tab-specific early returns (1AM-181)** — the overlay-conditional was initially placed in the main render branch below all early returns, which meant sign-in couldn't be triggered from any tab that had its own early return (Browse-tab returns early at `App.jsx` line 418 with `<BrowseAllFilingsScreen />` + `<TabBar />`, intercepting render before reaching the late overlay-conditional). Moved to an early-return of its own near the top of the render flow (before `isShowingSettings`), so sign-in works from any tab.
- **In-container "← Back to app" link in SignInOverlay (1AM-181)** — the × close button at top-right is positioned on the screen edge (not within the 420px form container), which on wider desktop viewports puts it visually far from the form and easy to miss. Added a prominent text-button at the top of the form-container itself, always close to the action — works on mobile (where × is also nearby) and desktop equally.

### Fixed

- **`@supabase/auth-ui-react` removed — React 19 incompatibility (1AM-181)** — initial sign-in build pulled in `@supabase/auth-ui-react@0.4.7` as a drop-in UI primitive (deprecated since 2024, last published with React 18 as peerDependency). Caused `Uncaught TypeError: Cannot read properties of null (reading 'useState')` on Watch-tab render — classic React-version-mismatch symptom (one of the library's internal hooks resolves React from a different context than the host app). Replaced with a self-managed ~40-line magic-link form (state machine: `idle` → `sending` → `sent` | `error`) calling `supabase.auth.signInWithOtp()` directly. Cleaner control over styling (we were overriding the Supabase theme anyway), smaller bundle, no peer-dep risk.
- **URL-hash cleanup after magic-link callback (1AM-181)** — Supabase client's `detectSessionInUrl: true` picks up the `#access_token=...` from the URL hash after the magic-link callback and establishes the session, but doesn't clear the hash afterward. Token-in-hash lingers in browser history and is shareable via copy-paste — small but real security smell. Added a top-level `useEffect` in `App.jsx` that detects `access_token` or `error` in the hash post-mount, waits 100ms for the client to consume the token, then `window.history.replaceState`s it away.

### Out of scope (future tickets)

- **Sign In CTA in header + Settings drawer ([1AM-184](https://linear.app/1am-it/issue/1AM-184))** — until this ships, `SignInOverlay` is only reachable via the temporary `window.signIn()` console-trigger in the bundle. End-users can't sign in via UI yet; the foundation is live, the entry-point comes next.
- **localStorage → Supabase migration on first sign-in ([1AM-183](https://linear.app/1am-it/issue/1AM-183))** — currently sign-in creates an empty `user_profiles` row but doesn't carry over the user's local `followedPoliticians` / `mutedPoliticians` state. First-sign-in flow needs to write those into Supabase via the new `follows` table.
- **Alerts tab placeholder crash ([1AM-186](https://linear.app/1am-it/issue/1AM-186))** — pre-existing bug discovered during [1AM-181](https://linear.app/1am-it/issue/1AM-181) tab-coverage smoke test (`ReferenceError: current is not defined`). Not a regression; predates this release. Triaged as low-prio (placeholder gets replaced when [1AM-126](https://linear.app/1am-it/issue/1AM-126) ships).
- **Resend custom domain verification** — sandbox mode is fine for development; full domain verification (SPF + DKIM + DMARC for `@stockactalert.com`) ships alongside Theory7 DNS work in the pre-launch pass.

---

## [0.24.0] — 2026-05-13

Disclosure-UX track. Adds the **Disclosure Timeline** in the trade-detail drawer (a sparkline showing the stock's price trajectory around trade-date → filed-date → today, surfacing the structural filing-lag advantage) and the **PTR filing link** out to the original House clerk disclosure document. MINOR bump: Disclosure Timeline is a new user-visible surface, PTR link adds a new affordance to an existing drawer.

### Added

- **Disclosure Timeline in TradeDetailDrawer (1AM-163)** — new SVG sparkline (320×120, dotted-line "Variant B" treatment) above the Related filings section. Plots three price points: at the trade date, at the disclosure-filed date, and today. Visualizes the STOCK Act filing-lag — the structural delay between when a politician trades and when the public learns about it — and is the foundation for the future "would you have made money following this trade" angle. Uses `useDisclosurePrices` hook with deterministic mock data (FNV-1a + Mulberry32 seeded on ticker+tradeDate, ±15% variance) until real historical-price data lands (parallel work in [1AM-174](https://linear.app/1am-it/issue/1AM-174) — FMP free tier blocks historical endpoints with HTTP 403 "Legacy Endpoint" for post-Aug-2025 subscribers, so the hook is wired with a real-data swap-point for when EODHD All-In-One or equivalent lands pre-launch).
- **PTR filing link in TradeDetailDrawer (1AM-157)** — new "View original PTR filing →" link beneath the trade-summary block in the drawer, exposed only for trades that have a `disclosureUrl` in the normaliser output. Currently populated for House trades (FMP House feed carries `link` field in `raw_data` JSONB), Senate trades show "Original disclosure not yet linked" fallback. Schema typedef + `EMPTY_TRADE` updated; normaliser cascades `link || url || disclosureUrl || pdfUrl` to absorb upstream-source variations.

### Out of scope (future tickets)

- **Real historical-price data for Disclosure Timeline** — mock data is wired with a clear swap-point in `useDisclosurePrices`; real data comes pre-launch with the FMP Ultimate + EODHD stack from [1AM-174](https://linear.app/1am-it/issue/1AM-174) research.

---

## [0.23.0] — 2026-05-10

Watch-tab IA redesign + new **Sector Activity Heatmap** surface, addressing the "maze" / "no perceived feed" user feedback that prompted the v0/Lovable IA exploration earlier in the cycle. The Watch tab (renamed from Feed in 1AM-167) is now the personalized surface — scoped to politici you follow, with a window-selector at the top, a re-thought empty-state that explains the STOCK Act filing-lag rather than implying the feed is broken, and a new Sector Activity Heatmap that surfaces sector-level buy/sell patterns within the active window. Browse Politicians (renamed from Browse in 1AM-167 → Explore) gains an activity-signal suffix on each row so users can see at a glance which politici are actively trading. MINOR bump: tab-label rename is user-visible naming, two new components (WatchHeader, SectorActivityHeatmap), and the activity-signal is a new affordance on an existing surface.

### Added

- **`WatchHeader` with window-selector (1AM-168)** — new sticky header on the Watch tab containing: a chip-row window selector (`24h / 7d / 30d / 90d`, default `24h`), a `Last update` freshness indicator (relative-time, derived from `lastUpdatedAt` in `useTrades`), and a `Following N` pill linking to FollowedListScreen. Window selection drives the trade-list filter, the Most Active section, and the Sector Activity Heatmap (one source of truth, no per-section mismatches).
- **Watch empty-state rework — "mockup 2" treatment (1AM-169)** — when zero trades match the active window, the body now renders a large `0` numeral, a short STOCK Act filing-lag explainer (so users understand "no recent trades" ≠ "feed is broken"), and a dashed CTA card pointing at BrowsePoliticiansScreen ("Volg meer politici"). Replaces the previous flat `Geen recente filings` line which gave users no path forward and no context for the silence.
- **Most Active "Explore all ›" link (1AM-169)** — appended to the Most Active heading row when scoping to followed politici returns fewer than 5 results, linking to the Explore-tab politicians directory. Closes the discovery-loop without forcing users back to the empty-state CTA.
- **`SectorActivityHeatmap` — new surface (1AM-170)** — bar-chart-style breakdown of buy/sell volume by sector for the active window, rendered below Most Active on the Watch tab. Neutral split-bars (`#0D1B2A` for buys, `#9CA3AF` for sells) chosen over the green-buy / red-sell convention used in trade rows, because at the sector-aggregate level the buy-vs-sell signal is informational not directional. Auto-hides when fewer than 3 sectors have data in the window (avoids a near-empty chart on short windows or sparse-follow sets).
- **Activity-signal suffix on Browse Politicians rows (1AM-171)** — each member row in `BrowsePoliticiansScreen` (now reached via the renamed Explore tab) now shows a muted `· N trades 90d` suffix in the meta-line when the politician has filings in the last 90 days. 90d window is hardcoded for the directory surface — fixed-window scope makes the signal stable for follow-decisions, decoupled from whatever the user has set on Watch. Includes a 4-strategy `name → bioguideId` lookup map covering compound-lastName edge cases (April McClain Delaney / FMP "April Delaney", Lisa Blunt Rochester, Catherine Cortez Masto, etc.).

### Changed

- **Tab labels: Feed → Watch, Browse → Explore (1AM-167)** — TabBar labels, back-link copy on sub-screens, header titles, and CTA labels all updated to the new naming. Reflects the IA shift: Watch is your personalised surface (followed politici + window), Explore is the global directory (all politici, all filings). Visible back-label `← Feed` on FollowedListScreen / BrowsePoliticiansScreen also corrected (Phase 1 oversight initially missed by aria-label-only grep — see hotfix below).
- **Most Active scoping changed from global to followed-only on Watch (1AM-169)** — previously Most Active showed top global trade-volume politici regardless of follow-state. On Watch this conflicted with the personalisation premise; users following Pelosi/Schumer would still see Tuberville at the top of "Most Active". Watch-tab Most Active now filters to followed politici only (Explore-tab keeps the global Most Active for discovery). The previous `useActivePoliticians` hook is reused with a follow-set parameter.

### Fixed

- **Phase 1 visible back-label oversight (1AM-167)** — initial Feed → Watch rename updated `aria-label` but missed the visible button text on FollowedListScreen / BrowsePoliticiansScreen back-buttons. Both now read `← Watch` consistently. Lesson: rename audits need to grep both `aria-label` and visible-text occurrences.
- **`visibleTrades` / `watchTrades` follow-state-check unification (1AM-169 hotfix)** — `visibleTrades` filtered with name-only check while `watchTrades` used name + bioguideId. Result was an off-by-one inconsistency where the empty-state showed `0 filings` but Most Active still rendered a Banks trade (FMP "James E Hon Banks" resolves by bioguideId but not by name-string). Both paths now share an `isFollowedTrade(t)` helper that checks bioguideId first, name-string fallback.
- **`tradeDate` (camelCase) discipline in window filters (1AM-169 + 1AM-171 hotfix)** — Phase 2 implementation read `t.trade_date` (snake_case Supabase field) post-normaliser. Always-undefined → fallback `!t.trade_date` let every trade through the window filter, masking the bug until time-windowed counts diverged from expectations. Both Watch window filter and Browse activity-signal aggregator now consistently use `t.tradeDate` (the post-normaliser camelCase field).
- **Compound-lastName name resolution in activity-signal aggregator (1AM-171 hotfix)** — `findByName` haystacks for members with multi-word `lastName` (April McClain Delaney's lastName is `"McClain Delaney"`, not `"Delaney"`) didn't include the FMP-style first + last-word form, so 15 members never matched their FMP-emitted display names. Aggregator now builds a 4-strategy lookup map: `member.name`, `member.officialFull`, `${first} ${last}`, `${first} ${lastWord}`. Verified against all 15 compound-lastName members; resolves correctly without false positives.

### Out of scope (future tickets)

- **Tap-to-filter on Sector Activity Heatmap** — deferred as Phase 4b follow-up. Current iteration is read-only; tapping a sector to filter the trade list is a logical next step but adds state-mgmt scope not needed for v0.23.0.
- **`useTrades` global 50-limit affecting Watch + activity-signal** — surfaced during 1AM-171 diagnosis: low-frequency-but-high-profile politici (Pelosi, Schumer, Sanders) often fall outside the global top-50 trade-window, so users following only that profile see Watch chronicly-empty and Browse activity-signals partially populated. Either raise the limit (cheap, ~80% improvement) or move to per-followed-politician fetch via Supabase archive (durable). New ticket to follow.
- **Comprehensive FMP / roster name-discrepancy audit** — the trickle continues (Sanders, Capito, Warner, now compound-lastNames). Worth a one-off script that diffs FMP-emitted politician names against directory canonicals if a fifth pattern surfaces.

---

## [0.22.2] — 2026-05-10

Patch release for a long-standing visual bug in the Most Active section: Mark Warner's row showed `+ Follow` even when he was already in the user's follow-list, and tapping the button silently added a slightly-different name to storage. Same name-spelling-drift pattern as the Bernie Sanders / Shelley Capito migrations from 1AM-67 / 1AM-68. Fixed two ways: an alias entry that rewrites the FMP-typed `Mark R. Warner` to the directory-canonical `Mark Warner` on next reload, and a bioguideId-based fallback in the follow-state check so the next politician with the same pattern doesn't surprise us. PATCH bump because no schema change, no new surfaces, purely a follow-state correctness fix.

### Fixed

- **Mark Warner alias (1AM-148)** — `FOLLOWED_NAME_ALIASES` in `App.jsx` now rewrites stored `Mark R. Warner` → `Mark Warner` on hydration via the existing `migrateFollowedNames` path. Users who followed Warner before this release will see their stored name normalised to the directory-canonical form on next page load. No duplicate-storage growth from re-tapping `+ Follow` on his row.
- **Bioguide-resolved follow-state in MostActivePoliticians (1AM-148)** — the component's `isFollowed` check now matches on `bioguideId` first (robust to upstream name spelling drift), with name-string matching as fallback for legacy cases where `findByName` doesn't resolve. New `followedBioguideIds` prop computed in `FeedScreen` via `findByName` over the followed-names list. The `hasUnfollowedInTopN` discovery-section gate uses the same dual-check so it doesn't flicker between visible and hidden when a politician resolves by ID but not by name.

### Out of scope

- Long-term migration of `selected[]` storage to bioguideId-keyed (covered by 1AM-82 phase C).
- Comprehensive audit of every politician with FMP / directory name discrepancies — would need a script that diffs FMP-emitted names against the directory's canonical names. The `Mark R. Warner` fix is the third in a slow trickle (Sanders, Capito, Warner); if a fourth surfaces, the audit-script is worth it.

---

## [0.22.1] — 2026-05-09

Patch release adding company name + sector enrichment to PoliticianDetailScreen Net Positions (1AM-159). Tickers like TDG, PKG, ENTG are not universally recognisable — this matches the readability pattern already used in TradeDetailDrawer's Bought-block (1AM-70 phase 2) and brings PoliticianDetailScreen up to the same standard. Coverage audit before scoping confirmed 86% of production tickers have data in `sectors.json`; the remaining ~14% gracefully fall back to ticker-only display, no layout breakage. PATCH bump because no schema changes, no new API surfaces, purely visual enrichment of an existing list.

### Added

- **Net Positions row enrichment (1AM-159)** — each row in the Net Positions card on PoliticianDetailScreen now shows a muted secondary line with `companyName · sector` when the ticker is present in `sectors.json`. Visual treatment matches TradeDetailDrawer's Bought-block (DM Sans 12px, `#6B7280` for company name, `· ` separator in `#D1D5DB`, sector in `#9CA3AF`). Long company names truncate with ellipsis on a single row. Amount column stays right-aligned and top-anchored — no shift between covered and uncovered rows.

### Fixed

- **Restored politician headshots and recent header avatar work that briefly regressed mid-deploy (1AM-146 / 1AM-74)** — during the 1AM-159 push, an older copy of `PoliticianDetailScreen.jsx` was inadvertently committed, reverting the file to a pre-1AM-146 state and dropping headshots from the PoliticianDetailScreen header. Hotfix re-applied 1AM-146 + 1AM-74 + 1AM-159 changes in a single commit. Vercel preview verified before tagging the release.

### Out of scope

- Expanding `sectors.json` coverage beyond the current 176 tickers — refresh cycle is documented in `src/lib/sectors.js` (every few months via `npm run query:top-tickers` + `npm run fetch:sectors`); not gating this release.
- Tap-to-filter on sector in the Net Positions context — different surface from the drawer where the same affordance exists; defer until requested.

---

## [0.22.0] — 2026-05-09

New surface: **BrowsePoliticiansScreen** (1AM-160) — full ~536-member Congress directory accessible from the Feed-tab via a new people-icon entry-point in the header. Closes the discovery gap that opened when 1AM-123 (3-tab IA redesign) dropped the dedicated Politicians-tab. Use cases restored: "follow my Arizona senators without waiting for them to appear in the feed", "browse who I'm not yet following", "filter by chamber/party deliberately outside one-time onboarding". MINOR bump because of the new user-facing surface + new shared component + HeaderBar API extension.

### Added

- **`src/components/BrowsePoliticiansScreen.jsx` (1AM-160)** — directory-browse screen reached as a sub-screen of FollowedListScreen. Header shows "Browse Politicians" + "Following N of 536" count. Search + Chamber + Party filters via the shared picker. Followed-state visible per-row (filled star/checkmark via MemberListRow). Tap row → toggle follow directly (no confirm dialog). `Done` and `← Back` both return to FollowedListScreen.
- **`src/components/PoliticianPickerList.jsx` (1AM-160)** — presentational component extracted from `OnboardingPickPoliticians` so two surfaces consume the same search + filter + member-list behaviour without drift. Search debounce, Chamber + Party chip filters, optional "Suggested for you" section (gated by `showSuggested` prop, default true for onboarding, false for directory mode), filtered member list with `content-visibility: auto` perf hint, empty state. Auto-clears active filters on add (next pick happens against broader directory).
- **`HeaderBar` people-icon entry-point (1AM-160)** — optional `followingCount` + `onManageFollowingClick` props render a people-icon button with count-badge to the left of the gear-icon. Active Feed-tab now has a permanent path to FollowedListScreen → BrowsePoliticiansScreen, not only via empty-state Hero. Pattern-match with Twitter/X, Bluesky etc. — "manage who I follow" sits in chrome (header), not in content controls. Browse + Alerts callers continue to render gear-only header (props omitted).

### Changed

- **`OnboardingPickPoliticians.jsx` refactored to thin wrapper (1AM-160)** — search + filter + member-list behaviour moved into `PoliticianPickerList`. Wrapper now only owns the page title, intro copy, and sticky footer with `Continue (N selected)` button. Onboarding flow behaviour identical to v0.21.2 (regression-tested in smoke test).
- **`FollowedListScreen` "Add more" CTA re-routed (1AM-161)** — previously the CTA navigated to Browse-tab trades-list with a now-stale `most-active-section` scroll-anchor (1AM-151 moved Most Active out of Browse-tab in v0.21.0). Now opens BrowsePoliticiansScreen directly. Fixes the misleading affordance — the button promised "more politici" but delivered "more trades, possibly from politici you don't follow".

### Out of scope (future tickets)

- "Done" button visibility behind TabBar in BrowsePoliticiansScreen — minor cosmetic on tall directory; `← Back` and tab-tap both work as alternative exits. Polish for follow-up if reported.
- People-icon entry-point on Browse + Alerts headers — currently Feed-only. Probably not needed (FollowedListScreen access is more relevant when scanning your own activity), but easy to add via the same HeaderBar props if asked.

---

## [0.21.2] — 2026-05-09

Patch release fixing a 502 error on the `/api/trades/by-politician` Edge Function (1AM-158). FMP moved `senate-trades-by-name` and `house-trades-by-name` behind a paid tier (402 Payment Required), causing both chamber calls to fail and surface as 502 to clients. Same pattern as 1AM-37 (sp500-constituent paywall). Migrated the endpoint to query the Supabase archive (1AM-114) instead — same external contract, no FMP calls, no paywall risk for this surface going forward.

### Fixed

- **`/api/trades/by-politician` 502 on all politicians (1AM-158)** — endpoint now queries the Supabase `filings` table via `ilike('politician_name', ...)` instead of FMP's per-politician endpoints. PoliticianDetailScreen full-history view (Net Positions, sparkline, trade history) restored.

### Changed

- Edge Function depth source: FMP per-politician calls → Supabase archive. Practical depth is comparable (previous FMP cap was 25 trades per chamber; archive returns up to 200 trades, growing over time).
- Error response status on archive failure: 503 (Service Unavailable) instead of 502 (Bad Gateway) — more accurate now that the dependency is internal not upstream.

### Out of scope

- Migrating other FMP-dependent endpoints to Supabase (covered by individual tickets if/when they hit the same paywall).
- Acquiring an FMP paid tier (separate business decision tracked under 1AM-47).

---

## [0.21.1] — 2026-05-09

Politician headshots from the public-domain `unitedstates/images` dataset (1AM-146). Photos render across every Avatar surface — TradeCards, Most Active section, drawer header + related filings rows, FollowedListScreen, OnboardingPickPoliticians, PoliticianCard, and the PoliticianDetailScreen header (1AM-74). Joint trades show the politicus photo (mede-actor); spouse/dependent stay initials-only (privacy of non-public figures). Newly-appointed members may display initials until upstream publishes their portrait — photos auto-populate as upstream data updates, no app update required. PATCH bump because no schema changes, no new API surfaces, purely visual enrichment of an existing primitive.

### Added

- **Politician headshots via `Avatar` component upgrade (1AM-146)** — `Avatar.jsx` now accepts an optional `bioguideId` prop. When provided, renders a `<img>` from `https://unitedstates.github.io/images/congress/225x275/{bioguideId}.jpg` over the existing initials block. On `onError` (404, network failure, missing portrait) the image is hidden and the initials fallback remains visible — graceful degradation without layout shift. Lazy-loaded via `loading="lazy"`. Defensive bioguideId regex guard (`/^[A-Za-z]\d{6}$/`) rejects malformed input before constructing a URL.
- **`bioguideId` plumbed through every Avatar consumer** — `TradeCard`, `TradeDetailDrawer` (header + related filings rows), `PoliticianCard`, `MostActivePoliticians`, `FollowedListScreen`, `MemberListRow`. `TradeCard` and `TradeDetailDrawer` resolve the bioguideId via the existing `findByName` cascade (trades come raw from FMP without a bioguide field, so name-resolution is the bridge); the other consumers already had `bioguideId` in their local data and now pass it through.
- **PoliticianDetailScreen header avatar (1AM-74)** — closes the visual inconsistency where heavy traders showed photos in feed/drawer surfaces but reverted to initials-only on their detail page. Photo sits above the Playfair title at `xl` size (64px) so long names ("Marjorie Taylor Greene") retain horizontal space on narrow viewports.
- **Photo credits card under Settings** — new "Credits" section acknowledges the public-domain `unitedstates/images` dataset under CC0 1.0, with links to the upstream repo and the CC0 deed. Sits below the existing "Settings — coming soon" placeholder.

### Changed

- **`MemberListRow` selected-state visual treatment** — previously the selected state replaced the party-color avatar background with `#1F2937` (dark). With photos now rendering inside the same circle, replacing the background would have hidden the politicus's face. New treatment: photo stays visible, dark ring (`box-shadow: 0 0 0 2px #1F2937`) appears outside the circle to communicate selection. Initials-only fallback unchanged.

### Owner-type photo asymmetry

- `self` and `joint` trades show the politicus photo — politicus is actor (or mede-actor) of the transaction. Joint trades are **not** family-only; the politicus signed the disclosure as participant.
- `spouse` and `dependent` trades show initials only — these are private individuals (non-public figures) per the GDPR / privacy rationale documented in 1AM-146. Owner-pill on the trade card disambiguates visually.

### Operational notes

- **Coverage trigger for Stage B** — if photo coverage among the top-50 most-traded politici drops below 90% over a sustained period, revisit Stage B (`photo-overrides.json` with manual Wikipedia/Senate-portrait URLs for newly-appointed members). Not ticketed — measurable trigger for future re-evaluation.
- **No schema changes, no new API surfaces, no new external dependencies** at runtime — photos are hotlinked directly from `unitedstates.github.io`. Self-hosting via Supabase storage remains a Stage B option if upstream uptime degrades below 95%.

---

## [0.21.0] — 2026-05-09

Browse v3 redesign — six sub-tickets ship together (1AM-150 umbrella). Layout reset (1AM-151), time-range chips (1AM-152), active-filter pills (1AM-153), amount filter (1AM-154), and trade detail drawer (1AM-70). The sector data layer (1AM-37) already landed in v0.20.1 as silent foundation; v0.21.0 turns Browse-tab from a static list into a discovery surface — tap any trade for the full drawer (header, action row, sector tap-to-filter, related filings), with mobile swipe-down dismiss. MINOR bump because the user-visible surface is meaningfully expanded.

### Added

- **`src/components/FilterPill.jsx` (1AM-153)** — generic active-filter pill component. One pill = one active filter dimension. Click × to clear, click body (when `onClick` provided) for edit-affordance. Used by Browse for search-pill swap UX; designed to be filter-type-agnostic so 1AM-152 (time-range chips) and 1AM-154 (amount filter) can plug into the same primitive without per-type styling drift.
- **`src/components/FilterSummaryLine.jsx` (1AM-153)** — generic count + context summary line. Single source of truth for the small meta-strip that tells users what they're looking at. Replaces both Browse's inline count strip and Feed's bespoke monospace label. Muted gray sentence-case typography reflects secondary-meta status (filter-summary is not primary content).

### Changed

- **Browse-tab layout reset (1AM-151)**:
  - Header: `Browse` → `Recent Filings · last 30 days`. New `subtitle` prop on `HeaderBar` for the time-window communication.
  - Trending Tickers section removed from Browse render-tree. Component file (`src/components/TrendingTickers.jsx`) and `aggregateTopTickers` helper parked — no consumers, may resurface in a future Tickers/Watchlist surface.
  - Most Active Politicians section removed from Browse render-tree. Component file (`src/components/MostActivePoliticians.jsx`) stays — Feed-tab is now its sole consumer.
  - "Recent Trades" h2 header removed (redundant when the entire screen is filings).
  - 3-cascade `useTrades` calls (7d/30d/all-time) for Trending+MostActive sources removed. Single `useTrades(searchFilters)` is now the only fetch on this screen — fewer API calls per Browse-tab visit.
  - `BrowseAllFilingsScreen` props slimmed: dropped `followedPoliticians` + `onTogglePolitician` (only consumer was the removed Most Active row).

- **Feed-tab Most Active for active users (1AM-151)**:
  - Most Active section now renders below the feed for users with 1+ follows, in addition to the existing empty-state embed (1AM-145). Uses the same `useTrades()` data (unfiltered set), no separate fetch.
  - **Discovery-value check**: section is hidden when every politician in the top-N is already followed by the user — would otherwise be a redundant list adding noise instead of signal. Empty-state behaviour unchanged (always renders even if all top-N are unknown to the user).
  - `aggregateMostActivePoliticians` (already extracted to `src/lib/politicianAggregation.js` in 1AM-145) now drives both render contexts — empty-state embed and active-user footer.

- **Browse-tab active-filter pills (1AM-153)**:
  - Pills row above the count strip when search or action filters are active. Search-pill renders as `NVDA ×`; action-pill as `Buy only ×` / `Sell only ×`. Pill × clears that filter; search-pill body tap returns input pre-filled with current value, focused, cursor at end (edit-affordance).
  - Search-pill swap UX implemented via `isSearchInputMode` flag — input visible until user blurs (Enter / tab / click-elsewhere), at which point it collapses to a pill. Decouples mode-switch from debounce timing so users typing slower than 250ms/char don't get interrupted mid-word (initial implementation triggered the swap on every debounce settle, hotfixed to blur-trigger 2026-05-09).
  - Inline count strip replaced with `<FilterSummaryLine>` — same typography contract as Feed FilterBar.

- **Feed-tab FilterBar typography (1AM-153)**:
  - Replaced bespoke monospace-uppercase label (`24 TRADES FROM THE 4 POLITICIANS YOU FOLLOW`, originally 1AM-66) with `<FilterSummaryLine>` (`24 trades · from the 4 politicians you follow`). Muted gray sentence-case, consistent with Browse-tab.
  - Show-all mode now reads `124 trades · from all politicians` instead of the bare `SHOWING ALL RECENT TRADES`. Communicates magnitude relative to followed-only mode without requiring an explicit population total. Folded from 1AM-151 phase 4 smoke-test feedback.
  - Refresh + Show all/followed buttons unchanged.

- **Browse-tab time-range chips (1AM-152)**:
  - New chip-row above the "More filters →" link: `Past 7d` / `Past 30d` / `Past 90d`. Default `Past 30d`. Reuses `SingleChipGroup` for visual consistency with the Action chip row above it.
  - **"This week" pill removed** (1AM-124 fase 8 quick-toggle). Replaced by the canonical 3-chip row — single source of truth for time-period state, no toggle ambiguity.
  - **`All time` and `Past year` options dropped from the codebase entirely**. `TIME_PERIOD_OPTIONS` slimmed from 5 to 3 entries; `TIME_PERIOD_DAYS` lookup slimmed; `computeSince('all')` early-return removed (unreachable path). If "All time" is needed later, an explicit chip should be added — no hidden enum values restored.
  - **`Time period` section removed from FilterSheet**. The bottom-sheet now contains only Chamber + Sort. `timePeriod` + `onTimePeriodChange` props dropped from FilterSheet. Time-range is canonical state on Browse-tab now, not a sheet-secondary filter.
  - Filter-zone layout: three rows with consistent 8px row-gap inside the chunk (Action chips → Time-range chips → More filters link), 12px section-break to the active-filter pills row below.

- **Browse-tab amount filter (1AM-154)**:
  - New filter dimension: `Any amount` (default) / `≥$15K` / `≥$50K` / `≥$100K` / `≥$500K` / `≥$1M`. Thresholds anchored on STOCK Act PTR reporting trigger ($15K = noise floor) and the institutional-conviction buckets used by Capitol Trades + Quiver.
  - `AMOUNT_OPTIONS` lives in `BrowseAllFilingsScreen.jsx` as a named export with `[{ value, label, threshold }]` shape — single source of truth for FilterSheet chip-group, active-filter pill label, and `visibleTrades` filter logic. FilterSheet imports it directly instead of duplicating constants (avoids value/label/threshold drift across files).
  - Filter applies client-side via `parseAmountMidpoint(t.amount) >= threshold` after chamber + action filters in `visibleTrades` useMemo. Skipped entirely when filter is `any` — no per-trade midpoint parse in default state.
  - Active-filter pill (1AM-153 consumer): renders `≥$50K ×` etc. when not `any`. Pill × clears back to `any`. No edit-affordance — × is sufficient (six discrete options, picker via FilterSheet).
  - `resetFilters` + `hasActiveFilter` extended to include amountFilter alongside the other dimensions.
  - **FilterSheet label "Amount"** (not "Minimum amount") for label-column alignment. The 56px `SingleChipGroup` minWidth column fits CHAMBER + AMOUNT + SORT cleanly; "Minimum amount" overflowed and broke the vertical alignment of chip-rows. Chip values ("Any amount", "≥$15K") communicate the minimum-threshold semantics — the column-label being shorter doesn't lose meaning.

- **Browse-tab trade detail drawer (1AM-70)**:
  - Tap any trade card on Browse-tab → bottom-sheet drawer opens with the full trade context. Replaces the inline-expand pattern for the Browse surface only; Feed-tab and PoliticianDetailScreen TradeCards keep their existing expand behaviour (backwards-compatible via optional `onTradeClick` prop on `TradeCard`).
  - **Header**: avatar + politicus name (Playfair) + chamber-line via `formatChamberLine` (e.g. `Senate · AR`, `House · TX-7`). Cascade fallback when member metadata is missing — `member` lookup → `trade.chamber` → `Member metadata unavailable`. Handles April Delaney / April McClain Delaney name-mismatch (1AM-148) gracefully without crashing.
  - **Bought / Sold block**: action label color-matched (▲ green / ▼ red), oversized ticker in the action color, company name + sector via `lookupSector` (1AM-37 data), amount range, filed-relative line ("Filed 7 days later" — manual first-char capitalisation, not CSS `text-transform: capitalize` which title-cased every word), source attribution `Filed via [Source] · Original disclosure not yet linked` (honest gap-marker until disclosureUrl is wired in 1AM-157).
  - **Action row**: filled-navy `Follow [FirstName]` ↔ outlined `✓ Following` primary CTA + outlined `View all trades` secondary CTA navigating to `PoliticianDetailScreen`. Drawer dismisses automatically before the navigation transition.
  - **Sector tap-to-filter**: when sector data is available, the sector text in the Bought-block becomes a tappable link with a `Tap sector to filter` muted hint below. Tap dismisses the drawer and activates a new sector filter on Browse, surfaced via the active-filter pill row (`Financials ×`). The pill × is the only entry-point to clear the sector filter — no hidden state.
  - **Related filings in [Sector]**: up to 3 other recent trades from the same sector below the action row. Sorted by trade date descending, current trade excluded. Each row shows avatar (initials only) + ticker + action label + abbreviated amount range (`$1K–$15K`, `$250K–$500K`) + trade date. Tap any row to hot-swap drawer content with the new trade — no dismiss-and-reopen animation. Section is hidden entirely (header + body) when no related trades exist or the trade's sector is unknown; drawer bottom-padding stays consistent either way.
  - **Mobile swipe-down dismiss**: drag the grab handle down to dismiss. Combined threshold — drag past 40% of sheet height OR flick past 0.5 px/ms in the last 100ms triggers dismiss; otherwise the sheet snaps back. Both signals reflect intent: distance catches slow long swipes, velocity catches fast flicks; the `OR` avoids false-positives on iOS scroll-bounce and false-negatives on careful slow drags. Desktop unaffected — Esc + scrim-tap remain the dismiss paths.
  - **Drawer scope**: Browse-tab only. PoliticianDetailScreen and FeedScreen TradeCards keep their inline-expand behaviour. If drawer-everywhere is desired, follow-up ticket.

### Out of scope (deferred)

- **Politician headshots in Most Active rows** — depends on 1AM-146.

---

## [0.20.1] — 2026-05-09

Data-layer foundation for the upcoming Browse v3 trade-detail drawer (1AM-150). Sector + company name + district enrichment data is now populated on every trade and politician — silent enrichment, no UI changes yet. Consumers in 1AM-70 (drawer) and 1AM-153 (filter pills) will activate this data when they ship.

PATCH bump because nothing renders differently for users today. The drawer that turns this data into visible UI is the MINOR bump (v0.21.0).

### Added

- **`src/data/sectors.json`** — static lookup table of ~150 ticker-to-sector + companyName mappings, generated from FMP's `/stable/profile` endpoint. Covers ~95% of trades observed in production: top-100 alphabetical S&P 500 constituents (via Wikipedia scrape) merged with all unique tickers from the past 12 months of Congressional filings (via Supabase query).
- **`src/lib/sectors.js`** — pre-built `Map` lookup helper around sectors.json. Exposes `lookupSector(ticker)` returning `{ sector, companyName }` or `undefined` for unknown tickers. Case-insensitive, defensive against non-string inputs.
- **`src/lib/formatChamberLine.js`** — canonical formatter for the chamber-state-district line shown in upcoming drawer headers. Single source of truth for four real-world cases: Senate (`Senate · NY`), standard House district (`House · CA-11`), at-large state (`House · AK-AL`), non-voting delegate (`House · DC` without suffix). Handles all six at-large states (AK, DE, ND, SD, VT, WY) and all six delegate territories (DC, PR, GU, VI, AS, MP).
- **23 Vitest unit tests** for `formatChamberLine` covering all four cases plus defensive inputs (missing fields, lowercase normalisation, unknown chambers). First test suite in the codebase — Vitest now installed as a dev dependency, `npm test` script added.
- **`companyName` field on the Trade typedef** in `src/data/schema.js` — optional string, populated by `normaliseFMPTrade` via sectors.js lookup. Trades for tickers outside the sectors database get an empty string, downstream consumers fall back to ticker-symbol-only display.
- **`scripts/query-top-tickers.mjs`** — Supabase query script that ranks the most-traded tickers in a 12-month window. Strips option-chain suffixes (e.g. `NVDA250117C00150000` → `NVDA`). Runs via `npm run query:top-tickers`. Output committed as `scripts/top-tickers.json` for reproducibility.
- **`scripts/build-sp500-baseline.mjs`** — Wikipedia-scraping script that fetches the S&P 500 constituent list (#constituents table on the article page) and writes the first 100 alphabetical tickers to `scripts/sp500-top-100.json`. Free, no API key required, refreshable.
- **`scripts/fetch-sectors.mjs`** — main enrichment script. Merges archive-tickers ∪ S&P 500 baseline (with overlap deduplication), hits FMP `/stable/profile` per unique ticker, normalises sector strings via a 10-entry GICS-alias map, writes `src/data/sectors.json`. Idempotent + resumable: re-runs skip already-fetched tickers unless `--force` is passed. Tier-aware rate-limiting (350ms between calls on FMP free tier, no sleep on paid).
- **Three new npm scripts**: `query:top-tickers`, `build:sp500-baseline`, `fetch:sectors`, `test`, `test:watch`.

### Changed

- **`normaliseFMPTrade` in `src/data/schema.js`** — now calls `lookupSector(symbol)` to populate `sector` + `companyName` fields. Previously both were always empty strings.
- **`EMPTY_TRADE` template** updated to include `companyName: ''` so consumers reading the empty-state default get a complete shape.
- **Trade typedef** documents `sector` and `companyName` as optional with explicit provenance ("populated by sectors.js lookup when ticker is in our database, empty string otherwise").

### Out of scope (deferred)

- **TradeCard companyName display** — sector + companyName are populated in the data layer but TradeCard renders identically to v0.20.0. Visible consumption ships in 1AM-70 (drawer header) and 1AM-153 (sector filter pills).
- **District field on Politician/Member rendering** — `congress.json` already exposes district per member (1AM-67 / 1AM-98 work), and `formatChamberLine` is ready to consume it. First UI consumer is the drawer (1AM-70).
- **Live FMP enrichment per trade** — sectors.json is static, refreshable manually. Live per-trade FMP profile fetch (Strategy 2 in the original 1AM-37 spec) was deferred — top-150 coverage hits ~95% of real trades, the long-tail can wait.
- **Sector filter UI** — filtering Browse by sector (e.g. "show me all Healthcare trades") is part of 1AM-153 active-filter pills, not this release.
- **Refresh automation for sectors.json** — manual periodic refresh via the npm scripts is fine for v3. CI/CD-driven refresh is a future concern.

### Known limitations

- **3 tickers had no FMP profile data** during the initial fetch: `BF.B`, `BRK.B`, `NFS`. Class-B share symbols use a `.B` suffix that FMP's profile endpoint doesn't accept; the dash form (`BRK-B`) usually works but isn't auto-translated. These trades fall back to ticker-only display until a follow-up adds a symbol-translation step.
- **Top-100 S&P 500 baseline is alphabetical, not market-cap-ranked**. FMP's market-cap-sorted constituent endpoint is paid-tier. Wikipedia returns rows alphabetically. As a result, popular high-cap tickers in the back-half of the alphabet (e.g. TSLA at position ~470, UBER at ~503) are not in the baseline and only get sector-data once they appear in the Congressional archive.
- **Sector aliases hardcoded in `fetch-sectors.mjs`** — 10-entry GICS-to-shortform map. If FMP introduces a new sector label, it passes through unchanged (forward-compatible) but the chip-rendering UI may show an unexpected label until the alias map is updated. Static maintenance, not breaking.

### Related

- 1AM-37 — this ticket
- 1AM-150 — Browse v3 umbrella (this release is sub-ticket #1)
- 1AM-70 — drawer that consumes sectors + district (next sub-ticket)
- 1AM-153 — filter pills that consume sector data (sibling sub-ticket)
- 1AM-67 / 1AM-98 — congress directory + district data (already in production, now fully consumed)
- Lovable mockups: stockactalert-browse-1am28-v1 (drawer-detail header references `House · CA-11` format)

---

## [0.20.0] — 2026-05-08

FollowedList management screen (1AM-28). Replaces the Pad B scroll-anchor placeholder from v0.19.0 — the "Manage who you follow" CTA in the Feed empty-state now lands on a dedicated full-page management surface instead of scrolling to Most Active in Browse-tab. Three variant-states based on follow count (0 / 1-9 / 10+), reusing the threshold convention from v0.19.0's empty-state hero so the two surfaces stay consistent.

The release also makes mute a first-class concept end-to-end. Mute previously existed as a no-op preference state in PoliticianDetailScreen (1AM-69) — the toggle persisted but nothing read it. v0.20.0 wires `mutedPoliticians` through to FeedScreen so muted politicians' trades are filtered out of the Feed in both `Show followed` and `Show all` views, and adds a per-row mute toggle in the high-volume FollowedListScreen variant for quick access. Relationship-preserving suppression: muted politicians stay in the user's follow list, just don't take up Feed real-estate.

Released as MINOR (not PATCH) — new top-level screen, behavioural change for the v0.19.0 CTA destination, new mute filtering semantics in FeedScreen, new persisted user preference (`followedListSort`).

### Added

- **`FollowedListScreen` component** — full-page surface under the Feed-tab, reachable via the "Manage who you follow" CTA in the FeedScreen empty-state. Three variants:
  - **Variant 1 (Following 0)**: three-people SVG icon (matches the empty-zero hero icon from `FeedEmptyHero` for visual consistency), "Pick a few politicians to follow" headline, primary CTA `Browse Most Active →` (Browse-tab + scroll Most Active), secondary CTA `Search by name` (Browse-tab, lands on search bar).
  - **Variant 2 (Following 1-9)**: rows with Avatar (party-color circle, `deriveInitials` fallback), name in Playfair Display, monospace sub-line `chamber · state · N trades` or `chamber · state · no recent activity` for zero-count politicians, filled-navy `✓ Following` toggle pill (right-aligned). Tap-on-row-body navigates to `PoliticianDetailScreen` via the split-mode pattern from `MemberListRow`. `+ Add more` button below the list (full-width, dashed border) → Browse-tab Most Active section.
  - **Variant 3 (Following 10+)**: variant 2 row shape plus per-row mute icon (bell ↔ bell-with-slash SVG) between sub-line and Following toggle. Filter bar above the rows: search input (300ms debounce, clear-button, "No matches in your follows" empty state with Clear action), chamber-tabs (`All N` / `Senate N` / `House N` with dynamic counts; individual tab hidden when its count is 0; auto-fallback to All when active tab's count drops to 0), and sort dropdown (`Most active` default / `Alphabetical` / `Recently added`). Sort persists across sessions via localStorage.
- **Edit mode** in variants 2 and 3 — `Edit` button top-right toggles to `Done` and replaces the navy `✓ Following` pills with red destructive `Unfollow` pills (white bg, `#DC2626` text, red-tinted border — matches the existing pattern in `PoliticianDetailScreen`). Same `onClick` handler under the hood; visual emphasis on destructive intent only. Auto-resets when count hits 0 so state doesn't persist behind variant 1.
- **Mute filtering in `FeedScreen`** — `visibleTrades` now strips muted politicians in both `filterActive` (followed-only) and `showAll` (everyone) views. Mute is the user's explicit "don't show me this person right now" decision and overrides the show-all toggle.
- **`STORAGE_KEYS.FOLLOWED_LIST_SORT`** — new storage key persisting the FollowedListScreen sort preference. Whitelist-guarded (`most-active` / `alphabetical` / `recently-added`); falls back to `most-active` on missing or invalid values.
- **Muted-row visual indicator** — dimmed avatar (opacity 0.45) + small `MUTED` pill badge next to the name. Renders in both variant 2 and variant 3 even though the mute toggle icon is variant-3-only — extends the ticket's strict reading so low-volume users with mutes (set via `PoliticianDetailScreen`) still get a visual cue without leaving the screen.
- **`feedSubScreen` state in `App.jsx`** — overlay-pattern guard (parallel to `detailPolitician`) that swaps FeedScreen for FollowedListScreen while keeping TabBar visible. Tab-tap from FollowedListScreen clears the sub-screen and switches tabs; back from detail-page returns to FollowedListScreen with state preserved.

### Changed

- **`onManageFollowing` handler in `App.jsx`** — rewired from the v0.19.0 Pad B placeholder (Browse-tab + scroll `#most-active-section`) to `setFeedSubScreen('followedList')`. The "Manage who you follow" CTA in the Feed empty-state now opens the dedicated management screen instead of cross-navigating to Browse.
- **`FeedScreen` accepts `mutedPoliticians` prop** with the documented contract that mute applies regardless of the `Show all` filter toggle. Lifted from PoliticianDetailScreen-only consumption (1AM-69) to a Feed-wide filter.
- **App.jsx render-tree** adds a new guard between detail-page and browse-tab: when `activeTab === 'feed' && feedSubScreen === 'followedList'`, FollowedListScreen renders standalone (no global HeaderBar wrapper, since it has its own back-chevron + count + Edit-button header). Order of overlays is now: settings → detail → feed sub-screen → browse-tab → default.

### Out of scope (deferred)

- **`PoliticianDetailScreen` mute-toggle relabel** — the existing toggle reads `Mute alerts` / `Alerts muted`, dating from before mute-affects-Feed semantics shipped. Label is now slightly imprecise (it doesn't just affect alerts) but functionally correct. Relabel deferred to a follow-up — outside 1AM-28 scope.
- **Bulk actions** (`Unfollow all`, `Mute all`) — defer until user-feedback signals need.
- **Undo affordance after Unfollow** — minimal v1; refollow via Browse if mistaken.
- **Confirmation modal for destructive Unfollow** — per ticket open-design-question proposal: skip for v1.
- **Politician headshots** in FollowedList rows — depends on 1AM-146 (theunitedstates.io). v1 uses the existing initials-based Avatar.
- **Dark mode** for FollowedListScreen — depends on 1AM-128 design-token rollout.
- **Animations between variant-states** — visual polish for v2.
- **Spouse/dependent management** — not part of `selected[]` model, separate concern.
- **Onboarding flow that brings new users here** — current onboarding pattern stays.

### Known limitations

- **Trade-count for name-matching-mismatch follows** (e.g. Mark Warner stored as `"Mark Warner"` while FMP returns `"Mark R. Warner"`) reads as 0 in the FollowedListScreen sub-line, so the row shows `no recent activity` even when the politician trades regularly. Affects `MostActivePoliticians` follow-state too. Tracked and scoped under 1AM-148 — fixable at the source (alias map + bioguide-fallback) in a follow-up patch.
- **Sub-line drops the time-window label** — early design referenced "90d" but `useTrades` returns the 50 most recent filings without a fixed-window guarantee. Honest fallback: `chamber · state · N trades` (or `no recent activity` when N=0). Decision rationale in the 1AM-28 phase 1 chat log (2026-05-08).
- **`onSettingsClick` prop on FollowedListScreen is currently unused** — accepted to keep the prop interface stable for a future iteration that may surface a more menu, but no gear icon renders on this screen per the ticket's header layout. Settings reachable via the gear on Feed/Browse/Alerts tabs.

### Related

- 1AM-28 — this ticket
- 1AM-145 — parent ticket (FollowedListScreen replaces the Pad B placeholder for "Manage who you follow")
- 1AM-69 — original mute state + PoliticianDetailScreen toggle. v0.20.0 promotes mute from no-op preference to first-class Feed-filter input.
- 1AM-123 — overarching IA-redesign epic
- 1AM-126 — Alerts MVP (will inherit mute semantics — muted politicians should not trigger alerts when shipped)
- 1AM-146 — politician headshots via theunitedstates.io (Avatar upgrade benefits this screen automatically)
- 1AM-128 — dark mode (deferred soft-blocks dark variant of this screen)
- 1AM-147 — Vercel `v0-stockactalert` project hygiene (surfaced during 1AM-28 phase 1 testing)
- 1AM-148 — Most Active follow-state name-matching desync (surfaced during 1AM-28 phase 1 testing; affects FollowedListScreen sub-line counts too)

---

## [0.19.0] — 2026-05-07

Feed empty-state redesign (1AM-145). User-feedback during 1AM-125 testing described the previous Feed-tab empty experience as "onoverzichtelijk en onlogisch" — a generic "no trades" message that didn't explain *why* it was quiet, didn't reassure that the system was working, and didn't guide the user toward useful next actions. This release replaces that with a three-variant empty-state takeover (metrics strip + hero card + "While you wait — Most Active" embed) based on Lovable's v2 mockup.

The implementation follows Pad B from the design discussion: both empty-state CTAs ("Browse all recent filings" and "Manage who you follow") route to Browse-tab with different scroll-anchors. The `Manage who you follow` destination is a placeholder until 1AM-28 (FollowedList screen) ships — that's when the CTA gets rewired to the dedicated management screen. ~5-line rework when the time comes.

Released as MINOR (not PATCH) — new components, new empty-state UX, behaviour change for users with 0 follows (previously saw "browse mode" with all trades; now see a clean takeover funneling them toward Browse-tab discovery).

### Added
- **`FeedMetricsStrip` component** — three-column metrics display (Following / Window / Last check) rendered inside the Feed-tab empty-state. Em-dash "—" convention for zero-follows (feels like "to be set" rather than "failed"). Window hardcoded to "30d" for v1 (dynamic-window experimentation deferred). Last-check pulls from the existing `lastUpdatedAt` from useTrades, compressed to short form (`1m ago`, `2h ago`).
- **`FeedEmptyHero` component** — variant-aware empty-state hero card. Three variants based on `selected.length`:
  - `empty-zero` (0 follows): three-people SVG icon, "Pick a few politicians to follow" headline, "Browse 535 members of Congress" reassurance with green check, primary CTA "Manage who you follow", secondary "Browse all recent filings"
  - `empty-low` (1-9 follows): green check-circle icon, "All quiet — 0 filings this week" headline, "Following N politicians — all set" reassurance, primary CTA "Browse all recent filings", secondary "Manage who you follow"
  - `empty-high` (10+ follows): same shape as empty-low (separate variant for future tuning)
- **"While you wait — Most Active" embed** in Feed empty-state — reuses the `MostActivePoliticians` component from Browse-tab. Aggregates from already-loaded trades (no separate cascade fetch). Window label "recent" reflects this honestly. Provides discovery bridge to politicians the user might want to follow.
- **`onManageFollowing` prop** on `FeedScreen` — separate CTA destination for the "Manage who you follow" affordance. Currently wired in `App.jsx` to navigate to Browse-tab + scroll to `#most-active-section` (Pad B placeholder); will be rewired to the FollowedList screen when 1AM-28 ships.
- **`id="most-active-section"`** anchor on the Most Active wrapper in `BrowseAllFilingsScreen` — scroll-anchor target for the new `onManageFollowing` handler.

### Changed
- **`FeedScreen.jsx` render-tree** restructured around an `emptyVariant` decision. When `emptyVariant` is set, the screen renders the new takeover (metrics + hero + Most Active). When null, the existing `FreshnessIndicator` + `FilterBar` + `TradeCard` flow renders unchanged. No regression on the trades-present path.
- **`MOST_ACTIVE_TOP_N`, `deriveInitials`, `aggregateMostActivePoliticians`** extracted from `BrowseAllFilingsScreen.jsx` to a new shared lib `src/lib/politicianAggregation.js`. DRY: aggregator changes ripple to both Browse and Feed without duplication. `MOST_ACTIVE_MIN_POLITICIANS` stays in BrowseAllFilingsScreen — it's the cascade threshold, specific to Browse's adaptive-window pattern.
- **Behaviour change for 0-follow users**: previously saw `EmptyFollowedListBanner` above all trades in "browse mode". Now see the new `empty-zero` takeover — no trades render in Feed, user is funneled to Browse-tab via the primary CTA. Browse-tab is a top-level tab since v0.17.0, so the workaround is no longer needed.

### Removed
- **`EmptyFollowedListBanner` function** — replaced by `FeedEmptyHero` variant `empty-zero`.
- **`FilterEmptyState` function** (chip-grid for "filter active + no matches" case) — replaced by `FeedEmptyHero` variants `empty-low` and `empty-high`. The chip-grid pattern is preserved in git history if needed for a future feature.
- **Unused imports** (`CapitolIllustration`) and constants (`CHIPS_INITIAL`) cleaned up after the dead-code removal.

### Out of scope (deferred)
- **Dedicated FollowedList screen** (1AM-28) — the actual destination for "Manage who you follow" CTA. Lovable v1 mockup ready (three states with mute concept). Activates as second consumer of the parked component.
- **Party-letter badges** on Most Active rows — depends on theunitedstates.io YAML integration (1AM-146). Avatar party-color rendering remains unchanged in v1.
- **Filter empty-state chip-grid** — the old chip-grid showed *who* the user follows when filter active + no matches. Removed pending FollowedList screen rebuild.
- **Distinct copy for `empty-high` vs `empty-low`** — both variants share copy at v1. Separated as variants so future tuning can differ (e.g. high-volume users might benefit from "Most active politicians this week" framing).

### Known limitation
The `Manage who you follow` CTA scrolls to Browse-tab Most Active section, which shows top-3 most-active politicians overall — not the user's followed list. This is the intentional Pad B placeholder. Users can still unfollow individual politicians via TradeCard / Politician detail page in the meantime. Fix lands with 1AM-28.

### Related
- 1AM-145 — this ticket
- 1AM-125 — preceding IA-alignment (released as v0.18.0; surfaced the user-feedback that drove this redesign)
- 1AM-28 — FollowedList screen (parked, will replace the Manage-CTA placeholder)
- 1AM-146 — Politician headshot images + party-data via theunitedstates.io
- 1AM-37 — Sector + company name enrichment + klikbare sector

---

## [0.18.1] — 2026-05-07

Small UX-gap fix on Browse-tab Trending Tickers section (1AM-134). Tapping a ticker row in Trending now populates the search input with that ticker symbol and smooth-scrolls to Recent Trades — turning a previously read-only section into a discovery → drill-down affordance. Closes the asymmetry from v0.17.0 where Most Active politicians rows were interactive (Follow toggle) but Trending Tickers rows were dead-ends.

Surfaced 2026-05-05 during 1AM-124 fase 9 testing as a follow-up. Implemented as a PATCH (not MINOR) — no API changes, no new components, no behavioural changes for users who don't tap a ticker row.

### Added
- **Trending Tickers tap-to-filter** (1AM-134) — tap any row in the Trending Tickers section on Browse-tab to populate the search input with that ticker symbol and smooth-scroll to the Recent Trades section. The existing debounced search filter mechanism then narrows Recent Trades to filings for that ticker. Last-action-wins: if the user already had something in the search bar, the ticker overwrites it; clearing happens via the existing X-button in the search bar. Hover state added to ticker rows (warm-cream background `#F5F2E8`, slightly darker border `#D8D5C8`) to signal the new affordance on desktop.

### Changed
- **TrendingTickers.jsx** rows are now `<button>` elements when the parent provides an `onTickerSelect` callback (same visual styling as before, just semantic upgrade for keyboard support — Enter and Space both trigger the tap). Aria-label `"Filter Recent Trades by {ticker}"` added per row for screen-reader clarity. Non-interactive `<div>` rendering preserved as a fallback path when no callback is provided, keeping the component reusable in other contexts.
- **BrowseAllFilingsScreen.jsx** Recent Trades section header (h2) gains `id="recent-trades-section"` as the scroll-anchor target. Pure semantic addition — no visual change.

### Performance & coverage notes
- The 50ms `setTimeout` between `setSearchInput(ticker)` and `scrollIntoView` exists to give React one paint cycle to flush the state update before the scroll fires. Without it the scroll could race the result-count strip update and feel visually jumpy. Empirically reliable on test devices.
- Native `<button>` semantics mean keyboard-only users get tap-to-filter for free (Tab to focus a row, Enter or Space to activate). No additional `tabIndex` or keypress handler needed.
- The existing search debounce (300ms) means there's a small delay between tap and Recent Trades update — same delay users experience when typing in the search bar manually. Consistent UX, not a regression.

### Out of scope (deferred)
- **Dedicated Ticker detail page** — separate feature if user-feedback signals it
- **+Watch toggle per ticker** — would need a watchlist concept; separate ticket
- **Multi-ticker filter** (tap two tickers → show union) — single-ticker overwrite is the v1 model
- **Tap-to-filter by sector** — depends on sector enrichment from 1AM-37

### Related
- 1AM-124 — parent IA-redesign (this fills a gap surfaced during fase 9 testing)
- 1AM-133 — view-mode toggle (By ticker view-mode is the broader version of "show me trades for this ticker"; both can coexist)
- 1AM-37 — sector enrichment (will inform a future tap-to-filter-by-sector pattern)

---

## [0.18.0] — 2026-05-06

Feed-tab and Alerts-tab IA-alignment with Browse-tab (1AM-125, fasen 1+2). Completes the three-tab editorial pattern from 1AM-124 by giving Feed and Alerts the same HeaderBar component (titel-only + gear-icon top-right) that Browse already uses since v0.17.0. Also introduces a small smart-default-routing tweak so first-time users land on a tab with data instead of an empty Feed.

This release deliberately keeps the existing FeedScreen body (filter-bar, TradeCards, FreshnessIndicator, empty states) untouched. The Feed empty-state itself was identified during testing as a separate redesign concern based on user-feedback ("onoverzichtelijk en onlogisch") and split off into its own ticket (1AM-145, Backlog) with a Lovable v2 mockup attached. Shipping IA-alignment now means the Feed empty-state redesign can land later without creating a long-running parallel branch and without delaying v0.18.0.

### Added
- **HeaderBar in Feed-tab and Alerts-tab** (1AM-125 fase 1) — both tabs now use the same `HeaderBar` component that Browse-tab introduced in v0.17.0, with gear-icon top-right that opens the SettingsScreen overlay. Previously these tabs had inline `h1` + description rendered via a `screens` config object in App.jsx; that block is replaced with a single `<HeaderBar title={currentTitle} onSettingsClick={...} />`. Result: identical editorial header pattern across all three tabs (Browse renders it internally, Feed/Alerts wrap it in App.jsx around their respective screens).
- **Smart default-routing** (1AM-125 fase 2) — first-time users with no follows now land on Browse-tab instead of an empty Feed. The `activeTab` lazy initializer now reads `localStorage.ACTIVE_TAB` first (saved tab wins for returning users — backwards compatible), and falls back to `selected.length > 0 ? 'feed' : 'browse'` when no saved tab exists. Eliminates the "I just installed this and the Feed is empty, am I doing something wrong?" first impression for cold-start users.

### Changed
- **Feed-tab title** — `"Your Feed"` becomes `"Feed"`. Possessive ("Your") drops to match the title-only convention shared with `"Browse"` and `"Alerts"`. Editorial consistency across the three tabs.
- **Feed-tab tagline removed** — `"Live congressional trades — filed under the STOCK Act"` no longer renders. Browse has no tagline either; the HeaderBar pattern is intentionally minimal. Tagline content can resurface elsewhere (about page, marketing site) if it adds value there, but not in the tab header.
- **Alerts-tab title** — `"Alerts"` (unchanged), but description `"Your active alerts — get notified on new trades"` removed for the same reason as Feed.

### Removed
- **`screens` config object in App.jsx** — replaced by a smaller `screenTitles` lookup. Description fields had no consumer left after the tagline removal, so the whole config simplifies to title-only.

### Performance & coverage notes
- The smart-routing init reads `STORAGE_KEYS.FOLLOWED_POLITICIANS` from localStorage on first mount when there's no saved tab — same call that the `followedPoliticians` state already makes. Two reads instead of one in the no-saved-tab path; not measurable.
- HeaderBar rendering moves from inline JSX in App.jsx to a child component invocation. Same DOM output, same render cost. Slight win on JSX readability and on Alerts-tab future-proofing (one component touch for header changes instead of two locations).

### Out of scope (deferred)
- **Feed empty-state redesign** (1AM-145) — three-state layout (`Following 0` / `Following 1-9` / `Following 10+`), metrics-strip component, "While you wait — Most Active" embed, party-letter badges. Sourced from user-feedback during testing of fase 1+2 ("onoverzichtelijk en onlogisch"). Lovable v2 mockup attached to the ticket. Estimated ~3-4u when picked up. Held back from v0.18.0 deliberately to keep this release focused on IA-alignment.
- **Alerts-tab MVP** (1AM-126) — Alerts-tab now has a HeaderBar but the screen body is still a placeholder. Real implementation (subscribe to followed politicians, deliver notifications, manage alert preferences) is its own significant scope.
- **Dark mode** (1AM-128) — the HeaderBar pattern works in both light and dark, but theme switching itself needs the broader design-token uitbreiding from 1AM-128 before it can ship safely across all components.
- **Feed → Browse tab-state preservation when navigating back** — currently switching tabs is a hard switch with no pending-state carry-over. Acceptable for v1.

---

## [0.17.0] — 2026-05-05

Major Browse-tab IA-redesign (1AM-124, fasen 1-9). Direct response to user-feedback describing the previous Browse experience as a "doolhof" — unclear bottom-nav icons, no perceived feed structure, scattered filter chip-rows, dead-end information sections. The redesign reorganizes the tab around three vertically-stacked sections (Trending Tickers, Most Active politicians, Recent Trades) and folds secondary filters into a bottom-sheet so the main view stays editorial and scannable.

This release ships nine fases together as one coordinated UX shift; downstream tickets (1AM-133 view-mode toggle, 1AM-134 Trending Tickers tap-to-filter) are deferred to subsequent releases as their scope is genuinely separate.

### Added
- **TabBar simplified to three tabs** — `Feed / Browse / Alerts` (1AM-124 fase 1). Politicians and Settings tabs removed from the bottom nav; their functionality folds into Browse-tab (Most Active section + politicus-detail page) and a new gear-icon overlay respectively. Stale `localStorage.tab` values of `politicians` or `settings` are caught by a `VALID_TABS` whitelist and gracefully fall back to `feed` rather than rendering nothing.
- **HeaderBar component** (`src/components/HeaderBar.jsx`, 1AM-124 fase 3) — minimal reusable component with two props (`title`, `onSettingsClick`). Renders an h1 in Playfair 32px navy plus a 36×36 circle gear-button right-aligned. Replaces the previous `← Back to feed` link + h1 + description on Browse-tab. Shared header primitive for future Feed-tab (1AM-125) and Alerts-tab (1AM-126) work.
- **SettingsScreen overlay** (`src/components/SettingsScreen.jsx`, 1AM-124 fase 3) — full-page overlay with `← Back` chevron + "Settings" h1 + placeholder card. Reached via the HeaderBar gear icon. The overlay is rendered _before_ the trade-detail overlay in App.jsx so the gear remains tappable from any context (including from inside a Trade detail view).
- **Trending Tickers section** (`src/components/TrendingTickers.jsx`, 1AM-124 fase 5) — top-N rows showing ticker + count, hidden when empty. Sits as the first section under the HeaderBar. **Adaptive window cascade** (fase 5b): the section evaluates three time tiers (7d → 30d → all-time) against `TRENDING_MIN_TICKERS = 3` and renders the first tier with enough distinct tickers. Right-side label (`7 days`, `30 days`, `all time`) reflects the tier actually rendered, not a hard-coded copy. With today's young archive (started 2026-05-01) the 7d window is empty and the cascade lands on 30d; users see real data instead of an empty section. Threshold + label transparency together solve the cold-start problem without faking it.
- **Most Active Politicians section** (`src/components/MostActivePoliticians.jsx`, 1AM-124 fase 6) — three rows showing Avatar + name + Chamber·State·trade-count + per-row Follow button (outline `+ Follow` ↔ navy-fill `✓ Following`). Reuses the existing `Avatar` component with party-color rendering and the `findByName` cascade for politicus-name-to-bioguideId resolution (1AM-67/68/109). Same adaptive window cascade as Trending — same three fetched trade sets, independent tier evaluation per section. Threshold `MOST_ACTIVE_MIN_POLITICIANS = 3`. Different sections may land on different tiers (e.g. 30d has enough tickers but only 2 distinct politicians, so Trending shows 30d while MostActive falls through to all-time) and the right-side window label reflects each section's choice.
- **Recent Trades section header** (1AM-124 fase 7) — cosmetic h2 in Playfair 18px navy between the filter row and the result-count strip. Frames the existing filings list as its own named section, parallel to Trending Tickers and Most Active. Deliberately renders without a right-side window label: Recent Trades is filter-driven by user input, not by a fixed cascade window, and a label like "Past 30d" would be tied to a single filter while ignoring Chamber/Action/Sort. The result-count strip below the header (`50 filings shown · From Senate and House · Updated just now`) stays as the live stats for this section.
- **Direction chip row + This week pill + More filters link** (1AM-124 fase 8) — the four-row filter UI (Chamber + Action + Time period + Sort) collapses to a single row: `All / Buy / Sell` chips left-aligned, This week pill right-aligned. A `More filters →` text-link below the row opens the FilterSheet with the secondary filters. The This week pill is a quick-toggle for `past7d` (independent shortcut, single state — last action wins between pill and sheet); see "Changed" below for the Time period default change.
- **FilterSheet component** (`src/components/FilterSheet.jsx`, 1AM-124 fase 8) — bottom-sheet overlay containing Chamber, Time period (5 options), and Sort sections. Backdrop matches the existing politicus-quick-preview BottomSheet (`rgba(13, 27, 42, 0.45)`). Live filtering — chip taps update the parent state immediately and Recent Trades re-renders below the open sheet, no Apply button. Decision-record: built as a separate component rather than refactoring the existing politicus-specific BottomSheet to a generic primitive — the existing component is tightly coupled to a politician quick-preview API (props `politician`, `onFollow`, `onSetAlert`, `onViewProfile`) and a refactor would have widened scope and risked breaking the Politicians-tab. A generic Sheet refactor stays open as a possible follow-up if a third sheet emerges (rule-of-three).
- **Three close-affordances on FilterSheet** — X-button top-right of the sheet header (primary, 18×18 SVG, gray-500 stroke), `Escape` keypress on desktop (via `useEffect` listener with cleanup), tap-outside backdrop (existing). The drag-handle at the top stays decorative; swipe-down gesture is a mobile-native expectation that needs touch event handling and is deferred to a future ticket. User-feedback during fase 9 testing surfaced that backdrop-tap alone wasn't a discoverable close-affordance on desktop — the X-button + Esc combination addresses that without breaking the mobile experience.
- **Proprietary LICENSE file** — copyright 1am-it, all rights reserved. Cleans up "no license" status that GitHub displayed before; signals project posture during the closed development phase. (Repo visibility is independently managed in GitHub Settings.)

### Changed
- **Browse-tab Time period default** changed from `all` to `past30d` (1AM-124 fase 8). Browse is a recency-driven discovery view, and the new top-of-page sections (Trending, Most Active) both surface ~30-day windows via cascade — defaulting Recent Trades to "All time" produced inconsistent vertical signal. `Past 30d` matches the implied window of the rest of the page and avoids overwhelming users with a flat archive dump as the data store matures. `All time` remains one tap away in the FilterSheet. `hasActiveFilter` and `resetFilters` were updated to compare/reset against `past30d` instead of `all` for consistency.
- **Browse-tab filter layout** — the Chamber, Time period, and Sort chip-rows that previously stacked in the main view are now reachable only via the FilterSheet. The main view keeps Action (re-cast as Direction chips: All / Buy / Sell) plus the This week pill plus the More filters link. Reduces the at-rest filter footprint on Browse from four full-width chip-rows + four `LABEL:` headers to a single row + one text-link.
- **App.jsx tab routing** — `VALID_TABS = ['feed', 'browse', 'alerts']`, `isBrowsingAll` state removed (`Browse` is now a top-level tab, not a sub-state), `PoliticiansScreen` import removed. Feed-tab callbacks `onBrowseAll` and `onNavigateToPoliticians` both now resolve to `setActiveTab('browse')`.
- **Browse-tab header** went from `← Back to feed` link + `h1 "Browse All Filings"` + description-line to a `HeaderBar` instance with `title="Browse"`. There's no longer anything to navigate "back" to from a UI perspective since Browse is a top-level tab.

### Removed
- **Politicians tab** from the bottom nav. Functionality is reachable via Browse-tab Most Active section (top-3 with Follow toggle, follow-state shared with the rest of the app) and via politicus names on TradeCards (tap → existing politicus-detail page).
- **Settings tab** from the bottom nav. Replaced by the gear icon in HeaderBar which opens a full-page overlay.
- **Old `← Back to feed` link** at the top of Browse-tab. Browse is no longer a sub-screen of Feed.

### Performance & coverage notes
- The three time-tier fetches that feed Trending Tickers + Most Active are shared between the two sections (one set of 7d + 30d + all-time HTTP calls, two independent aggregations on top). At today's archive size (~94 rows) total Browse-tab cold-start payload is well within `PAGE_SIZE = 25` × 3 calls. As the archive grows the cascade still bottoms-out at `TRENDING_MIN_TICKERS = 3` quickly, so most users will land on a 7d or 30d window and never trigger the all-time tier in steady-state. If the all-time tier becomes the common path (e.g. a multi-year archive), promote the threshold + cascade to a backend `/api/trades/aggregates` endpoint that returns pre-computed top-N per window.
- `FilterSheet` re-mounts the three `SingleChipGroup` instances on every open (the component returns `null` when `!isOpen`). Acceptable for v1 — sheet open/close happens at human pace. If chip components ever carry expensive setup, switch to a CSS `transform: translateY(...)` slide-in pattern that keeps the DOM mounted.
- The Esc-key listener on FilterSheet attaches to `document` while the sheet is open and detaches on unmount or when `isOpen` flips false. Verified no listener leak across open/close cycles via `useEffect` cleanup function.

### Out of scope (deferred)
- **View-mode toggle for Recent Trades** (1AM-133, created during fase 9 testing) — would let users switch Recent Trades between the current chronological list and aggregated views by politician or by ticker. Surfaced when a search for "warner" produced 14 near-identical TradeCard rows. Not in 1AM-124 scope: it's a new feature on top of the redesigned tab, not a refinement of the redesign itself. Lovable v8 mockup exists for the toggle UI as a starting point.
- **Trending Tickers tap-to-filter** (1AM-134, created during fase 9 testing) — Most Active rows are interactive (Follow toggle) but Trending Tickers rows are read-only. Tapping NVDA is a dead-end where users expect filter-narrowing. Filed as separate ticket because it's a new affordance, not a redesign concern.
- **Sector + company-name enrichment** (1AM-37, scope expanded during this release) — both fields come from the same FMP `/company/profile` endpoint and would let TradeCard show "Apr 10 · Technology" and TrendingTickers rows show "NVDA / NVIDIA Corp". Surfaced as a "ticker symbols alone feel thin" observation during fase 5. Backend work, deliberately separate from the IA-redesign.
- **Generic Sheet primitive** (refactor of `BottomSheet.jsx` to a content-as-children pattern with a shared backdrop + slide-in container, plus extracting the politicus quick-preview to its own `PoliticianPreview` component). Considered as architecture-option B during fase 8; deferred because the rule-of-three hadn't fired yet. If a third sheet appears (e.g. trade-detail sheet, share sheet) the refactor is justified.
- **FilterSheet swipe-down close gesture** — mobile-native expectation that needs touch event handling. The drag-handle at the top of the sheet is already drawn as a visual hint; wiring the actual gesture is a focused mobile-UX ticket.
- **Persistence of FilterSheet selections + view-mode across sessions** — for now state lives only inside `BrowseAllFilingsScreen` lifecycle. Add `localStorage`-backed persistence if user-feedback signals it.
- **Time period chip labels** — the in-sheet chips use rolling-window labels (`Past 7d / Past 30d / Past 90d / Past year / All time`) consistent with the existing `useTrades({ since })` query semantics. Lovable's mockup proposed kalender-window labels (`This week / This month / Last 3 months / All time`) which are conceptually different (calendar-aligned vs. rolling). Going kalender-window would require a `useTrades` semantic rewrite outside 1AM-124 scope. The `This week` pill on the main view keeps the kalender-flavoured copy as a friendly shortcut while the implementation behind it is `past7d`; this small label-vs-implementation mismatch was an explicit design choice.

---

## [0.16.1] — 2026-05-03

### Added
- Politicians-tab Activity chip-row (1AM-106) — single-select date-range filter with `Any time` (default) / `Past 7d` / `Past 30d` / `Past 90d`. When active, both the Following and Browse sections narrow to members with at least one trade in the chosen window. Implements the design originally paused in 1AM-106 awaiting 1AM-108's data-source recommendation; unblocked by the Supabase archive shipping in v0.15.0.
- New `useActivePoliticians(since)` hook — fetches `/api/trades?since=...&limit=500`, cascades each `trade.politician` through `findByName` (1AM-67/1AM-109 name-resolution), returns a `Set<bioguideId>` for O(1) membership tests in the Politicians-tab filter pipeline. Returns `null` when `since` is falsy so consumers can short-circuit when the chip is on `Any time`.
- "X follows hidden by activity filter" affordance — when one or more followed members are excluded by the active Activity chip, an italic line appears under the Following section (or as a centred message replacing the section header when all follows are hidden), so the user knows their follows haven't been forgotten.
- Context-aware Browse-section empty state on Politicians-tab — when the Activity chip is the sole non-default filter and matches zero members, the empty state reads `No politicians active in past Nd / Try a wider window — ...` instead of the generic "Try fewer filters" copy. Suggests the next-wider window: Past 7d → Past 30d/90d, Past 30d → Past 90d, Past 90d → Any time.
- `Past 7d` chip on the Browse Time period row — keeps the Browse and Politicians chip-sets consistent. Browse v0.16.0 shipped without it; surfaced as an inconsistency during 1AM-106 testing.

### Changed
- Politicians-tab `clearAllFilters` resets the Activity chip to `Any time` alongside Chamber, Party, and search.
- `isFiltered` predicate on Politicians-tab now also considers `activity !== 'any'` so the Clear filters affordance appears when only the Activity chip is active.

### Removed
- `sortTradesByDate` re-sort call from `api/trades.js` (1AM-117). The Supabase `ORDER BY trade_date DESC` is canonical; the client-side helper sorted by `filedDate desc` and partially undid the sort intent set in v0.16.0. The helper itself stays exported in `src/data/schema.js` and is still used by `api/trades/by-politician.js`.

### Fixed
- FMP, Finnhub, and Unusual Whales trade `id` templates now all include the amount/range as a discriminator (1AM-118, complementing the FMP fix in v0.16.0). Prevents two trades on the same day from the same politician for the same ticker but different amount tranches from being collapsed into one by React's `key=` deduplication when those data sources are reactivated.

### Performance & coverage notes
- The `useActivePoliticians` hook fetches up to 500 archive rows per Activity chip change. With ~94 archive rows today and ~5 days of history, this is ample. Past 90d / Past year accuracy starts to degrade once the archive grows beyond ~5x the current size — at that point promote to a backend `/api/politicians/active` aggregation endpoint (DISTINCT on `politician_name` server-side). Tracked as a follow-up consideration; not blocking for current scale.
- Activity chip semantically filters on `trade_date` (consistent with the Browse Time period chip from v0.16.0). A trade executed in March but filed last week appears in the Browse feed but is excluded from `Past 7d`. This is intentional: "active in the last N days" should mean "executed", not "appeared in our feed".

### Out of scope (deferred)
- Per-source name-resolution audit for Stock Watcher and other future sources — `findByName` cascade works against `congress.json`, but new sources may surface name-format edge cases that require additional `name-overrides.json` entries. Tracked under the existing 1AM-109 audit pattern.

---

## [0.16.0] — 2026-05-02

### Added
- Browse All Filings now consumes the Supabase archive end-to-end (1AM-114). Three user-visible features ship together:
  - **Time period filter chip-row** — single-select chips `[All time]` (default) `[Past 30d]` `[Past 90d]` `[Past year]`, sits between Action and Sort. Sends `since=YYYY-MM-DD` to `/api/trades`, filters server-side on `trade_date >= since` (a trade executed 60 days ago but filed yesterday is correctly excluded from "Past 30d").
  - **Load more button** — outlined navy, full-width, paginates through the entire archive in 50-row batches via the `offset` query param. Shows `Loading…` (60% opacity) during in-flight fetch. When the last batch returns less than 50 rows the button is replaced by an italic `Start of archive · May 1, 2026` line.
  - **Footer copy** — `Showing the latest N filings · earlier history coming soon` becomes `N of TOTAL · since May 2026`. TOTAL is fetched once from the new `/api/trades/stats` endpoint; if the stats fetch fails the footer falls back to a count-only copy.
- `/api/trades/stats` endpoint — lightweight Edge Function returning `{ total, archiveStartDate, timestamp }`. Exact count via Supabase `head:true, count:'exact'`. Same CDN cache posture as `/api/trades` (1h fresh, 2h SWR). Hardcoded `ARCHIVE_ACTIVATION_DATE = '2026-05-01'` constant; update both this constant and the matching frontend label if the archive ever migrates to a new backing store.
- TradeCard Variant A — bottom-right "FILED" cell now combines the trade date with the filing delta inline: `May 1 · filed 4 days later`. Late-filing amber cue (`#D97706` on >30 day delays) preserved. Applied globally so Personal feed, Discovery, Browse, and Politician detail all gain visual confirmation of the date the user is looking at.
- Two new helpers in `src/lib/dates.js`: `formatShortDate(YYYY-MM-DD)` returning `"May 1"`, and `formatFiledRelative(filedDate, tradeDate)` returning `"filed N days later"` form (sister to existing `formatFiledDelta`).

### Changed
- `/api/trades` `since` query param now filters on `trade_date` instead of `filed_date` (1AM-114 decision). Reasoning: a chip labelled "Past 30 days" should mean "trades executed in the last 30 days", not "trades filed in the last 30 days" — otherwise the chip lies. Filed-date is still relevant for the late-filing amber cue and the inline `· filed N days later` text on TradeCard.
- `/api/trades` default sort changed from `filed_date desc` to `trade_date desc` so the visible card order matches the filter semantics.
- FMP trade `id` template now includes `amount` (`fmp-{name}-{ticker}-{date}-{amount}`) so two trades on the same day from the same politician for the same ticker but different amount tranches (e.g. spouse account) get distinct ids. Was a real-data issue: 2 of 94 archive rows were collapsed into 1 by the old id-template.
- `useTrades` hook accepts `filters.since` and forwards it to `/api/trades`. Existing consumers (FeedScreen, DiscoveryFeed) unchanged — they don't pass `since`, behaviour identical.

### Removed
- `deduplicateTrades(...)` wrapper call in `api/trades.js`. The helper deduplicated on `politician + ticker + tradeDate`, narrower than the Supabase unique index `(politician_name, ticker, trade_date, amount_low, amount_high)`. The wrapper was a v0.13.x-era safety net for the FMP-direct read path; redundant and incorrect now that uniqueness is guaranteed at the DB layer. The helper itself stays exported in `src/data/schema.js` for backward compatibility with anything outside this read path.

### Out of scope (deferred)
- `sortTradesByDate` in `api/trades.js` re-sorts by `filed_date desc` after the `trade_date desc` SQL order, partially undoing the new sort intent. Visually invisible because filed-date and trade-date correlate strongly (typical filing-delays 0–7 days), but worth fixing as schema hygiene. Tracked separately for v0.16.1 or v0.17.0.
- `normaliseFinnhubTrade` and `normaliseUnusualWhalesTrade` use the same amount-less id-template as the pre-fix FMP function. Not in active use (FMP is primary), so not patched in this release. Apply the same fix when those sources are reactivated.
- Reusable Browse pagination via the `useTrades` hook itself. For now, pagination state lives locally in `BrowseAllFilingsScreen` because no other consumer needs it. Promote to the hook when the second consumer (e.g. PoliticianDetailScreen deep history) materialises.

---

## [0.15.0] — 2026-05-02

### Changed
- `/api/trades` now reads from the Supabase `filings` archive instead of calling FMP `senate-latest` + `house-latest` directly on every request (1AM-113 phase 6). Response shape is byte-identical to the FMP-direct version — the same `normaliseFMPTrade` function reconstructs trades from the preserved `raw_data jsonb` column. Frontend requires no changes. Filtering moved into the Supabase query (`eq` for ticker, `ilike` for politician name, `gte` for date) instead of post-fetch JS filtering — leverages DB indexes and reduces data-over-wire.
- `/api/trades` no longer reads `FMP_API_KEY` from its environment. The endpoint never touches FMP directly anymore — only the daily cron (`scripts/cron-fetch-trades.mjs`) consumes the key. Slight security-surface reduction. (`/api/trades/by-politician` still calls FMP directly and continues to use `FMP_API_KEY`; the env var stays in place project-wide.)
- Failure mode: hard 503 `Archive temporarily unavailable` if Supabase is unreachable. No fallback to FMP — clean failure signal preferred over hidden degradation pre-launch. To revisit before 1AM-50 marketing launch when uptime expectations rise.

### Added
- `/api/trades` accepts two new optional query params, both backwards compatible (frontend that doesn't pass them gets identical behaviour to before):
  - `offset` (default 0) for pagination — unblocks Browse `Load more` in 1AM-114.
  - `since` (YYYY-MM-DD format, validated) for date-range filtering — unblocks Browse date-range chip in 1AM-114.
- `MAX_LIMIT = 500` sanity cap on the `?limit=N` query param.
- DB-vs-frontend `chamber` mapping: DB stores `chamber` lowercase (`'senate'` | `'house'`) per Postgres convention; `CHAMBERS` constant in `src/data/schema.js` is Title Case (`'Senate'` | `'House'`) per frontend convention. New `CHAMBER_MAP` constant in `api/trades.js` is the single translation point. Documented so future readers don't introduce a third convention.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` Vercel project-level env vars (Production + Preview + Development).

### Out of scope (deferred)
- Browse `Load more` button — 1AM-114, was blocked on this rewire, now unblocked.
- Browse date-range filter chip — 1AM-114, same as above.
- Footer messaging update from `Showing the latest N filings · earlier history coming soon` to `Showing N of total filings · since [activation date]` — 1AM-114.
- Soft fallback to FMP when Supabase is down — revisit before 1AM-50 launch.

---

## [0.14.1] — 2026-05-02

### Added
- Supabase `filings` table — historical congressional trades archive (1AM-113 backend phase). Composite unique index on `(politician_name, ticker, trade_date, amount_low, amount_high)` provides idempotent dedup; bookkeeping indexes on `filed_date desc`, `bioguide_id`, and `chamber` cover read paths. `raw_data jsonb` column preserves the full FMP payload for future enrichment without re-fetching. Service-role-only access (RLS disabled). Seeded with the latest 50 trades from `senate-latest` + `house-latest`.
- `scripts/lib/archive-helpers.mjs` — shared module with `loadConfig`, `getSupabaseClient`, `fetchChamber`, `mapToRow`, `upsertTrades`, `getArchiveCount`, `parseAmountRange`, and `resolveBioguide`. Single source of truth for the FMP-to-Supabase ETL path.
- `scripts/seed-archive.mjs` — one-time entry point for seeding the archive. Idempotent: re-running is a no-op thanks to the composite unique index.
- `scripts/cron-fetch-trades.mjs` — daily entry point. Structured ISO-timestamped logs for GitHub Actions readability, partial-success tolerance (one chamber failing logs a warning but doesn't fail the run; both failing exits 1), explicit exit-code signalling.
- `.github/workflows/refresh-archive.yml` — GitHub Actions workflow that schedules `cron-fetch-trades.mjs` daily at 06:00 UTC, with `workflow_dispatch` manual trigger. Three repository secrets required: `FMP_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `@supabase/supabase-js` runtime dependency.

### Changed
- Internal-infrastructure release — no user-visible UI changes. `/api/trades` continues to read directly from FMP; the Supabase archive accumulates in the background.

### Out of scope (deferred)
- `/api/trades` rewire to read from Supabase — ships with 1AM-114 frontend work as v0.15.0.
- Browse `Load more` and date-range filter — tracked in 1AM-114, blocked on this archive being live and the API rewire.

---

## [0.14.0] — 2026-04-30

### Added
- `src/components/BrowseAllFilingsScreen.jsx` — dedicated screen for browsing all recent STOCK Act filings beyond the user's followed politicians (1AM-112). Page-style header with `← Back to feed` link + Playfair "Browse All Filings" title, single-input search (politician name OR ticker symbol — uppercase 2–5 chars detected as ticker, sent as `?ticker=...`; otherwise sent as `?politician=...`), single-select chamber + action filter chips, single-select sort chips (`Newest` / `Largest amount`), freshness pill reusing 1AM-38 logic, result count, honest "earlier history coming soon" footer, and reset-filters recovery in the empty state. Reachable from the Personal feed `Show all` button and from the FilterEmptyState recovery CTA (1AM-111).
- `src/components/SingleChipGroup.jsx` — single-select variant of the existing `ChipGroup` pattern. Always has a selected value (defaults to "All"), used for filters where one option must be active. Visually identical to `ChipGroup` for consistency.
- `App.jsx` overlay routing for Browse — new `isBrowsingAll` boolean state, mirrors the `detailPolitician` overlay pattern. While true, BrowseAllFilingsScreen renders full-screen with no TabBar.
- "Largest amount" sort uses an inline copy of the `parseAmountMidpoint` helper from `PoliticianDetailScreen` (TODO: extract to `src/lib/amountParse.js` when the helper is touched again — kept inline for delivery scope).

### Changed
- Personal feed `Show all` FilterBar button no longer toggles the in-place filter — it now navigates to BrowseAllFilingsScreen. The previous toggle behaviour is deprecated; users get the dedicated browse experience instead. Fallback to the in-place toggle is preserved for callers that don't wire `onBrowseAll`.
- FilterEmptyState `View all recent filings` CTA (1AM-111) now routes to BrowseAllFilingsScreen as originally intended. Fallback wiring kept for safety.

### Out of scope (deferred)
- Search by company name (e.g. "Nvidia", "Apple") — requires ticker→company mapping that doesn't exist yet.
- `Load more` pagination — blocked on 1AM-108 (Stock Watcher migration).
- Date-range filter — blocked on 1AM-108.
- Historical filings beyond the FMP free-tier 50-trade window — tracked in 1AM-113.
- Compact TradeCard variant — uses existing TradeCard for consistency.

---

## [0.13.3] — 2026-04-30

### Added
- `src/components/CapitolIllustration.jsx` — minimal SVG illustration of the US Capitol (1AM-111). Soft `#E5F0FF` circle background (matches Politicians-tab blue), navy `#0D1B2A` building elements at 25/35/55% opacity. Decorative-only, sized via `size` prop (default 140px). Reusable for future surfaces (Settings/About, FAQ).

### Changed
- Personal feed empty state redesigned (1AM-111): Capitol illustration anchors the card, headline reframed to `No recent filings for the politicians you follow` (Playfair, navy), and a new 45-day disclosure-window explainer addresses the "is the app broken?" question directly. Replaces the previous `None of your followed politicians have recent filings.` headline + body pair. Following pills, Manage link, and recovery CTA all preserved.
- Empty-state Manage link: `Manage politicians →` → `Manage followed politicians →` (per mockup).
- Empty-state CTA: `Browse all trades` → `View all recent filings` (per mockup). Underlying behaviour unchanged — falls back to `onShowAll` toggle until 1AM-112 (Browse page) ships, at which point the CTA will route there instead.

---

## [0.13.2] — 2026-04-30

### Added
- `src/lib/relativeTime.js` — `formatRelativeTime(ts)` ("just now" / "5 min ago" / "2 hours ago" / "yesterday" / "N days ago" / locale date) and `getStaleness(ts)` ('fresh' ≤ 4h / 'stale' 4–24h / 'old' > 24h). Thresholds aligned with Vercel CDN cache (s-maxage=3600, swr=7200) so the indicator doesn't flicker on cache-revalidate.
- `src/components/FreshnessIndicator.jsx` — at-a-glance freshness signal rendered between the page title and FilterBar on Personal feed (1AM-38). Shows: optional dot (amber when stale, grey when old, **no dot when fresh** per design decision), `Latest publicly available filings` label, optional `N new` badge when refetch surfaces unseen trades, and `Updated X ago` pill right-aligned. Auto-ticks every 60s so relative-time updates without user interaction.
- `useTrades` hook now exposes `lastUpdatedAt` (ms-epoch of last successful fetch) and `newTradeCount` (id-delta from previous fetch, 0 on first load).

### Changed
- Personal feed italic subtitle shortened from `Latest STOCK Act filings from Senate + House` to `From Senate and House`. The "latest" framing is now carried by the freshness indicator above, so the older copy was redundant.

---

## [0.13.1] — 2026-04-30

### Changed
- Discovery feed (1AM-66): trade list capped at 3 preview items (was 50). Anonymous visitors get a credibility check, not a browsing experience. Trailing hint reads `+ N more filings` and is computed from the live trade count, only shown when there's more than the preview window.
- Onboarding flow simplified: Discovery → Pick politicians (was Discovery → Welcome → Explainer → Pick). Welcome + Explainer became redundant once Discovery already shows real STOCK Act filings on first paint. The "Select politicians →" CTA now lands directly on the picker. Back button on the picker returns to Discovery.

### Removed
- `src/components/OnboardingWelcome.jsx` deleted — generic "See what Congress trades" pitch fully replaced by Discovery's real-data landing. No content carried forward.
- `src/components/OnboardingDataExplainer.jsx` deleted — three content blocks (STOCK Act intro, update cadence, ranges-not-exact) tracked in 1AM-110 for migration to trade-detail page (1AM-70) and a future Settings/About surface. Recoverable via `git show f282554:src/components/OnboardingDataExplainer.jsx`.

---

## [0.13.0] — 2026-04-30

### Added
- `src/components/DiscoveryFeedScreen.jsx` — public anonymous landing showing the live trade feed without onboarding (1AM-66). First-time visitors see real STOCK Act filings before being asked to follow politicians. Centered Playfair header, navy-outlined CTA card with green "Select politicians →" button, "RECENT STOCK ACT FILINGS" section, full unfiltered trade list. No tab bar, no filter chips, no detail-page navigation — anonymous mode is read-only by design.

### Changed
- App.jsx routing: first-time visitors land on Discovery feed (`onboardingStep === 'discovery'`) instead of OnboardingWelcome. CTA advances to 'welcome' which preserves the existing welcome → explainer → pick-politicians → done chain. Returning users (with `STORAGE_KEYS.ONBOARDING_DONE = true`) bypass Discovery and land directly on Personal feed.
- FeedScreen FilterBar label now includes the followedCount explicitly: `5 TRADES FROM THE 17 POLITICIANS YOU FOLLOW` (was `5 RECENT TRADES FROM POLITICIANS YOU FOLLOW`). Singular/plural handling preserved for both numbers.

---

## [0.12.2] — 2026-04-30

### Added
- `src/data/name-overrides.json` — manual alias map for stubborn upstream politicus names that don't resolve via the cascading `findByName` match (1AM-109). Entries under `"_overrides"` are keyed on raw upstream name → bioguideId. File ships empty; populate as `audit:names` surfaces real mismatches.
- `findByName` in `src/lib/congress.js` consults overrides BEFORE the cascade match (1AM-109). Default-pool calls only — explicit-pool calls skip overrides for predictability. Normalisation (lowercase + diacritic-strip) applied to both keys and queries so the JSON file stays human-readable.
- `scripts/audit-trade-names.mjs` — observability tool that fetches recent trades and reports unique politicus names that don't resolve against the directory (1AM-109). Two fetch modes: `via-api` (production endpoint, default) and `direct-fmp` (fallback when deployment-protection blocks the API). Output: `unmatched-trades.json` at repo root, gitignored. Run with `npm run audit:names`.

### Changed
- Internal-quality release — no user-visible UI changes. Bug-detection infrastructure for the name-resolution path.

---

## [0.12.1] — 2026-04-30

### Changed
- Politicus location label spelled out across Politicians-tab list and detail-page header (1AM-102): `D · CA-11 · House` → `D · California · House`. State abbreviation expanded to full name; congressional district number dropped from these surfaces (district is power-user signal, not feed scan-content). Senate members (no district to begin with) get the same full-state-name treatment.

### Added
- New `src/lib/states.js` with `STATE_NAMES` map (50 states + DC + 5 inhabited US territories) and `fullStateName(code)` helper. Case-insensitive lookup, graceful fallback to original code on miss.

---

## [0.12.0] — 2026-04-30

### Changed
- TradeCard visual hierarchy refresh (1AM-86, closes 1AM-36):
  - **AMOUNT** promoted to primary signal — 14px / weight 700 (was 12px / 600), navy `#0D1B2A`
  - **FILED** replaced with derived "N days after trade" delta — `same day` / `1 day after trade` / `N days after trade`
  - Late-filing visual cue: amber `#D97706` text when delta exceeds 30 days (STOCK Act gives 45-day window; >30 is leading indicator)
  - **SOURCE** moved out of main bottom-row into expanded view — power-user concern, kept accessible without taking primary visual space

### Added
- New `src/lib/dates.js` with three pure helpers — `daysBetween`, `formatFiledDelta`, `isLateFiling` — and `LATE_FILING_THRESHOLD_DAYS = 30` constant. Robust to missing/bogus input (returns null on bad data).

---

## [0.11.1] — 2026-04-29

### Added
- GitHub Actions workflow `.github/workflows/refresh-congress.yml` for automated weekly refresh of the Congress directory (1AM-98). Runs every Monday 09:00 UTC + manual `workflow_dispatch` trigger; opens a PR against `dev` (no auto-merge) when `congress.json` changes. No repo secrets required.

### Changed
- Refactored `scripts/fetch-congress.mjs` to single-source (`unitedstates/congress-legislators` only) (1AM-98). Drops the Congress.gov API key requirement, pagination, and source-join logic — `legislators-current.json` is by construction the "currently serving" set, so the Congress.gov filter was redundant. Output (`congress.json`, `congress.fixture.json`) is byte-identical to the hybrid version on the cutover run.

---

## [0.11.0] — 2026-04-28

### Added
- **Deep historical backfill for politician detail page** — `/api/trades/by-politician` Vercel Edge endpoint queries FMP's per-politician Senate + House endpoints in parallel, returning up to 200 historical trades per politician (24h CDN cache, 48h stale-while-revalidate). PoliticianDetailScreen now uses this for richer data depth instead of the latest-50 feed slice (1AM-30)
- New `useTradesByPolitician(name)` hook in `src/hooks/` — same shape as `useTrades` (trades / loading / error / refetch), fetches on mount, AbortController cleanup, refetches when politicianName changes
- Sparkline auto-scales window to data depth: ≥20 trades → 12 monthly bars over 365d, otherwise stays at 13 weekly bars over 90d (signals "rich" vs "thin" data without UI clutter)

### Changed
- PoliticianDetailScreen: three-state data fallback so the page never goes empty — deep fetch result preferred → fallback to feed-level `trades` prop filtered locally → empty-state cards if both unavailable
- Stats card label adapts to active sparkline window: "X trades · 90d" or "X trades · 12mo (Y in 90d)" depending on data depth
- Stats card shows graceful "Showing recent feed trades only — full history unavailable" message when deep fetch errors out — falls back to feed data automatically

### Planned
- GitHub Actions weekly Congress-directory refresh workflow + localStorage bioguideId migration (1AM-67 Phase C)
- Reusable FollowedList component (1AM-28)
- TradeCard visual hierarchy refresh — amount prominence + de-emphasize source (1AM-86, supersedes/closes 1AM-36)

---

## [0.10.0] — 2026-04-28

### Added
- **Politician detail page** — full-screen drilldown reached from any clickable politician name (1AM-69):
  - Header: politician name, chamber/party/state/district meta line, "← Back" navigation
  - Action buttons: Follow/Unfollow toggle (red-outline when followed) + Mute alerts toggle (persisted, no-op until alert system in 1AM-71)
  - Stats card: trade count over 90 days + 13-week activity sparkline (teal bars, count-per-week scaled to max)
  - **Net positions** section (renamed from "Estimated holdings" for honesty — STOCK Act data is range-based, "holdings" overclaimed): cumulative buys minus sells per ticker using midpoint estimates, only positions with positive net are shown, with disclaimer that actual portfolio is not disclosed
  - Trade history: all trades for this politician, sorted most-recent first, with owner badges and Following pill
- `mutedPoliticians` state in App.jsx, persisted to `saa.mutedPoliticians.v1` localStorage key, ready to be wired into alert delivery in 1AM-71

### Changed
- TradeCard politician name is now a clickable link when `onPoliticianClick` is provided — navigates to the politician's detail page (subtle gray underline, no other styling change) (1AM-69)
- `MemberListRow` supports a new `onClickRow` mode: when set, the row body navigates while only the trailing selection indicator toggles follow — used in Politicians tab so users can drill in without accidentally unfollowing (1AM-69). Onboarding picker keeps the legacy "tap-anywhere-toggles" behaviour (no `onClickRow` passed)
- App.jsx routing: when `detailPolitician` state is set, renders `PoliticianDetailScreen` as a full-screen overlay instead of the active tab content. TabBar remains visible — tapping a tab closes the overlay and switches tabs

---

## [0.9.0] — 2026-04-27

### Added
- TradeCard: green-soft "Following ✓" pill next to the politician name when the user follows them — visual confirmation that this card matches the user's interest (1AM-65)
- TradeCard: coral-soft owner pill (`spouse` / `joint` / `dependent`) when a trade is on a non-self account — surfaces the STOCK Act Owner field that was previously hidden, so users can correctly attribute the investment decision (1AM-65)
- Trade schema: new `owner: 'self' | 'spouse' | 'joint' | 'dependent'` field, plus `OWNERS` constant and `normaliseOwner()` helper that maps source-specific codes (FMP `SP`/`JT`/`DC` style) and full-word variants to the internal value
- All three normaliser functions (FMP, Finnhub, Unusual Whales) populate the `owner` field; defaults to `'self'` for empty / unknown values

### Changed
- `FeedScreen` passes `following` and `owner` props to each `TradeCard` — `following` is computed from the `followedPoliticians` membership of the trade's politician (works correctly in both filter-active and browse modes)

---

## [0.8.1] — 2026-04-27

### Added
- Feed: chips in the filter empty-state are now interactive — each chip has an inline × button to unfollow that politician without leaving the Feed (1AM-80)
- Feed: "Manage politicians →" link below the chip-grid jumps directly to the Politicians tab for full-list management (1AM-80)

### Changed
- Politicians-tab subtitle nudges users toward the Feed: `"Tap to follow or unfollow"` → `"Tap to follow or unfollow — see trades in your Feed"` (1AM-83)

---

## [0.8.0] — 2026-04-27

### Added
- Full Congress member directory imported into the app (~536 current members across Senate + House) (1AM-67):
  - New `Member` schema in `src/data/schema.js` (Bioguide ID as canonical primary key, plus name parts, chamber, party, state, district/senateClass, term dates, crosswalk IDs)
  - `scripts/fetch-congress.mjs` — hybrid fetcher: Congress.gov API as authority + `unitedstates/congress-legislators` GitHub for rich schema. Outputs deterministic `src/data/congress.json` (full directory, ~264 KB) and `src/data/congress.fixture.json` (20-member dev fixture)
  - npm script `fetch:congress` for manual refreshes
  - Helpers in `src/lib/congress.js`: `findByBioguide`, `findByName` (case-insensitive, diacritic-tolerant, ranked exact > prefix > substring, matches firstName/lastName/officialFull/nickname), `filterByChamber`, `filterByParty`, `filterByState`, `applyFilters` (combined), `getSuggested` (8 hand-picked high-profile members)
- Onboarding picker rewritten to handle the full ~540-member directory (1AM-79):
  - Debounced search bar (150ms) with case-insensitive name + nickname matching (e.g. `bernie` → Sanders)
  - Filter chips: Chamber (Senate/House) + Party (D/R/I), multi-select, AND between groups + OR within
  - "Suggested for you" section with 8 high-profile members, only visible when no filters/search active
  - Native CSS virtualization (`content-visibility: auto`) — smooth scroll on 540 rows without adding `react-window` dependency
  - "Clear filters" button in Results header, only visible when filters are active
  - Auto-clear filters when adding a follow (preserves filter context when removing)
  - Empty state when filters yield 0 matches
- Politicians-tab redesigned for the full directory (1AM-68):
  - Header shows "Following N of 536"
  - Same search bar + filter chips as the onboarding picker (shared components)
  - Two sections: "Following" (top, member rows the user already follows) + "Browse all" (bottom, everyone else)
  - Per-section count, "X of Y" notation when filters are active
  - Empty states tailored per situation: search-no-match vs "you follow everyone here"
- Shared picker components (1AM-68):
  - `SearchBar` — reusable input with magnifier glyph + clear button
  - `ChipGroup` — multi-select pill bar with ARIA pressed state
  - `MemberListEmptyState` — pluggable title + message
  - `MemberListRow` — single politician row with avatar + meta + selection toggle
- Feed: empty-followed-list recovery banner (1AM-42) — when a returning user has unfollowed everyone, the feed now shows a "You're not following anyone yet" banner above browse-mode trades, with a "Choose politicians →" CTA that jumps to the Politicians tab. The browse-mode feed remains visible below so users can still explore while deciding.

### Changed
- Replaced `PoliticianPickGrid` (curated 22 grid layout) with vertical list rows across both onboarding and Politicians-tab (1AM-68)
- `App.jsx` hydrates `followedPoliticians` through a name-alias migration so existing users following "Bernie Sanders" or "Shelley Moore Capito" carry over correctly to the directory's `firstName + lastName` convention (Bernard Sanders, Shelley Capito)
- Feed scope subtitle dropped misleading hardcoded "50" — now reads "Latest STOCK Act filings from Senate + House" (was "Latest 50 …"). The literal number leaked an arbitrary `DEFAULT_LIMIT` cap and was often inaccurate after dedup (1AM-81)

### Removed
- `src/components/PoliticianPickGrid.jsx` — superseded by `MemberListRow` + section layouts
- `src/data/curatedPoliticians.js` — superseded by full Congress directory at `src/data/congress.json`

### Notes
- localStorage `saa.followedPoliticians` is migrated transparently on first hydration after upgrade — no user action needed
- Bundle size grew to ~417 KB raw / ~103 KB gzipped (was ~150 KB) due to the embedded directory JSON; first-load delta on a typical mobile connection is negligible thanks to gzip + CDN caching

---

## [0.7.4] — 2026-04-27

### Changed
- Filter-bar label clarified to remove unit-mixing ambiguity (1AM-52):
  - `"N RECENT TRADES FROM YOUR M"` → `"N RECENT TRADES FROM POLITICIANS YOU FOLLOW"`
  - The previous label visually read like a ratio (`15 / 17`) but mixed units (visible trades vs followed politicians); the new label drops the followed count and uses explicit prose
- Singular handling preserved (`1 RECENT TRADE FROM POLITICIANS YOU FOLLOW`)

---

## [0.7.3] — 2026-04-27

### Added
- Active tab now persists to localStorage so reopening the app returns you to your last-visited tab (1AM-60)
- New `STORAGE_KEYS.ACTIVE_TAB` constant + tab-name whitelist guards against stale or corrupted localStorage values

---

## [0.7.2] — 2026-04-26

### Changed
- Feed now shows up to 50 STOCK Act filings (was 20) — matches the existing subtitle copy and surfaces more historical context per page (1AM-51)
- New `DEFAULT_LIMIT` constant in `api/trades.js` separates the user-facing default from the FMP-side per-call cap (`FMP_PER_CHAMBER_LIMIT`)

### Notes
- No change to FMP API usage — the Edge Function already fetched up to 50 trades (25 Senate + 25 House), the previous default just sliced them down
- After deduplication typical visible count is 40–50 (varies with filing overlap)
- CDN cache may serve stale 20-trade responses for ~1–3 hours after deploy; manual cache purge in Vercel UI accelerates global propagation

---

## [0.7.1] — 2026-04-26

### Added
- Custom domain `stockactalert.com` configured in Vercel (1AM-46)
  - Apex `stockactalert.com` serves a 308 permanent redirect to `www.stockactalert.com` (canonical)
  - DNS managed at Theory7: A `@` → `216.198.79.1`, CNAME `www` → Vercel
  - Anti-spoofing TXT records (DMARC, SPF, `_domainkey`) preserved
  - HTTPS auto-provisioned by Vercel; HSTS active (`max-age=63072000`)

### Removed
- Stale Theory7 default DNS records (`ftp.`, `mail.` A-records pointing to shared hosting)

---

## [0.7.0] — 2026-04-25

### Added
- Feed now groups followed politicians into "active" (with recent trades) and a separate "no recent activity" section (1AM-26)
- Collapsible toggle: `Show N without recent activity ↓` reveals followed politicians who haven't filed recently
- Each entry shows last-known filing date when available, or "no recent activity" otherwise

### Changed
- Empty state behaviour preserved: when *no* followed politician has recent activity, the existing chip-grid empty state still handles it (no double-rendering)

---

## [0.6.0] — 2026-04-25

### Added
- Politicians tab is now functional — manage followed politicians without redoing onboarding (1AM-24)
- "FOLLOWING N POLITICIANS" header counter that updates live as you tap
- Cross-tab state sync: changes in Politicians tab propagate to Feed filter instantly

### Changed
- Refactored `OnboardingPickPoliticians` to share its card grid with the Politicians tab via new reusable `PoliticianPickGrid` component
- Curated 17-politician list extracted to `src/data/curatedPoliticians.js` — single source of truth for both onboarding and management screens

---

## [0.5.1] — 2026-04-25

### Changed
- Feed filter label rewritten for clarity (1AM-25):
  - `"N OF X FOLLOWED"` → `"N RECENT TRADES FROM YOUR X"` (singular handled)
  - `"SHOWING ALL TRADES"` → `"SHOWING ALL RECENT TRADES"`
- New subtitle below filter-bar: *"Latest 50 STOCK Act filings from Senate + House"* — gives users constant context about feed scope

---

## [0.5.0] — 2026-04-25

### Added
- Persistence of onboarding completion and followed politicians via `localStorage` (SAA-18)
- New `src/lib/storage.js` helper with safe, namespaced JSON access — degrades gracefully when storage is unavailable
- Empty state in feed now shows *which* politicians the user follows as a chip-grid (SAA-18.1)
- "View all N" toggle to expand the chip-grid when followed list exceeds 3 names

### Changed
- Empty state copy rewritten to be neutral about timing — no more "check back in a day or two" advice that could mislead users
- Disambiguated three "Show all"-style buttons by using distinct verbs: `Show all` (filter toggle), `View all N` (chip expand), `Browse all trades` (escape-hatch)

---

## [0.4.0] — 2026-04-25

### Added
- Onboarding flow with three steps: Welcome screen, Data Explainer, Pick Politicians (SAA-13, SAA-14, SAA-15)
- Curated list of 17 well-known politicians (mix of D/R/I, Senate/House) for onboarding selection
- Feed filter by followed politicians with toggle to view all (SAA-16)
- Filter indicator showing current state ("X OF N FOLLOWED" / "SHOWING ALL TRADES")
- Dedicated empty state when filter active but no followed politicians have recent filings

### Changed
- App.jsx onboarding state expanded from boolean to step machine: `welcome` → `explainer` → `pick-politicians` → `done`

---

## [0.3.1] — 2026-04-19

### Added
- CDN caching for `/api/trades` via `Cache-Control: public, s-maxage=3600, stale-while-revalidate=7200` (SAA-11.1)
- Errors return `Cache-Control: no-store` to prevent stuck failures

### Performance
- FMP API calls reduced to ~1/hour per unique query combination, independent of traffic volume

---

## [0.3.0] — 2026-04-19

### Added
- Vercel Edge Function `/api/trades` fetching live STOCK Act filings from Financial Modeling Prep (SAA-11)
- Parallel fetch of Senate and House endpoints with graceful partial-failure handling
- Query parameter filters: `ticker`, `politician`, `limit`
- `useTrades` React hook with `{ trades, loading, error, refetch }` interface (SAA-12)
- AbortController cleanup on unmount to prevent memory leaks and race conditions
- `FeedScreen` component with loading, error, empty, and success states
- Mock trades dataset (`src/data/mockTrades.js`) for offline development and testing

### Changed
- Migrated from Finnhub to Financial Modeling Prep — Finnhub's congressional trading endpoint requires a paid tier; FMP's free tier is sufficient for MVP
- `FeedScreen` integrated into Feed tab; replaces previous placeholder

### Fixed
- Production 404 on `/api/trades` (root cause: Edge Function code was on `feature/data-integration` branch but never merged to `main`)

---

## [0.2.0] — 2026-04-19

### Added
- Internal Trade data schema (`src/data/schema.js`) — single source of truth across the app, independent of any external data source (SAA-10)
- Normaliser functions for Finnhub and FMP trade shapes
- Helper functions `deduplicateTrades` and `sortTradesByDate`
- Constants for sources, parties, chambers, actions, and amount ranges

---

## [0.1.0] — 2026-04-19

### Added
- Design system tokens: warm white (`#FAFAF7`), navy (`#0D1B2A`), buy green (`#059669`), sell red (`#DC2626`), Playfair Display + DM Sans typography (SAA-1)
- `Avatar` component with party-coloured border (SAA-2)
- `Badge` component with `PartyBadge`, `ChamberBadge`, `SourceBadge` variants (SAA-3)
- `TradeCard` component with expandable quick actions (SAA-4)
- `Sparkline` component (SAA-6)
- `PoliticianCard` component (SAA-7)
- `BottomSheet` component
- `TabBar` component with four tabs: Feed, Politicians, Alerts, Settings (SAA-8)

---

[Unreleased]: https://github.com/1am-it/stockactalert/compare/v0.26.0...HEAD
[0.26.0]: https://github.com/1am-it/stockactalert/compare/v0.25.0...v0.26.0
[0.25.0]: https://github.com/1am-it/stockactalert/compare/v0.24.0...v0.25.0
[0.24.0]: https://github.com/1am-it/stockactalert/compare/v0.23.0...v0.24.0
[0.23.0]: https://github.com/1am-it/stockactalert/compare/v0.22.2...v0.23.0
[0.22.2]: https://github.com/1am-it/stockactalert/compare/v0.22.1...v0.22.2
[0.22.1]: https://github.com/1am-it/stockactalert/compare/v0.22.0...v0.22.1
[0.22.0]: https://github.com/1am-it/stockactalert/compare/v0.21.2...v0.22.0
[0.21.2]: https://github.com/1am-it/stockactalert/compare/v0.21.1...v0.21.2
[0.21.1]: https://github.com/1am-it/stockactalert/compare/v0.21.0...v0.21.1
[0.21.0]: https://github.com/1am-it/stockactalert/compare/v0.20.1...v0.21.0
[0.12.1]: https://github.com/1am-it/stockactalert/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/1am-it/stockactalert/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/1am-it/stockactalert/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/1am-it/stockactalert/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/1am-it/stockactalert/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/1am-it/stockactalert/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/1am-it/stockactalert/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/1am-it/stockactalert/compare/v0.7.4...v0.8.0
[0.7.4]: https://github.com/1am-it/stockactalert/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/1am-it/stockactalert/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/1am-it/stockactalert/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/1am-it/stockactalert/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/1am-it/stockactalert/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/1am-it/stockactalert/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/1am-it/stockactalert/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/1am-it/stockactalert/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/1am-it/stockactalert/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/1am-it/stockactalert/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/1am-it/stockactalert/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/1am-it/stockactalert/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/1am-it/stockactalert/releases/tag/v0.1.0

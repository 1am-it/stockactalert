# Changelog

All notable changes to StockActAlert are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Reusable FollowedList component (1AM-28, parked — activate on second consumer)

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

[Unreleased]: https://github.com/1am-it/stockactalert/compare/v0.12.1...HEAD
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

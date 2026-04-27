# Changelog

All notable changes to StockActAlert are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  - New reusable `MemberListRow` component (will be reused in 1AM-68 Politicians-tab redesign)

### Planned
- Politicians-tab redesign to match new picker pattern (1AM-68) — required before 1AM-79 ships to production
- GitHub Actions weekly Congress-directory refresh workflow + localStorage migration (1AM-67 Phase C)
- TradeCard owner badges (1AM-65)
- Reusable FollowedList component (1AM-28)
- Add "X days after trade" field to TradeCard (1AM-36)

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

[Unreleased]: https://github.com/1am-it/stockactalert/compare/v0.7.4...HEAD
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

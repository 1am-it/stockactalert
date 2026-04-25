# Changelog

All notable changes to StockActAlert are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Manage followed politicians post-onboarding (SAA-17)
- Clarify feed scope wording (SAA-20)
- Full politicians directory with search (SAA-19)

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

[Unreleased]: https://github.com/1am-it/stockactalert/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/1am-it/stockactalert/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/1am-it/stockactalert/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/1am-it/stockactalert/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/1am-it/stockactalert/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/1am-it/stockactalert/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/1am-it/stockactalert/releases/tag/v0.1.0

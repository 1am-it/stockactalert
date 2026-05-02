// SAA-10: Internal Trade Data Schema
// 1AM-67: Internal Member (Congress) Data Schema added below
//
// Single source of truth for trade and member data shape across the entire app.
// Independent of any external API — normalises data from any source.
// Changing data source later won't require frontend changes.

// ─── Trade Schema ─────────────────────────────────────────────────────────────
// This is the shape of every trade object used in the app
// All API responses must be normalised to this shape before use

/**
 * @typedef {Object} Trade
 * @property {string} id - Unique identifier (source + politician + ticker + date)
 * @property {string} source - Data source: finnhub / fmp / unusualwhales / capitoltrades / housegov
 * @property {string} politician - Full name e.g. "Nancy Pelosi"
 * @property {string} party - D / R / I
 * @property {string} chamber - House / Senate
 * @property {string} ticker - Stock ticker e.g. "NVDA"
 * @property {string} action - Purchase / Sale / Exchange
 * @property {string} amount - Amount range e.g. "$50K–$100K"
 * @property {string} tradeDate - YYYY-MM-DD
 * @property {string} filedDate - YYYY-MM-DD
 * @property {string[]} committees - e.g. ["Armed Services", "Intelligence"]
 * @property {string} sector - e.g. "Technology" (optional, enriched later)
 * @property {'self'|'spouse'|'joint'|'dependent'} owner - Account owner relative to the politician (1AM-65)
 */

// ─── Empty trade template ─────────────────────────────────────────────────────
export const EMPTY_TRADE = {
  id: '',
  source: '',
  politician: '',
  party: '',
  chamber: '',
  ticker: '',
  action: '',
  amount: '',
  tradeDate: '',
  filedDate: '',
  committees: [],
  sector: '',
  owner: 'self',
};

// ─── Source identifiers ───────────────────────────────────────────────────────
export const SOURCES = {
  FINNHUB: 'finnhub',
  FMP: 'fmp',
  UNUSUAL_WHALES: 'unusualwhales',
  CAPITOL_TRADES: 'capitoltrades',
  HOUSE_GOV: 'housegov',
};

// ─── Action types ─────────────────────────────────────────────────────────────
export const ACTIONS = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  EXCHANGE: 'Exchange',
};

// ─── Party identifiers ────────────────────────────────────────────────────────
export const PARTIES = {
  DEMOCRAT: 'D',
  REPUBLICAN: 'R',
  INDEPENDENT: 'I',
};

// ─── Chamber identifiers ──────────────────────────────────────────────────────
export const CHAMBERS = {
  HOUSE: 'House',
  SENATE: 'Senate',
};

// ─── Owner identifiers (1AM-65) ───────────────────────────────────────────────
// STOCK Act filings include an Owner field per trade indicating whose account
// the trade was on. FMP exposes this as 2-letter codes; we normalise to
// human-readable internal values used by the UI for badge rendering.
export const OWNERS = {
  SELF: 'self',
  SPOUSE: 'spouse',
  JOINT: 'joint',
  DEPENDENT: 'dependent',
};

// Maps a raw FMP/source owner value (code or word) to the internal owner type.
// Defaults to 'self' for empty / unknown values — the safe assumption is that
// a trade with no owner annotation belongs to the politician themselves.
export function normaliseOwner(raw) {
  if (!raw) return OWNERS.SELF;
  const s = String(raw).trim().toLowerCase();
  if (!s || s === 'self') return OWNERS.SELF;
  // FMP code-style + full-word style, both seen in real responses
  if (s === 'sp' || s === 'spouse') return OWNERS.SPOUSE;
  if (s === 'jt' || s === 'joint') return OWNERS.JOINT;
  if (s === 'dc' || s === 'dependent' || s === 'dependent child')
    return OWNERS.DEPENDENT;
  return OWNERS.SELF;
}

// ─── Amount ranges ────────────────────────────────────────────────────────────
// Standardised amount range labels used across all sources
export const AMOUNT_RANGES = {
  XS: '$1K–$15K',
  SM: '$15K–$50K',
  MD: '$50K–$100K',
  LG: '$100K–$250K',
  XL: '$250K–$500K',
  XXL: '$500K–$1M',
  XXXL: '$1M+',
};

// ─── Normalise Finnhub trade ──────────────────────────────────────────────────
// Converts a raw Finnhub congressional trading API response
// to our internal Trade schema
export function normaliseFinnhubTrade(raw) {
  return {
    id: `finnhub-${raw.name}-${raw.symbol}-${raw.transactionDate}`,
    source: SOURCES.FINNHUB,
    politician: raw.name || '',
    party: normaliseParty(raw.party),
    chamber: normaliseChamber(raw.chamber),
    ticker: raw.symbol || '',
    action: normaliseAction(raw.transactionType),
    amount: normaliseAmount(raw.amount),
    tradeDate: raw.transactionDate || '',
    filedDate: raw.filingDate || '',
    committees: [],
    sector: '',
    owner: normaliseOwner(raw.ownerType || raw.owner),
  };
}

// ─── Normalise FMP trade ──────────────────────────────────────────────────────
// Converts a raw FMP Senate/House trading API response
// to our internal Trade schema
// NOTE: FMP endpoints are chamber-specific so the caller must pass the chamber
// NOTE: FMP does not consistently return party info — enrich later
export function normaliseFMPTrade(raw, chamber) {
  // FMP field names can vary between endpoints — try common variants
  const firstName = raw.firstName || '';
  const lastName = raw.lastName || '';
  const fullName =
    raw.representative ||
    raw.office ||
    `${firstName} ${lastName}`.trim();

  const symbol = raw.symbol || '';
  const transactionDate = raw.transactionDate || '';
  const filingDate =
    raw.disclosureDate ||
    raw.dateRecieved || // note: FMP's actual spelling (sic)
    raw.filingDate ||
    '';

  return {
    // 1AM-114: amount included in id-key so two trades with same politician
    // + ticker + date but different amounts (e.g. spouse account separate
    // tranche) get distinct ids. Mirrors the DB unique index criteria.
    id: `fmp-${fullName}-${symbol}-${transactionDate}-${raw.amount || ''}`,
    source: SOURCES.FMP,
    politician: fullName,
    party: '', // FMP doesn't reliably include party — enrich later
    chamber: chamber, // passed in from the caller
    ticker: symbol,
    action: normaliseAction(raw.type),
    amount: normaliseAmount(raw.amount),
    tradeDate: transactionDate,
    filedDate: filingDate,
    committees: [],
    sector: '',
    // 1AM-65: FMP field name varies — try common variants in order
    owner: normaliseOwner(raw.owner || raw.ownerType || raw.owner_type),
  };
}

// ─── Normalise Unusual Whales trade ──────────────────────────────────────────
export function normaliseUnusualWhalesTrade(raw) {
  return {
    id: `uw-${raw.politician}-${raw.ticker}-${raw.traded}`,
    source: SOURCES.UNUSUAL_WHALES,
    politician: raw.politician || '',
    party: normaliseParty(raw.party),
    chamber: normaliseChamber(raw.chamber),
    ticker: raw.ticker || '',
    action: normaliseAction(raw.type),
    amount: raw.range || '',
    tradeDate: raw.traded || '',
    filedDate: raw.filed || '',
    committees: [],
    sector: raw.sector || '',
    owner: normaliseOwner(raw.owner),
  };
}

// ─── Helper: normalise party string ──────────────────────────────────────────
function normaliseParty(raw) {
  if (!raw) return '';
  const p = raw.toUpperCase().trim();
  if (p === 'D' || p === 'DEMOCRAT' || p === 'DEMOCRATIC') return PARTIES.DEMOCRAT;
  if (p === 'R' || p === 'REPUBLICAN') return PARTIES.REPUBLICAN;
  if (p === 'I' || p === 'INDEPENDENT') return PARTIES.INDEPENDENT;
  return raw;
}

// ─── Helper: normalise chamber string ────────────────────────────────────────
function normaliseChamber(raw) {
  if (!raw) return '';
  const c = raw.toLowerCase().trim();
  if (c.includes('house') || c === 'representative') return CHAMBERS.HOUSE;
  if (c.includes('senate') || c === 'senator') return CHAMBERS.SENATE;
  return raw;
}

// ─── Helper: normalise action string ─────────────────────────────────────────
function normaliseAction(raw) {
  if (!raw) return '';
  const a = raw.toLowerCase().trim();
  if (a.includes('purchase') || a.includes('buy')) return ACTIONS.PURCHASE;
  if (a.includes('sale') || a.includes('sell')) return ACTIONS.SALE;
  if (a.includes('exchange')) return ACTIONS.EXCHANGE;
  return raw;
}

// ─── Helper: normalise amount range ──────────────────────────────────────────
function normaliseAmount(raw) {
  if (!raw) return '';
  // If already a formatted string return as-is
  if (typeof raw === 'string' && raw.includes('$')) return raw;
  // If numeric convert to nearest range
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  if (num < 15000) return AMOUNT_RANGES.XS;
  if (num < 50000) return AMOUNT_RANGES.SM;
  if (num < 100000) return AMOUNT_RANGES.MD;
  if (num < 250000) return AMOUNT_RANGES.LG;
  if (num < 500000) return AMOUNT_RANGES.XL;
  if (num < 1000000) return AMOUNT_RANGES.XXL;
  return AMOUNT_RANGES.XXXL;
}

// ─── Deduplicate trades ───────────────────────────────────────────────────────
// Removes duplicate trades when merging multiple sources
// Deduplicates by politician + ticker + tradeDate
export function deduplicateTrades(trades) {
  const seen = new Set();
  return trades.filter((trade) => {
    const key = `${trade.politician}-${trade.ticker}-${trade.tradeDate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Sort trades ──────────────────────────────────────────────────────────────
// Sorts trades by filed date descending (most recent first)
export function sortTradesByDate(trades) {
  return [...trades].sort(
    (a, b) => new Date(b.filedDate) - new Date(a.filedDate)
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 1AM-67: Member (Congress) Schema
// ════════════════════════════════════════════════════════════════════════════
// Shape of every Congress member object used across the app.
// Source: hybrid of Congress.gov API (canonical) + unitedstates/congress-legislators
// (crosswalk supplement). Decided in 1AM-63.
//
// Bioguide ID is the canonical primary key — used to:
//   - Identify members across the app
//   - Match FMP trade records (via name-cascade in src/lib/congress.js)
//   - Key user follows in localStorage / Supabase
//   - Construct photo URLs (deferred — see 1AM-74)

/**
 * @typedef {Object} MemberCrosswalk
 * @property {number} [govtrack]    - GovTrack.us numeric ID
 * @property {string} [opensecrets] - OpenSecrets alphanumeric ID
 * @property {string[]} [fec]       - FEC ID list
 * @property {number} [votesmart]   - VoteSmart numeric ID
 */

/**
 * @typedef {Object} Member
 * @property {string} bioguideId        - Canonical primary key (e.g. "P000197" for Pelosi)
 * @property {string} name              - Display name "Nancy Pelosi" (firstName + lastName)
 * @property {string} initials          - 2-char avatar initials "NP"
 * @property {string} firstName         - "Nancy"
 * @property {string} lastName          - "Pelosi"
 * @property {string} [middleName]      - "D." or undefined
 * @property {string} [nickname]        - undefined unless in source
 * @property {string} officialFull      - "Nancy Pelosi" — name as shown on House.gov / Senate.gov
 * @property {'House'|'Senate'} chamber - Existing convention, capitalised (matches CHAMBERS enum)
 * @property {'D'|'R'|'I'} party        - Matches PARTIES enum
 * @property {string} state             - 2-letter USPS code "CA"
 * @property {number} [district]        - 12 (House only; 0 for at-large; absent for Senate)
 * @property {1|2|3} [senateClass]      - Senate election class (Senate only; absent for House)
 * @property {string} termStart         - ISO date "2025-01-03"
 * @property {string} termEnd           - ISO date "2027-01-03"
 * @property {MemberCrosswalk} [crosswalk] - Cross-references to other databases
 * @property {string} [photoUrl]        - Deferred to 1AM-74; constructed from bioguideId pattern
 */

// ─── Empty member template ────────────────────────────────────────────────────
export const EMPTY_MEMBER = {
  bioguideId: '',
  name: '',
  initials: '',
  firstName: '',
  lastName: '',
  middleName: undefined,
  nickname: undefined,
  officialFull: '',
  chamber: '',
  party: '',
  state: '',
  district: undefined,
  senateClass: undefined,
  termStart: '',
  termEnd: '',
  crosswalk: undefined,
  photoUrl: undefined,
};

// ─── Helper: derive 2-character initials from a first + last name ─────────────
// Used by the fetch-congress script + anywhere a Member object needs to be
// constructed at runtime. Two-character cap so all initials render the same
// width in the avatar pill (e.g. "Nancy Pelosi" → "NP").
export function deriveMemberInitials(firstName, lastName) {
  const first = (firstName || '').trim().charAt(0).toUpperCase();
  const last = (lastName || '').trim().charAt(0).toUpperCase();
  return `${first}${last}`;
}

// ─── Helper: derive display "name" from a member's first + last ───────────────
// First + last only, no middle name, no suffix. Used as the unique key in
// followedPoliticians state during the migration window (Phase C of 1AM-67).
export function deriveMemberName(firstName, lastName) {
  return `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim();
}


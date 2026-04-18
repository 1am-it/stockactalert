// SAA-10: Internal Trade Data Schema
// Single source of truth for trade data shape across the entire app
// Independent of any external API — normalises data from any source
// Changing data source later won't require frontend changes

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
  };
}

// ─── Normalise FMP trade ──────────────────────────
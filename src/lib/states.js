// src/lib/states.js — 1AM-102
//
// Maps US state/territory abbreviations to full names and provides a small
// helper for composing the politicus location label across the app.
//
// Covered: all 50 states + DC + 5 inhabited US territories (PR, VI, GU, AS, MP).
// Unknown codes fall back to the original abbreviation rather than throwing —
// any future code (or malformed source data) keeps rendering instead of
// breaking the screen.

export const STATE_NAMES = {
  // 50 states
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',

  // Federal district
  DC: 'District of Columbia',

  // Inhabited US territories (each sends a non-voting delegate to the House)
  PR: 'Puerto Rico',
  VI: 'U.S. Virgin Islands',
  GU: 'Guam',
  AS: 'American Samoa',
  MP: 'Northern Mariana Islands',
};

/**
 * Resolve a 2-letter state/territory code to its full name.
 * Falls back to the original code if unknown (no throw, no null).
 *
 * @param {string} code 2-letter state or territory code (e.g. "CA")
 * @returns {string} full name or the original code on miss
 */
export function fullStateName(code) {
  if (!code) return '';
  return STATE_NAMES[code.toUpperCase()] || code;
}

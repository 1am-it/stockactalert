#!/usr/bin/env node
// scripts/fetch-congress.mjs — 1AM-67
//
// Hybrid Congress directory fetcher (decided in 1AM-63).
//   Primary source : Congress.gov API — authority for "is this person currently serving"
//   Supplementary  : unitedstates/congress-legislators GitHub — rich structured fields + crosswalks
//
// Outputs:
//   src/data/congress.json          — full ~541-member directory (committed)
//   src/data/congress.fixture.json  — 20 cherry-picked members for dev/testing
//
// Usage:
//   CONGRESS_GOV_API_KEY=<key> npm run fetch:congress
// or:
//   CONGRESS_GOV_API_KEY=<key> node scripts/fetch-congress.mjs
//
// Get a Congress.gov API key: https://api.congress.gov/sign-up/

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Setup ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const API_KEY = process.env.CONGRESS_GOV_API_KEY;
if (!API_KEY) {
  console.error('✗ CONGRESS_GOV_API_KEY env var required.');
  console.error('  Get a key: https://api.congress.gov/sign-up/');
  console.error('  Set in your shell or .env.local before running.');
  process.exit(1);
}

const UNITEDSTATES_URL =
  'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const CONGRESS_GOV_BASE = 'https://api.congress.gov/v3/member';

// ─── Fixture members for dev ──────────────────────────────────────────────────
// Hand-picked 20-member subset for fast dev/testing without loading the full
// directory. Includes the original 17 from curatedPoliticians.js (preserves
// localStorage compatibility during the migration window) plus 3 high-profile
// leadership figures for diversity.
//
// Identified by [last, firstHint] since bioguide IDs aren't known until after
// fetch. firstHint matches via startsWith() in either direction so legal names
// like "Bernard" still match the well-known "Bernie".
const FIXTURE_NAMES = [
  // Existing 17 from curatedPoliticians (preserve localStorage compat)
  ['Blumenthal', 'Richard'],
  ['Boozman', 'John'],
  ['Capito', 'Shelley'],
  ['Crenshaw', 'Daniel'], // "Dan"
  ['Khanna', 'Rohit'], // "Ro"
  ['King', 'Angus'],
  ['McCaul', 'Michael'],
  ['McGarvey', 'Morgan'],
  ['Pelosi', 'Nancy'],
  ['Rouzer', 'David'],
  ['Sanders', 'Bernard'], // "Bernie"
  ['Stefanik', 'Elise'],
  ['Tuberville', 'Tommy'],
  ['Warner', 'Mark'],
  ['Wasserman Schultz', 'Debbie'],
  ['Williams', 'Roger'],
  ['Wyden', 'Ronald'], // "Ron"
  // High-profile leadership additions for fixture diversity
  ['McConnell', 'Mitchell'], // "Mitch"
  ['Schumer', 'Charles'], // "Chuck"
  ['Ocasio-Cortez', 'Alexandria'],
];

// ─── Fetchers ─────────────────────────────────────────────────────────────────
async function fetchUnitedStates() {
  console.log('→ Fetching unitedstates/congress-legislators…');
  const res = await fetch(UNITEDSTATES_URL);
  if (!res.ok) {
    throw new Error(`unitedstates fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  console.log(`  ✓ ${data.length} members from unitedstates`);
  return data;
}

async function fetchCongressGovBioguideSet() {
  console.log('→ Fetching Congress.gov current members…');
  const allBioguides = new Set();
  let url = `${CONGRESS_GOV_BASE}?currentMember=true&limit=250&format=json`;
  let pageNum = 0;

  while (url) {
    pageNum += 1;
    const res = await fetch(url, {
      headers: { 'X-API-Key': API_KEY },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Congress.gov fetch failed: ${res.status} ${res.statusText} on page ${pageNum}\n  body: ${body.slice(0, 200)}`
      );
    }
    const data = await res.json();
    const members = data.members || [];
    for (const m of members) {
      if (m.bioguideId) allBioguides.add(m.bioguideId);
    }
    url = data.pagination?.next || null;
  }

  console.log(`  ✓ ${allBioguides.size} bioguide IDs across ${pageNum} pages`);
  return allBioguides;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────
function normaliseParty(raw) {
  const p = (raw || '').toLowerCase().trim();
  if (p === 'democrat' || p === 'democratic') return 'D';
  if (p === 'republican') return 'R';
  if (p === 'independent') return 'I';
  return raw; // unexpected — let it pass through for visibility
}

function deriveInitials(first, last) {
  const f = (first || '').trim().charAt(0).toUpperCase();
  const l = (last || '').trim().charAt(0).toUpperCase();
  return `${f}${l}`;
}

function buildMemberFromUnitedStates(usEntry) {
  const id = usEntry.id || {};
  const name = usEntry.name || {};
  const terms = usEntry.terms || [];
  const currentTerm = terms[terms.length - 1] || {};

  if (!id.bioguide) return null;
  if (!currentTerm.type) return null;

  const chamber = currentTerm.type === 'sen' ? 'Senate' : 'House';
  const firstName = name.first || '';
  const lastName = name.last || '';

  const member = {
    bioguideId: id.bioguide,
    name: `${firstName} ${lastName}`.trim(),
    initials: deriveInitials(firstName, lastName),
    firstName,
    lastName,
    officialFull: name.official_full || `${firstName} ${lastName}`.trim(),
    chamber,
    party: normaliseParty(currentTerm.party),
    state: currentTerm.state || '',
    termStart: currentTerm.start || '',
    termEnd: currentTerm.end || '',
  };

  // Optional fields — only set when present (keeps JSON clean)
  if (name.middle) member.middleName = name.middle;
  if (name.nickname) member.nickname = name.nickname;

  if (chamber === 'House' && currentTerm.district !== undefined) {
    member.district = currentTerm.district;
  }
  if (chamber === 'Senate' && currentTerm.class !== undefined) {
    member.senateClass = currentTerm.class;
  }

  // Crosswalk to other databases
  const crosswalk = {};
  if (id.govtrack) crosswalk.govtrack = id.govtrack;
  if (id.opensecrets) crosswalk.opensecrets = id.opensecrets;
  if (Array.isArray(id.fec) && id.fec.length > 0) crosswalk.fec = id.fec;
  if (id.votesmart) crosswalk.votesmart = id.votesmart;
  if (Object.keys(crosswalk).length > 0) member.crosswalk = crosswalk;

  return member;
}

function sortMembers(members) {
  return [...members].sort((a, b) => {
    const lastCmp = a.lastName.localeCompare(b.lastName);
    if (lastCmp !== 0) return lastCmp;
    return a.firstName.localeCompare(b.firstName);
  });
}

function pickFixture(members) {
  const fixture = [];
  const matched = new Set();

  for (const [last, firstHint] of FIXTURE_NAMES) {
    const lastLower = last.toLowerCase();
    const firstLower = firstHint.toLowerCase();
    const candidate = members.find((m) => {
      if (m.lastName.toLowerCase() !== lastLower) return false;
      const mFirst = m.firstName.toLowerCase();
      // Allow legal name to match nickname-hint (e.g. "Bernard" matches "Bernie")
      // by checking startsWith in either direction.
      return (
        mFirst.startsWith(firstLower) || firstLower.startsWith(mFirst)
      );
    });
    if (candidate && !matched.has(candidate.bioguideId)) {
      fixture.push(candidate);
      matched.add(candidate.bioguideId);
    } else if (!candidate) {
      console.warn(`  ⚠ Fixture: could not match "${firstHint} ${last}"`);
    }
  }

  return sortMembers(fixture);
}

function writeJSON(relativePath, data) {
  const fullPath = join(REPO_ROOT, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  const json = JSON.stringify(data, null, 2) + '\n';
  writeFileSync(fullPath, json, 'utf8');
  console.log(
    `  ✓ wrote ${relativePath} (${data.length} entries, ${Buffer.byteLength(json)} bytes)`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const start = Date.now();
  console.log('1AM-67 — Fetching Congress directory (hybrid)\n');

  const [usData, cgBioguides] = await Promise.all([
    fetchUnitedStates(),
    fetchCongressGovBioguideSet(),
  ]);

  console.log('\n→ Building Member objects (filtered to Congress.gov authority set)…');
  const members = [];
  let skippedNotInCG = 0;
  let skippedMalformed = 0;

  for (const entry of usData) {
    const member = buildMemberFromUnitedStates(entry);
    if (!member) {
      skippedMalformed += 1;
      continue;
    }
    if (!cgBioguides.has(member.bioguideId)) {
      skippedNotInCG += 1;
      continue;
    }
    members.push(member);
  }

  if (skippedMalformed > 0) {
    console.log(`  ↳ ${skippedMalformed} malformed unitedstates entries skipped`);
  }
  if (skippedNotInCG > 0) {
    console.log(
      `  ↳ ${skippedNotInCG} unitedstates entries filtered out (not in Congress.gov current set — probably just left office)`
    );
  }

  // Members in Congress.gov but not in unitedstates — log as warnings
  const usBioguides = new Set(members.map((m) => m.bioguideId));
  const orphanCG = [...cgBioguides].filter((b) => !usBioguides.has(b));
  if (orphanCG.length > 0) {
    console.warn(
      `\n  ⚠ ${orphanCG.length} Congress.gov members not in unitedstates dataset:`
    );
    console.warn(`    ${orphanCG.slice(0, 10).join(', ')}${orphanCG.length > 10 ? '…' : ''}`);
    console.warn(`  These are likely brand-new members. unitedstates updates within a few days.`);
    console.warn(`  Investigate if persistent — re-run the script next week.`);
  }

  const sorted = sortMembers(members);
  console.log(`\n→ Final Member count: ${sorted.length}`);

  console.log('\n→ Writing outputs…');
  writeJSON('src/data/congress.json', sorted);

  const fixture = pickFixture(sorted);
  console.log(`\n→ Building fixture (${fixture.length} of ${FIXTURE_NAMES.length} requested)…`);
  writeJSON('src/data/congress.fixture.json', fixture);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✓ Done in ${elapsed}s.`);
}

main().catch((err) => {
  console.error('\n✗ Failed:', err.message);
  if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  process.exit(1);
});

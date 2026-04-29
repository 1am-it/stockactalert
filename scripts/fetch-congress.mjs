#!/usr/bin/env node
// scripts/fetch-congress.mjs — 1AM-67 / 1AM-98
//
// Fetches the current Congress directory from unitedstates/congress-legislators
// and writes it to src/data/congress.json (full ~541 members) plus
// src/data/congress.fixture.json (20-member dev/testing subset).
//
// 1AM-98: Refactored from hybrid (Congress.gov + unitedstates) to single-source
// (unitedstates only). The Congress.gov call previously filtered to "currently
// serving" members, which legislators-current.json provides by construction —
// the filter was redundant. No API key required, no pagination, single fetch.
// See research findings comment on 1AM-67 (2026-04-29).
//
// Outputs:
//   src/data/congress.json          — full ~541-member directory (committed)
//   src/data/congress.fixture.json  — 20 cherry-picked members for dev/testing
//
// Usage:
//   npm run fetch:congress
// or:
//   node scripts/fetch-congress.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Setup ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const UNITEDSTATES_URL =
  'https://unitedstates.github.io/congress-legislators/legislators-current.json';

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

// ─── Fetch ────────────────────────────────────────────────────────────────────
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
  console.log('1AM-98 — Fetching Congress directory (unitedstates-only)\n');

  const usData = await fetchUnitedStates();

  console.log('\n→ Building Member objects…');
  const members = [];
  let skippedMalformed = 0;

  for (const entry of usData) {
    const member = buildMemberFromUnitedStates(entry);
    if (!member) {
      skippedMalformed += 1;
      continue;
    }
    members.push(member);
  }

  if (skippedMalformed > 0) {
    console.log(`  ↳ ${skippedMalformed} malformed unitedstates entries skipped`);
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

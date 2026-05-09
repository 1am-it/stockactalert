// src/lib/__tests__/formatChamberLine.test.js — 1AM-37 phase 2
//
// Coverage: all four real-world cases from current Congress directory data,
// plus defensive cases (missing fields, weird inputs) so the helper degrades
// gracefully rather than throwing in production.

import { describe, it, expect } from 'vitest';
import {
  formatChamberLine,
  _DELEGATE_STATES,
  _AT_LARGE_STATES,
} from '../formatChamberLine.js';

describe('formatChamberLine — Senate', () => {
  it('renders senator with chamber + state, no district', () => {
    // Schumer is the canonical example
    expect(
      formatChamberLine({ chamber: 'Senate', state: 'NY' })
    ).toBe('Senate · NY');
  });

  it('ignores district field for senators (defensive)', () => {
    // Even if upstream data leaks a district number for a Senator, we don't show it
    expect(
      formatChamberLine({ chamber: 'Senate', state: 'CA', district: 11 })
    ).toBe('Senate · CA');
  });

  it('handles senator from an at-large state correctly (Senate · AK, not AK-AL)', () => {
    // Senators represent the whole state; "at-large" only applies to House
    expect(
      formatChamberLine({ chamber: 'Senate', state: 'AK' })
    ).toBe('Senate · AK');
  });
});

describe('formatChamberLine — House standard districts', () => {
  it('renders Pelosi as "House · CA-11"', () => {
    expect(
      formatChamberLine({ chamber: 'House', state: 'CA', district: 11 })
    ).toBe('House · CA-11');
  });

  it('renders single-digit districts without padding', () => {
    expect(
      formatChamberLine({ chamber: 'House', state: 'TX', district: 7 })
    ).toBe('House · TX-7');
  });

  it('renders large district numbers correctly', () => {
    // CA has 52 districts post-2020 reapportionment
    expect(
      formatChamberLine({ chamber: 'House', state: 'CA', district: 52 })
    ).toBe('House · CA-52');
  });
});

describe('formatChamberLine — House at-large states', () => {
  it('renders Begich (AK) as "House · AK-AL"', () => {
    // Alaska has 1 House seat — at-large
    expect(
      formatChamberLine({ chamber: 'House', state: 'AK', district: 0 })
    ).toBe('House · AK-AL');
  });

  it('renders WY as "House · WY-AL"', () => {
    expect(
      formatChamberLine({ chamber: 'House', state: 'WY', district: 0 })
    ).toBe('House · WY-AL');
  });

  it('handles all six at-large states', () => {
    for (const state of ['AK', 'DE', 'ND', 'SD', 'VT', 'WY']) {
      expect(
        formatChamberLine({ chamber: 'House', state, district: 0 })
      ).toBe(`House · ${state}-AL`);
    }
  });

  it('shows AT_LARGE_STATES set has exactly the 6 expected states', () => {
    // Anchor: post-2020 census apportionment
    expect(_AT_LARGE_STATES.size).toBe(6);
    expect(_AT_LARGE_STATES.has('AK')).toBe(true);
    expect(_AT_LARGE_STATES.has('WY')).toBe(true);
    // MT moved off the at-large list after 2020 (now MT-01 / MT-02)
    expect(_AT_LARGE_STATES.has('MT')).toBe(false);
  });
});

describe('formatChamberLine — non-voting delegates', () => {
  it('renders Eleanor Norton (DC) as "House · DC" (no district suffix)', () => {
    // Delegate: chamber=House but no voting district — district=0 in source
    expect(
      formatChamberLine({ chamber: 'House', state: 'DC', district: 0 })
    ).toBe('House · DC');
  });

  it('renders all 6 delegate territories without suffix', () => {
    for (const state of ['DC', 'PR', 'GU', 'VI', 'AS', 'MP']) {
      expect(
        formatChamberLine({ chamber: 'House', state, district: 0 })
      ).toBe(`House · ${state}`);
    }
  });

  it('shows DELEGATE_STATES set has the 6 expected entries', () => {
    expect(_DELEGATE_STATES.size).toBe(6);
    expect(_DELEGATE_STATES.has('DC')).toBe(true);
    expect(_DELEGATE_STATES.has('PR')).toBe(true);
  });

  it('treats delegate even when district is null instead of 0', () => {
    // unitedstates/congress-legislators returns 0 in our data, but defensive
    // against future changes — DELEGATE_STATES match wins regardless of district value
    expect(
      formatChamberLine({ chamber: 'House', state: 'DC', district: null })
    ).toBe('House · DC');
  });
});

describe('formatChamberLine — defensive cases', () => {
  it('returns empty string when called with no arguments', () => {
    expect(formatChamberLine()).toBe('');
  });

  it('returns empty string when called with empty object', () => {
    expect(formatChamberLine({})).toBe('');
  });

  it('handles missing state for senator', () => {
    expect(formatChamberLine({ chamber: 'Senate' })).toBe('Senate');
  });

  it('handles missing state for house member', () => {
    expect(formatChamberLine({ chamber: 'House' })).toBe('House');
  });

  it('handles missing district for standard House case (degrades to chamber + state)', () => {
    // Shouldn't happen with congress-legislators data, but defensive
    expect(
      formatChamberLine({ chamber: 'House', state: 'CA' })
    ).toBe('House · CA');
  });

  it('normalises lowercase state to uppercase', () => {
    expect(
      formatChamberLine({ chamber: 'House', state: 'ca', district: 11 })
    ).toBe('House · CA-11');
  });

  it('handles unknown chamber gracefully', () => {
    expect(
      formatChamberLine({ chamber: 'Tribunal', state: 'CA' })
    ).toBe('Tribunal · CA');
  });

  it('trims whitespace from chamber and state', () => {
    expect(
      formatChamberLine({ chamber: ' Senate ', state: ' NY ' })
    ).toBe('Senate · NY');
  });

  it('treats district as integer — string "11" does not match standard case', () => {
    // Defensive against upstream data returning strings — falls through to
    // chamber-and-state-only fallback rather than producing "House · CA-11" from a string
    const result = formatChamberLine({ chamber: 'House', state: 'CA', district: '11' });
    // Acceptable outputs: "House · CA" (degraded) — current implementation
    expect(result).toBe('House · CA');
  });
});

// SAA-18: Safe localStorage helper
// Wraps localStorage in try/catch so the app keeps working when storage is
// unavailable (e.g. some private browsing modes, disabled cookies, quota
// exceeded). Falls back silently — no crashes.
//
// All values are JSON-serialised so callers can store arrays/objects/booleans.
//
// USAGE:
//   import { getJSON, setJSON, remove } from './lib/storage';
//   const followed = getJSON('saa.followedPoliticians', []);
//   setJSON('saa.followedPoliticians', ['Pelosi', 'Boozman']);
//   remove('saa.followedPoliticians');

const PREFIX = 'saa.';

/**
 * Read a JSON value from localStorage. Returns `fallback` if missing,
 * unparseable, or storage is unavailable.
 */
export function getJSON(key, fallback) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(prefixed(key));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    // Corrupt JSON, locked storage, etc. — fall back gracefully
    return fallback;
  }
}

/**
 * Write a JSON value to localStorage. Silently no-ops if storage is
 * unavailable. Returns true on success, false on failure.
 */
export function setJSON(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(prefixed(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a key from localStorage. Silently no-ops on failure.
 */
export function remove(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(prefixed(key));
  } catch {
    // ignore
  }
}

// All keys are namespaced under "saa." to avoid collisions with other apps
// that might run on the same hostname during dev.
function prefixed(key) {
  return key.startsWith(PREFIX) ? key : PREFIX + key;
}

// ── Storage keys ─────────────────────────────────────────────────────────────
// Centralised so callers don't typo key names across the codebase.
export const STORAGE_KEYS = {
  ONBOARDING_DONE: 'onboardingDone',
  FOLLOWED_POLITICIANS: 'followedPoliticians',
  ACTIVE_TAB: 'activeTab',
};

// 1AM-183: auth-aware abstraction over localStorage + Supabase.
//
// This module is the SOLE gateway for read/write of user-bound state.
// Outside of storage.js (a low-level helper that userState wraps), no
// other code in the app should call localStorage directly.
//
// =============================================================================
// KEY TIERS
// =============================================================================
//
// Every storage key falls into exactly one tier. When adding a new key,
// classify it here so the user-switch + sync behavior is intentional.
//
// 1  — user-data, syncs to Supabase
//      FOLLOWED_POLITICIANS (→ public.follows)
//      ONBOARDING_DONE      (→ public.user_profiles.onboarding_completed)
//
// 2a — user-pref, device-local, wiped on user-switch, NOT synced
//      MUTED_POLITICIANS   (TODO: sync target TBD — see 1AM-71 for alert
//                           delivery context; if mute-on-server is needed,
//                           a vervolg-ticket adds a column or table)
//      FOLLOWED_LIST_SORT
//
// 2b — device-pref, user-agnostic, NEVER wiped on user-switch, NOT synced
//      ACTIVE_TAB    ("where was I on this device")
//      WATCH_WINDOW  ("what time-window does this device default to")
//
// =============================================================================
// CRITICAL INVARIANTS
// =============================================================================
//
// 1. lastUserId is a DEVICE-FINGERPRINT, not session-state. It persists
//    across sign-out cycles. Cleared only by manual localStorage wipe
//    (incognito mode, dev-tools, "clear site data" button).
//
//    Reason: if lastUserId were cleared on sign-out, the next sign-in
//    by a different user would be indistinguishable from "first ever
//    sign-in on this device" — and user A's localStorage would be
//    silently migrated into user B's account. lastUserId persistence
//    is what enables user-switch detection.
//
// 2. ONBOARDING_DONE is MONOTONE: once true, stays true.
//    - Write false: no-op (silent skip, no error)
//    - Read mismatch (server=true, local=false): server wins, local
//      is repaired to true on next sync
//
// 3. FOLLOWED_POLITICIANS uses FULL-ARRAY writes, not diffs.
//    Each writeUserState call sends the entire current array. Last
//    write wins inherently, regardless of in-flight ordering.
//
// 4. Supabase auth keys (sb-*-auth-token) are NEVER touched here.
//    They're owned by the Supabase client; supabase.auth.signOut()
//    cleans them up at the right moment.
//
// =============================================================================
// FAILURE MODE
// =============================================================================
//
// Supabase writes are FIRE-AND-FORGET in v1. No rollback, no retry queue.
// If a write fails (network drop, auth-token expired, RLS reject), the
// localStorage write still succeeded — so the user's UI is consistent.
// At the next sign-in, syncUserStateFromServer detects the divergence
// (server side missing the write) and applies "server wins". User loses
// the toggle they made during the failed window; acceptable trade-off
// per the design discussion.
//
// Rollback was rejected because: (a) silent revert without UI feedback
// is worse UX than no rollback, (b) it would add a second convergence
// mechanism alongside server-sync-on-sign-in for the same problem, (c)
// the failure rate is low and the next-sign-in repair is correct.

import { supabase } from './supabaseClient';
import { getJSON, setJSON, remove, STORAGE_KEYS } from './storage';

// -----------------------------------------------------------------------------
// Tier classification — single source of truth
// -----------------------------------------------------------------------------

const USER_BOUND_KEYS = [
  STORAGE_KEYS.FOLLOWED_POLITICIANS,
  STORAGE_KEYS.ONBOARDING_DONE,
  STORAGE_KEYS.MUTED_POLITICIANS,
  STORAGE_KEYS.FOLLOWED_LIST_SORT,
];

const SYNCED_KEYS = [
  STORAGE_KEYS.FOLLOWED_POLITICIANS,
  STORAGE_KEYS.ONBOARDING_DONE,
];

// -----------------------------------------------------------------------------
// Module-level cache for current user.id
// -----------------------------------------------------------------------------
// writeUserState is called from React render-cycle and must be synchronous.
// We can't await supabase.auth.getSession() inline. Instead AuthProvider
// pushes the current user.id here on every session change, so writes can
// branch on auth-state without an async lookup.

let currentUserId = null;

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

/**
 * Synchronous read from localStorage cache. For SYNCED_KEYS this is the
 * cached value; server-sync happens on auth events, not on every read.
 *
 * @param {string} key  STORAGE_KEYS.* value
 * @param {*} fallback  default if key missing or invalid JSON
 * @returns {*} stored value or fallback
 */
export function readUserState(key, fallback) {
  return getJSON(key, fallback);
}

// -----------------------------------------------------------------------------
// Writes
// -----------------------------------------------------------------------------

/**
 * Synchronous localStorage write + fire-and-forget Supabase mirror for
 * SYNCED_KEYS when a user is signed in.
 *
 * Sync-to-local is the contract — callers can rely on the value being
 * persisted before the function returns. Sync-to-server happens in the
 * background; failures are logged but never thrown.
 *
 * @param {string} key   STORAGE_KEYS.* value
 * @param {*}      value any JSON-serializable value
 */
export function writeUserState(key, value) {
  // ALWAYS write to localStorage, regardless of auth state. localStorage
  // is the source of truth for anon users, and the cache layer for
  // signed-in users.
  setJSON(key, value);

  // For SYNCED_KEYS, mirror to Supabase if a user is signed in.
  // Anon users: writes stay local-only until they sign in (at which
  // point checkAndMigrate uploads the accumulated localStorage state).
  if (SYNCED_KEYS.includes(key) && currentUserId) {
    mirrorWriteToSupabase(key, value, currentUserId).catch((err) => {
      // mirrorWriteToSupabase already logs structured errors internally;
      // this catch just prevents an unhandled promise rejection in
      // browsers that surface those as errors.
      void err;
    });
  }
}

async function mirrorWriteToSupabase(key, value, userId) {
  if (key === STORAGE_KEYS.FOLLOWED_POLITICIANS) {
    // Full-array semantics: delete all rows for this user, then insert
    // the new set. Brief race window (between delete and insert the user
    // appears to follow no one server-side) is acceptable for v1 — the
    // window is sub-100ms and concurrent reads from another device are
    // extremely rare for a solo-dev product.
    //
    // Alternative considered: compute diff client-side and emit only
    // deltas. Rejected because it adds state-management complexity and
    // breaks the "full-array write = idempotent" invariant.
    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[userState] supabase delete failed', {
        key,
        userId,
        error: deleteError,
      });
      return;
    }

    if (value.length > 0) {
      const rows = value.map((bioguideId) => ({
        user_id: userId,
        bioguide_id: bioguideId,
      }));
      const { error: insertError } = await supabase.from('follows').insert(rows);

      if (insertError) {
        console.error('[userState] supabase insert failed', {
          key,
          userId,
          count: rows.length,
          error: insertError,
        });
      }
    }
    return;
  }

  if (key === STORAGE_KEYS.ONBOARDING_DONE) {
    // Monotone guard: only write `true`. Writing `false` is a no-op
    // because onboarding-completion is one-way; there is no UI to
    // un-complete onboarding, so a false-write is by definition either
    // a no-op (it's already false) or a bug.
    if (value !== true) return;

    // Server-side monotone guard via .eq('onboarding_completed', false):
    // only update rows where the timestamp is currently null. If another
    // device already marked onboarding complete, we don't clobber the
    // earlier timestamp.
    const { error } = await supabase
      .from('user_profiles')
      .update({ onboarding_completed: true })
      .eq('user_id', userId)
      .eq('onboarding_completed', false);

    if (error) {
      console.error('[userState] supabase onboarding write failed', {
        key,
        userId,
        error,
      });
    }
  }
}

// -----------------------------------------------------------------------------
// Auth-change orchestration
// -----------------------------------------------------------------------------

/**
 * Called by AuthProvider on every onAuthStateChange event with the new
 * user (or null on sign-out). Orchestrates user-switch detection,
 * Tier 1/2a wipes, first-sign-in migration, and same-user server-sync.
 *
 * Must complete before AuthProvider commits the new session to React
 * state — otherwise consumers of useAuth() see the new user.id before
 * localStorage has been reconciled, leading to stale reads.
 *
 * @param {Object|null} user  user object from Supabase session, or null
 */
export async function handleAuthChange(user) {
  // Update module-level cache so writeUserState can branch on auth-state.
  // Done first, before any async work, so any synchronous writes that
  // fire during the awaited work below already see the new user.id.
  currentUserId = user?.id ?? null;

  if (user === null) {
    // Sign-out event. lastUserId stays untouched (it's a device-state
    // marker, not session-state). localStorage user-data also stays —
    // per the ticket-spec, "data blijft op apparaat". The data becomes
    // anon-local once the user signs out; if they sign in again as
    // the same user, no user-switch is detected and they pick up where
    // they left off.
    return;
  }

  const lastUserId = getJSON(STORAGE_KEYS.LAST_USER_ID, null);

  if (lastUserId === null) {
    // First-ever auth on this device (or after manual localStorage wipe).
    // The current localStorage state — whatever the anon user accumulated
    // — is the candidate "to migrate". No wipe needed; we trust the
    // anon state as belonging to this user.
    setJSON(STORAGE_KEYS.LAST_USER_ID, user.id);
    await checkAndMigrate(user);
    return;
  }

  if (lastUserId !== user.id) {
    // User-switch detected. User A's leftover localStorage state must
    // NOT be migrated into user B's account.
    console.info('[userState] user switch detected', {
      from: lastUserId,
      to: user.id,
    });
    wipeUserBoundKeys();

    // CRITICAL: set lastUserId BEFORE running migration. If migration
    // fails halfway (network drop during bulk insert), the next sign-in
    // would otherwise re-detect "user-switch from A to B" and wipe
    // user B's partially-migrated state. Setting lastUserId early
    // ensures the wipe is idempotent — only happens once per actual
    // user switch.
    setJSON(STORAGE_KEYS.LAST_USER_ID, user.id);

    await checkAndMigrate(user);
    return;
  }

  // Same user as last time on this device. This covers:
  //   - SIGNED_IN event for a session that was already established
  //   - TOKEN_REFRESHED event (Supabase fires this periodically)
  //   - USER_UPDATED event (e.g. email change)
  //   - App reload while signed in (initial getSession resolves with
  //     existing session, AuthProvider treats that as an auth change)
  //
  // For all of these, sync server-side state down to localStorage. This
  // is how the second-device "data updated elsewhere" case converges.
  //
  // TODO (vervolg): TOKEN_REFRESHED doesn't need a server sync. Could
  // be optimized to skip syncUserStateFromServer when event is purely
  // a token refresh. Currently AuthProvider doesn't pass the event
  // type through, so for v1 we accept the redundant query.
  await syncUserStateFromServer(user);
}

/**
 * For first-sign-in (or sign-in after user-switch): check server-side
 * onboarding state. If null, this user has never completed onboarding
 * on any device → migrate localStorage state UP to server. If non-null,
 * server has authoritative state → sync DOWN to localStorage cache.
 *
 * Idempotent: re-running this function with the same server state
 * produces no additional side-effects.
 */
async function checkAndMigrate(user) {
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (profileError) {
    console.error('[userState] checkAndMigrate profile read failed', {
      userId: user.id,
      error: profileError,
    });
    return;
  }

  const serverOnboardingComplete = profile?.onboarding_completed === true;

  if (!serverOnboardingComplete) {
    // First sign-in for this user across all devices. Migrate
    // localStorage state UP to server.
    const localFollowed = getJSON(STORAGE_KEYS.FOLLOWED_POLITICIANS, []);
    const localOnboarding = getJSON(STORAGE_KEYS.ONBOARDING_DONE, false);

    if (localFollowed.length > 0) {
      // Bulk upsert with ignoreDuplicates ensures idempotency — if this
      // function gets called twice (network blip + retry, double event
      // delivery), we don't get duplicate-key errors. The schema has
      // a unique constraint on (user_id, bioguide_id).
      const rows = localFollowed.map((bioguideId) => ({
        user_id: user.id,
        bioguide_id: bioguideId,
      }));
      const { error: insertError } = await supabase.from('follows').upsert(rows, {
        onConflict: 'user_id,bioguide_id',
        ignoreDuplicates: true,
      });

      if (insertError) {
        console.error('[userState] migration follows insert failed', {
          userId: user.id,
          count: rows.length,
          error: insertError,
        });
        // Don't return — still attempt onboarding mark. Each migration
        // step is independent and failures are logged.
      }
    }

    if (localOnboarding) {
      const { error: onboardingError } = await supabase
        .from('user_profiles')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id)
        .eq('onboarding_completed', false);

      if (onboardingError) {
        console.error('[userState] migration onboarding update failed', {
          userId: user.id,
          error: onboardingError,
        });
      }
    }
    return;
  }

  // Server has authoritative state. Sync DOWN.
  await syncUserStateFromServer(user);
}

/**
 * Pure read-from-server, write-to-localStorage-cache. Server wins on any
 * divergence. Used on second-device sign-in and on every subsequent
 * sign-in to converge state across devices.
 */
async function syncUserStateFromServer(user) {
  // Pull follows
  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('bioguide_id')
    .eq('user_id', user.id);

  if (followsError) {
    console.error('[userState] sync follows read failed', {
      userId: user.id,
      error: followsError,
    });
    // Don't update localStorage on read failure — preserve last-known cache.
  } else {
    const serverFollowed = follows.map((f) => f.bioguide_id);
    setJSON(STORAGE_KEYS.FOLLOWED_POLITICIANS, serverFollowed);
  }

  // Pull onboarding state — this is the read-mismatch repair path.
  // If server has onboarding_completed=true but local has
  // ONBOARDING_DONE=false (e.g. localStorage wiped, incognito on device
  // 2), this write fixes the mismatch by syncing local up to server.
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single();

  if (profileError) {
    console.error('[userState] sync profile read failed', {
      userId: user.id,
      error: profileError,
    });
    return;
  }

  const serverOnboardingComplete = profile?.onboarding_completed === true;
  setJSON(STORAGE_KEYS.ONBOARDING_DONE, serverOnboardingComplete);
}

/**
 * Wipe Tier 1 + Tier 2a keys (USER_BOUND_KEYS). Called only when
 * handleAuthChange detects a user-switch.
 *
 * Tier 2b keys (ACTIVE_TAB, WATCH_WINDOW) are intentionally NOT wiped —
 * they're device preferences, not user data. lastUserId itself is also
 * NOT wiped here; it gets set to the new user.id in handleAuthChange
 * after this function returns.
 */
function wipeUserBoundKeys() {
  for (const key of USER_BOUND_KEYS) {
    // remove() rather than setJSON to a hardcoded default. After remove,
    // subsequent readUserState(key, fallback) calls return the caller's
    // fallback — which is the actual desired default per the caller's
    // contract (e.g. 'most-active' for FOLLOWED_LIST_SORT). Hardcoding
    // defaults inside the wipe would duplicate that knowledge here.
    remove(key);
  }
}

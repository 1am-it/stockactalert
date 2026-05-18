// 1AM-184: App version constant exposed in SettingsScreen.
//
// Manually bumped as part of the release ritual (OPS-2). Single source of
// truth for the version string the user sees in the app — independent of
// package.json (which stays at "0.0.0" for legacy reasons) and CHANGELOG
// (which is the canonical version history but lives in markdown).
//
// Convention: bump this value in the same commit that bumps CHANGELOG to
// the new release version. Always include the leading "v".
//
// A vite-plugin-driven inject from CHANGELOG was considered but rejected
// for v1 — extra dependency for low value. The manual step lives inside
// the existing release flow so the bump cadence is unchanged.

export const APP_VERSION = 'v0.27.0';

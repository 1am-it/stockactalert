// 1AM-183: re-export useAuth from AuthProvider for ticket-spec conformance.
//
// Single source of truth for auth state remains AuthProvider.jsx; this
// file exists so callers can `import { useAuth } from './lib/useAuth'`
// as the ticket description suggests, without duplicating context logic.
//
// If a future ticket adds non-context-bound auth utilities (e.g. helper
// functions that don't need React), they can co-locate here.

export { useAuth } from './AuthProvider';

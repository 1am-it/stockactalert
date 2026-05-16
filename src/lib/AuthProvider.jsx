// 1AM-181: AuthProvider — exposes auth session state to the React tree via
// useAuth() hook. One source of truth for "is the user signed in".
//
// Pattern matches other React Context providers in modern auth tutorials and
// the official Supabase Auth Helpers React docs. Wraps App.jsx top-level so
// every component can call useAuth() without prop-drilling.
//
// Session lifecycle:
//   1. On mount: fetch current session from supabase.auth.getSession()
//      (synchronous read from localStorage, no network call)
//   2. Subscribe to onAuthStateChange — fires on sign-in, sign-out,
//      token-refresh, and the magic-link callback hash detection
//   3. On unmount: unsubscribe to avoid memory leaks
//
// USAGE:
//   <AuthProvider>
//     <App />
//   </AuthProvider>
//
//   // anywhere inside the tree:
//   const { session, user, loading } = useAuth();
//   if (loading) return <Spinner />;
//   if (!session) return <SignInOverlay />;

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { handleAuthChange } from './userState';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initial session fetch — reads from localStorage, no network call.
    // 1AM-183: if a session exists on mount, run handleAuthChange BEFORE
    // committing the session to React state. This ensures any component
    // consuming useAuth() sees the new session only AFTER localStorage
    // has been reconciled with server-side state. Without this, App.jsx
    // would re-render with the new user.id while localStorage still has
    // anon state, causing brief UI flashes of stale follows.
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      if (initialSession?.user) {
        await handleAuthChange(initialSession.user);
      }
      if (!mounted) return;
      setSession(initialSession);
      setLoading(false);
    });

    // Subscribe to all auth events: sign-in, sign-out, token-refresh,
    // magic-link callback. The callback flows trigger this listener
    // automatically because of detectSessionInUrl: true on the client.
    // 1AM-183: same await-before-commit pattern as above. handleAuthChange
    // is responsible for migration, user-switch detection, and server-sync;
    // session state must not propagate to consumers until that completes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        await handleAuthChange(newSession?.user ?? null);
        if (!mounted) return;
        setSession(newSession);
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access the current auth session anywhere in the React tree.
 * @returns {{ session: Object|null, user: Object|null, loading: boolean }}
 */
export function useAuth() {
  return useContext(AuthContext);
}

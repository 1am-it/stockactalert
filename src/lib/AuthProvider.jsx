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

    // 1AM-183 hotfix: getSession() ONLY sets initial UI loading state.
    // It does NOT trigger handleAuthChange. Reason: onAuthStateChange
    // automatically fires an INITIAL_SESSION event on subscribe with
    // the same session, which is where we run migration/sync. Calling
    // handleAuthChange from BOTH paths causes concurrent Supabase REST
    // calls that fight for the gotrue auth-token lock:
    //
    //   @supabase/gotrue-js: Lock "lock:sb-...-auth-token" was not
    //   released within 5000ms ... Forcefully acquiring the lock to
    //   recover.
    //
    // The forced lock release leaves a window where auth.uid() returns
    // null on the server side, causing RLS-protected DELETE/INSERT/UPDATE
    // calls to fail with 403. Single-path invocation eliminates the race.
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      // loading stays true here; onAuthStateChange's INITIAL_SESSION will
      // flip it to false after handleAuthChange completes.
    });

    // Subscribe to all auth events: sign-in, sign-out, token-refresh,
    // magic-link callback, AND the INITIAL_SESSION emitted automatically
    // on subscribe. The callback flows trigger this listener via
    // detectSessionInUrl: true on the client.
    //
    // 1AM-183: handleAuthChange is the SINGLE entry point for migration,
    // user-switch detection, and server-sync. session state propagates
    // to consumers only after that completes (await-before-commit).
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

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
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setLoading(false);
    });

    // Subscribe to all auth events: sign-in, sign-out, token-refresh,
    // magic-link callback. The callback flows trigger this listener
    // automatically because of detectSessionInUrl: true on the client.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
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

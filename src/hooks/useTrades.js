// SAA-12: useTrades hook
// Fetches congressional trading data from /api/trades and exposes a clean
// interface to components. Handles loading, errors, cleanup, and refetch.
//
// 1AM-51: JSDoc updated — server-side default raised from 20 to 50 to match
// the FeedScreen subtitle copy. Hook itself unchanged; only the documentation
// reflects the new default. Hook callers can still override via filters.limit.
//
// Features:
//   - Automatic fetch on mount
//   - Refetch when filters change (shallow comparison via JSON.stringify)
//   - AbortController cleanup on unmount (prevents memory leaks & race conditions)
//   - refetch() function for manual refresh (pull-to-refresh, retry button, etc.)
//   - Loading and error states exposed
//
// USAGE:
//   const { trades, loading, error, refetch } = useTrades();
//   const { trades, loading, error, refetch } = useTrades({ ticker: 'NVDA' });
//   const { trades, loading, error, refetch } = useTrades({ politician: 'pelosi', limit: 10 });

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @param {Object}  filters
 * @param {string} [filters.ticker]     — filter by ticker e.g. 'NVDA'
 * @param {string} [filters.politician] — substring match on politician name
 * @param {number} [filters.limit]      — max results (default 50, server-side)
 */
export function useTrades(filters = {}) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Serialise filters so we can use them as an effect-dep without infinite loops
  const filtersKey = JSON.stringify(filters);

  // Ref to the current AbortController so refetch() can cancel in-flight requests
  const abortRef = useRef(null);

  const fetchTrades = useCallback(async () => {
    // Cancel any in-flight request before starting a new one
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.ticker) params.set('ticker', filters.ticker);
      if (filters.politician) params.set('politician', filters.politician);
      if (filters.limit) params.set('limit', String(filters.limit));

      const query = params.toString();
      const url = query ? `/api/trades?${query}` : '/api/trades';

      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        // Try to extract a useful error from the response body
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) detail = body.error;
        } catch {
          // response wasn't JSON — keep the HTTP status detail
        }
        throw new Error(detail);
      }

      const data = await res.json();
      // API returns { trades, source, count, filters, timestamp }
      setTrades(Array.isArray(data.trades) ? data.trades : []);
    } catch (err) {
      // AbortError is expected when component unmounts or filters change mid-fetch
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load trades');
      setTrades([]);
    } finally {
      // Only flip loading off if this controller is still the active one
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    fetchTrades();
    // Cleanup: abort if component unmounts or filters change before completion
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchTrades]);

  return { trades, loading, error, refetch: fetchTrades };
}

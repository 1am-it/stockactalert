// 1AM-30: useTradesByPolitician hook
//
// Fetches deep historical trades for a single politician via the
// /api/trades/by-politician endpoint. Used by PoliticianDetailScreen to
// render a richer view than the latest-50 feed alone could provide.
//
// Same shape as useTrades (trades, loading, error, refetch) so the detail
// screen can swap between them with minimal call-site change.
//
// Features:
//   - Automatic fetch on mount
//   - Refetch when politicianName changes
//   - AbortController cleanup on unmount (prevents leaks + race conditions)
//   - Empty politicianName → no fetch, empty trades, loading=false
//
// USAGE:
//   const { trades, loading, error, refetch } = useTradesByPolitician('Nancy Pelosi');

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @param {string} politicianName — full name e.g. "Nancy Pelosi"
 * @param {Object} [options]
 * @param {number} [options.limit] — max trades returned (server-side caps at 200)
 */
export function useTradesByPolitician(politicianName, options = {}) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(Boolean(politicianName));
  const [error, setError] = useState(null);

  const limit = options.limit;
  const abortRef = useRef(null);

  const fetchTrades = useCallback(async () => {
    if (!politicianName) {
      setTrades([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ name: politicianName });
      if (limit) params.set('limit', String(limit));

      const url = `/api/trades/by-politician?${params.toString()}`;
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
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
      setTrades(Array.isArray(data.trades) ? data.trades : []);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load trades');
      setTrades([]);
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, [politicianName, limit]);

  useEffect(() => {
    fetchTrades();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchTrades]);

  return { trades, loading, error, refetch: fetchTrades };
}

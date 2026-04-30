// SAA-12: useTrades hook
// Fetches congressional trading data from /api/trades and exposes a clean
// interface to components. Handles loading, errors, cleanup, and refetch.
//
// 1AM-51: JSDoc updated — server-side default raised from 20 to 50 to match
// the FeedScreen subtitle copy. Hook itself unchanged; only the documentation
// reflects the new default. Hook callers can still override via filters.limit.
//
// 1AM-38: Now also tracks two freshness signals consumed by FreshnessIndicator:
//   - lastUpdatedAt: ms-epoch of the most recent successful fetch
//   - newTradeCount: how many trades in the current fetch weren't in the
//                    previous fetch (per-session memory; resets on remount)
// Both are null/0 on first fetch since there's no "previous" state to delta from.
//
// Features:
//   - Automatic fetch on mount
//   - Refetch when filters change (shallow comparison via JSON.stringify)
//   - AbortController cleanup on unmount (prevents memory leaks & race conditions)
//   - refetch() function for manual refresh (pull-to-refresh, retry button, etc.)
//   - Loading and error states exposed
//   - Freshness signals (lastUpdatedAt, newTradeCount) — 1AM-38
//
// USAGE:
//   const { trades, loading, error, refetch, lastUpdatedAt, newTradeCount } = useTrades();

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
  // 1AM-38: freshness signals
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [newTradeCount, setNewTradeCount] = useState(0);

  // Serialise filters so we can use them as an effect-dep without infinite loops
  const filtersKey = JSON.stringify(filters);

  // Ref to the current AbortController so refetch() can cancel in-flight requests
  const abortRef = useRef(null);
  // 1AM-38: ref to the previous trade-id Set, used to compute newTradeCount
  // delta on refetch. Lives in a ref (not state) so it doesn't trigger renders;
  // we only ever read it in fetchTrades, write it after a successful fetch.
  const previousIdsRef = useRef(null);

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
      const fetchedTrades = Array.isArray(data.trades) ? data.trades : [];
      setTrades(fetchedTrades);

      // 1AM-38: compute newTradeCount from id-delta against previous fetch.
      // First fetch has no "previous" set → count stays 0 (badge hidden).
      // Subsequent fetches diff the new ids against the prior set.
      const currentIds = new Set(fetchedTrades.map((t) => t.id));
      const prior = previousIdsRef.current;
      if (prior) {
        let delta = 0;
        for (const id of currentIds) {
          if (!prior.has(id)) delta += 1;
        }
        setNewTradeCount(delta);
      } else {
        setNewTradeCount(0);
      }
      previousIdsRef.current = currentIds;
      setLastUpdatedAt(Date.now());
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

  return { trades, loading, error, refetch: fetchTrades, lastUpdatedAt, newTradeCount };
}

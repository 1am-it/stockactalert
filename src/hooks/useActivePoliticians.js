// 1AM-106: useActivePoliticians hook
//
// Returns the set of bioguide-ids that have at least one trade with
// trade_date >= since. Consumed by PoliticiansScreen's date-range filter
// chip to narrow both the Following and Browse sections to "members
// active in the last N days".
//
// Architecture decision (1AM-106):
//   - One fetch to /api/trades?since=...&limit=500 per `since` change
//   - Cascade name → bioguide via findByName INSIDE the hook (once per fetch)
//     so the consumer gets an O(1) Set<bioguideId> for filtering
//   - When since is null/undefined (= "Any time" chip), the hook is a no-op
//     and returns null. Callers should treat null as "no filter active"
//     and skip the activity-filter step entirely.
//
// MVP coverage limit: limit=500 is the API max. With ~94 archive rows
// today, that's ample. Past 90d / Past year / All time stay accurate up
// to ~5x current archive size before we'd need to upgrade to a backend
// /api/politicians/active aggregation endpoint. CHANGELOG entry for v0.16.1
// will note this trade-off.

import { useState, useEffect, useRef } from 'react';
import { findByName } from '../lib/congress';

const ARCHIVE_FETCH_LIMIT = 500;

/**
 * @param {string|null} since - YYYY-MM-DD cutoff, or null/undefined to disable
 * @returns {{
 *   activeBioguideIds: Set<string>|null,
 *   loading: boolean,
 *   error: string|null
 * }}
 *   activeBioguideIds is null when since is falsy (no filter active),
 *   a (possibly empty) Set otherwise.
 */
export function useActivePoliticians(since) {
  const [activeBioguideIds, setActiveBioguideIds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);

  useEffect(() => {
    if (!since) {
      setActiveBioguideIds(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const url = `/api/trades?since=${encodeURIComponent(since)}&limit=${ARCHIVE_FETCH_LIMIT}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
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
        return res.json();
      })
      .then((data) => {
        const trades = Array.isArray(data?.trades) ? data.trades : [];
        const ids = new Set();
        for (const trade of trades) {
          if (!trade?.politician) continue;
          const matches = findByName(trade.politician);
          if (matches.length > 0) {
            ids.add(matches[0].bioguideId);
          }
        }
        setActiveBioguideIds(ids);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load active politicians');
        setActiveBioguideIds(null);
      })
      .finally(() => {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [since]);

  return { activeBioguideIds, loading, error };
}

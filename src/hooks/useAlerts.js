// 1AM-126 fase A: useAlerts hook
//
// Derives NEW_TRADE and LATE_FILING alerts client-side from already-fetched
// `trades` + `followedPoliticians` — no separate fetch, same follow-filter
// pattern FeedScreen uses (match on trade.politician against the followed
// name list).
//
// One followed trade can produce up to two alerts: a NEW_TRADE alert always,
// plus a LATE_FILING alert when isLateFiling(filedDate, tradeDate) is true.
// Each gets its own id (`${trade.id}:new_trade` / `${trade.id}:late_filing`)
// so read-state is tracked independently per alert type.
//
// Alerts are emitted in the same order as the incoming `trades` array (both
// useTrades and useTradesByPolitician return trades ordered trade_date desc),
// with a trade's LATE_FILING alert immediately following its NEW_TRADE alert.
//
// Read-state (readAlertIds) is device-local, persisted via getJSON/setJSON —
// not routed through userState.js since alerts have no server-side record to
// sync against.
//
// USAGE:
//   const { alerts, unreadCount, readIds, markAllRead, markRead } =
//     useAlerts(trades, followedPoliticians);

import { useState, useEffect, useCallback, useMemo } from 'react';
import { isLateFiling } from '../lib/dates';
import { getJSON, setJSON, STORAGE_KEYS } from '../lib/storage';

export const ALERT_TYPES = {
  NEW_TRADE: 'NEW_TRADE',
  LATE_FILING: 'LATE_FILING',
};

/**
 * Pure alert-generation logic, split out from the hook so it's testable with
 * plain vitest (node environment) — the project has no jsdom/testing-library
 * setup yet to render hooks directly. See src/hooks/__tests__/useAlerts.test.js.
 *
 * @param {Array} trades — trade objects (Trade shape from src/data/schema.js)
 * @param {string[]} followedPoliticians — politician names the user follows
 * @returns {Array} alerts, in the same order as `trades`
 */
export function computeAlerts(trades = [], followedPoliticians = []) {
  if (!Array.isArray(trades) || trades.length === 0) return [];
  const followedSet = new Set(followedPoliticians);
  if (followedSet.size === 0) return [];

  const result = [];
  for (const trade of trades) {
    if (!trade?.politician || !followedSet.has(trade.politician)) continue;

    result.push({
      id: `${trade.id}:new_trade`,
      type: ALERT_TYPES.NEW_TRADE,
      trade,
      politician: trade.politician,
      ticker: trade.ticker,
      date: trade.tradeDate,
    });

    if (isLateFiling(trade.filedDate, trade.tradeDate)) {
      result.push({
        id: `${trade.id}:late_filing`,
        type: ALERT_TYPES.LATE_FILING,
        trade,
        politician: trade.politician,
        ticker: trade.ticker,
        date: trade.filedDate,
      });
    }
  }
  return result;
}

/**
 * @param {Array} trades — trade objects (Trade shape from src/data/schema.js)
 * @param {string[]} followedPoliticians — politician names the user follows
 */
export function useAlerts(trades = [], followedPoliticians = []) {
  const [readIds, setReadIds] = useState(
    () => new Set(getJSON(STORAGE_KEYS.READ_ALERT_IDS, []))
  );

  useEffect(() => {
    setJSON(STORAGE_KEYS.READ_ALERT_IDS, Array.from(readIds));
  }, [readIds]);

  const alerts = useMemo(
    () => computeAlerts(trades, followedPoliticians),
    [trades, followedPoliticians]
  );

  const unreadCount = useMemo(
    () => alerts.reduce((count, alert) => (readIds.has(alert.id) ? count : count + 1), 0),
    [alerts, readIds]
  );

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const alert of alerts) next.add(alert.id);
      return next;
    });
  }, [alerts]);

  const markRead = useCallback((alertId) => {
    setReadIds((prev) => {
      if (prev.has(alertId)) return prev;
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  }, []);

  return { alerts, unreadCount, readIds, markAllRead, markRead };
}

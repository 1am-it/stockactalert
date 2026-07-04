// src/hooks/__tests__/useAlerts.test.js — 1AM-126 fase A + mute follow-up
//
// Tests computeAlerts (the pure logic extracted from useAlerts) since the
// project has no jsdom/testing-library setup to render the hook directly.
// markRead/markAllRead/unreadCount are plain Set/reduce arithmetic over this
// output and are not separately covered here.

import { describe, it, expect } from 'vitest';
import { computeAlerts, ALERT_TYPES } from '../useAlerts.js';

function makeTrade(overrides = {}) {
  return {
    id: 'fmp-Nancy Pelosi-NVDA-2026-05-01-1000',
    politician: 'Nancy Pelosi',
    ticker: 'NVDA',
    tradeDate: '2026-05-01',
    filedDate: '2026-05-02',
    ...overrides,
  };
}

describe('computeAlerts — follow filtering', () => {
  it('returns empty array when trades is empty', () => {
    expect(computeAlerts([], ['Nancy Pelosi'])).toEqual([]);
  });

  it('returns empty array when followedPoliticians is empty', () => {
    expect(computeAlerts([makeTrade()], [])).toEqual([]);
  });

  it('skips trades from politicians not in followedPoliticians', () => {
    const trade = makeTrade({ politician: 'Someone Else' });
    expect(computeAlerts([trade], ['Nancy Pelosi'])).toEqual([]);
  });

  it('skips trades with a missing politician field (defensive)', () => {
    const trade = makeTrade({ politician: '' });
    expect(computeAlerts([trade], ['Nancy Pelosi'])).toEqual([]);
  });
});

describe('computeAlerts — NEW_TRADE', () => {
  it('emits one NEW_TRADE alert for a followed, on-time trade', () => {
    const trade = makeTrade({ tradeDate: '2026-05-01', filedDate: '2026-05-05' });
    const alerts = computeAlerts([trade], ['Nancy Pelosi']);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      id: `${trade.id}:new_trade`,
      type: ALERT_TYPES.NEW_TRADE,
      politician: 'Nancy Pelosi',
      ticker: 'NVDA',
      date: '2026-05-01',
    });
    expect(alerts[0].trade).toBe(trade);
  });
});

describe('computeAlerts — LATE_FILING', () => {
  it('emits NEW_TRADE + LATE_FILING for a trade filed past the threshold (30 days)', () => {
    // 45 days between trade and filing — exceeds LATE_FILING_THRESHOLD_DAYS
    const trade = makeTrade({ tradeDate: '2026-01-01', filedDate: '2026-02-15' });
    const alerts = computeAlerts([trade], ['Nancy Pelosi']);

    expect(alerts).toHaveLength(2);
    expect(alerts[0].type).toBe(ALERT_TYPES.NEW_TRADE);
    expect(alerts[1]).toMatchObject({
      id: `${trade.id}:late_filing`,
      type: ALERT_TYPES.LATE_FILING,
      date: '2026-02-15',
    });
  });

  it('does not emit LATE_FILING when filed exactly at the threshold (30 days)', () => {
    const trade = makeTrade({ tradeDate: '2026-01-01', filedDate: '2026-01-31' });
    const alerts = computeAlerts([trade], ['Nancy Pelosi']);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe(ALERT_TYPES.NEW_TRADE);
  });

  it('does not emit LATE_FILING when filedDate is missing (isLateFiling returns false)', () => {
    const trade = makeTrade({ filedDate: '' });
    const alerts = computeAlerts([trade], ['Nancy Pelosi']);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe(ALERT_TYPES.NEW_TRADE);
  });
});

describe('computeAlerts — muted politicians', () => {
  it('excludes alerts for a followed but muted politician', () => {
    const trade = makeTrade();
    expect(
      computeAlerts([trade], ['Nancy Pelosi'], ['Nancy Pelosi'])
    ).toEqual([]);
  });

  it('excludes both NEW_TRADE and LATE_FILING for a muted, late-filed trade', () => {
    const trade = makeTrade({ tradeDate: '2026-01-01', filedDate: '2026-02-15' });
    expect(
      computeAlerts([trade], ['Nancy Pelosi'], ['Nancy Pelosi'])
    ).toEqual([]);
  });

  it('does not affect alerts for other followed, unmuted politicians', () => {
    const pelosi = makeTrade({ id: 'p1', politician: 'Nancy Pelosi' });
    const tuberville = makeTrade({ id: 't1', politician: 'Tommy Tuberville' });

    const alerts = computeAlerts(
      [pelosi, tuberville],
      ['Nancy Pelosi', 'Tommy Tuberville'],
      ['Nancy Pelosi']
    );

    expect(alerts.map((a) => a.id)).toEqual(['t1:new_trade']);
  });

  it('defaults to no muting when mutedPoliticians is omitted', () => {
    const trade = makeTrade();
    const alerts = computeAlerts([trade], ['Nancy Pelosi']);
    expect(alerts).toHaveLength(1);
  });
});

describe('computeAlerts — ordering and multiple trades', () => {
  it('keeps a late-filed trade\'s two alerts adjacent, in input order', () => {
    const onTime = makeTrade({
      id: 'trade-1',
      tradeDate: '2026-05-01',
      filedDate: '2026-05-03',
    });
    const late = makeTrade({
      id: 'trade-2',
      tradeDate: '2026-01-01',
      filedDate: '2026-02-15',
    });

    const alerts = computeAlerts([late, onTime], ['Nancy Pelosi']);

    expect(alerts.map((a) => a.id)).toEqual([
      'trade-2:new_trade',
      'trade-2:late_filing',
      'trade-1:new_trade',
    ]);
  });

  it('mixes followed and unfollowed trades correctly across politicians', () => {
    const pelosi = makeTrade({ id: 'p1', politician: 'Nancy Pelosi' });
    const other = makeTrade({ id: 'o1', politician: 'Someone Else' });
    const tuberville = makeTrade({ id: 't1', politician: 'Tommy Tuberville', filedDate: '2026-05-02' });

    const alerts = computeAlerts(
      [pelosi, other, tuberville],
      ['Nancy Pelosi', 'Tommy Tuberville']
    );

    expect(alerts.map((a) => a.id)).toEqual(['p1:new_trade', 't1:new_trade']);
  });
});

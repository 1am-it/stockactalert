// 1AM-126 fase B: AlertsScreen
//
// Renders NEW_TRADE + LATE_FILING alerts for followed politicians. Alert
// data (alerts, unreadCount, readIds, markAllRead, markRead) is computed by
// useAlerts and lifted to App.jsx — not called here — so the same read-state
// is shared with the TabBar unread badge without a second stateful instance
// diverging from localStorage (see App.jsx useAlerts call site).
//
// Empty states:
//   - zero follows       → prompt to follow politicians (same escape hatch
//                           as Watch-tab's empty-zero hero)
//   - follows, no alerts → "No alerts yet"
//
// Tapping a row marks it read and opens the politician detail page.

import { formatShortDate, formatFiledRelative } from '../lib/dates';
import { ALERT_TYPES } from '../hooks/useAlerts';

export default function AlertsScreen({
  followedPoliticians = [],
  alerts = [],
  unreadCount = 0,
  readIds = new Set(),
  markAllRead,
  markRead,
  onShowPoliticianDetail,
  onManageFollowing,
}) {
  if (followedPoliticians.length === 0) {
    return (
      <EmptyState
        title="Follow politicians to get alerts"
        description="New trades and late filings from politicians you follow will show up here."
        ctaLabel="Manage who you follow →"
        onCta={onManageFollowing}
      />
    );
  }

  if (alerts.length === 0) {
    return (
      <EmptyState
        title="No alerts yet"
        description="You'll see new trades and late filings from your followed politicians here."
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: '#6B7280',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {unreadCount > 0
            ? `${unreadCount} unread`
            : 'All caught up'}
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              fontSize: 12,
              fontWeight: 700,
              color: '#0D1B2A',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: '#D1D5DB',
              textUnderlineOffset: 2,
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {alerts.map((alert) => (
        <AlertRow
          key={alert.id}
          alert={alert}
          unread={!readIds.has(alert.id)}
          onClick={() => {
            markRead?.(alert.id);
            onShowPoliticianDetail?.(alert.politician);
          }}
        />
      ))}
    </div>
  );
}

function AlertRow({ alert, unread, onClick }) {
  const isLateFiling = alert.type === ALERT_TYPES.LATE_FILING;
  const { trade } = alert;

  const message = isLateFiling
    ? `Filed ${formatFiledRelative(trade.filedDate, trade.tradeDate) || 'late'}`
    : `${trade.action === 'Purchase' ? 'Bought' : 'Sold'} · ${trade.amount}`;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        width: '100%',
        gap: 12,
        alignItems: 'flex-start',
        textAlign: 'left',
        padding: '14px 16px',
        marginBottom: 8,
        background: unread ? '#FFFBEB' : '#FFFFFF',
        border: `1px solid ${unread ? '#FDE68A' : '#E5E7EB'}`,
        borderRadius: 14,
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <IconCircle type={alert.type} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: unread ? 700 : 500,
            color: '#0D1B2A',
            marginBottom: 2,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {alert.politician}
          </span>
          {unread && <UnreadDot />}
        </div>
        <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
          {isLateFiling ? 'Late filing' : 'New trade'} · {alert.ticker}
        </div>
        <div style={{ fontSize: 11, color: isLateFiling ? '#D97706' : '#9CA3AF' }}>
          {message}
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', flexShrink: 0 }}>
        {formatShortDate(alert.date) || alert.date}
      </div>
    </button>
  );
}

function IconCircle({ type }) {
  const isLateFiling = type === ALERT_TYPES.LATE_FILING;
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: isLateFiling ? 'rgba(217, 119, 6, 0.12)' : 'rgba(13, 27, 42, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {isLateFiling ? <ClockIcon /> : <BellIcon />}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C8.7 3 6 5.7 6 9v5l-2 2v1h16v-1l-2-2V9c0-3.3-2.7-6-6-6z"
        stroke="#0D1B2A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 004 0" stroke="#0D1B2A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="#D97706" strokeWidth="2" />
      <path d="M12 7.5V12l3 2" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UnreadDot() {
  return (
    <span
      aria-label="unread"
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#D85A30',
        flexShrink: 0,
      }}
    />
  );
}

function EmptyState({ title, description, ctaLabel, onCta }) {
  return (
    <section
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E5D8',
        borderRadius: 14,
        padding: '32px 24px',
        textAlign: 'center',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(13, 27, 42, 0.08)',
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BellIcon />
      </div>
      <h2
        style={{
          fontFamily: "'Playfair Display', 'Lora', serif",
          fontSize: 20,
          fontWeight: 500,
          color: '#0D1B2A',
          margin: '0 0 8px',
          letterSpacing: '-0.3px',
        }}
      >
        {title}
      </h2>
      <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, marginBottom: ctaLabel ? 20 : 0 }}>
        {description}
      </div>
      {ctaLabel && (
        <button
          type="button"
          onClick={onCta}
          style={{
            padding: '12px 20px',
            background: '#0D1B2A',
            color: '#FAFAF7',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          {ctaLabel}
        </button>
      )}
    </section>
  );
}

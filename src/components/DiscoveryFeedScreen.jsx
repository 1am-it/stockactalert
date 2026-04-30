// 1AM-66: DiscoveryFeedScreen — public anonymous landing
//
// Renders a preview of the live trade feed for first-time visitors. Sits in
// front of the onboarding flow per v6 design — anonymous users see real data
// before being asked to follow politicians.
//
// Routing entry: App.jsx renders this when onboardingStep === 'discovery'.
// CTA "Select politicians →" advances onboardingStep directly to
// 'pick-politicians' (v0.13.1 — Welcome + Explainer screens removed because
// Discovery makes them redundant; see 1AM-110 for the content-migration plan).
//
// Design vs FeedScreen:
//   - Centered Playfair header "Live from Congress" (no subtitle, per ticket)
//   - Prominent CTA card with green button (entry to onboarding)
//   - "RECENT STOCK ACT FILINGS" section header (positioning: civic-tech transparency)
//   - Renders only DISCOVERY_PREVIEW_COUNT (3) trades — enough to prove the data
//     is real without dragging anonymous users into a long scroll. The remainder
//     is teased via "+ N more filings" hint.
//   - TradeCards rendered WITHOUT onPoliticianClick (anonymous user can't access detail)
//   - TradeCards WITHOUT following pill (anonymous user has no follow state)
//   - Owner badges (spouse / joint / dependent) STILL shown — owner is a property
//     of the trade itself, not user-state, so it renders in both contexts
//   - No tab bar (anonymous mode — App.jsx omits TabBar for this branch)
//   - No filter bar (no concept of "filter to followed" without a follow list)
//
// Props:
//   onStartOnboarding — callback to advance the user into the onboarding flow

import TradeCard from './TradeCard';
import { useTrades } from '../hooks/useTrades';

// 1AM-66 v0.13.1: limit Discovery preview to 3 trades. Anonymous users need
// proof-of-real-data, not a browsing experience. Three is enough to establish
// credibility and create curiosity for "+ N more filings".
const DISCOVERY_PREVIEW_COUNT = 3;

export default function DiscoveryFeedScreen({ onStartOnboarding }) {
  const { trades, loading, error, refetch } = useTrades();

  // Slice to preview length; the rest is teased via the trailing hint.
  const previewTrades = trades?.slice(0, DISCOVERY_PREVIEW_COUNT) ?? [];
  const remainingCount =
    trades && trades.length > DISCOVERY_PREVIEW_COUNT
      ? trades.length - DISCOVERY_PREVIEW_COUNT
      : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '40px 24px 60px',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 32,
            fontWeight: 500,
            color: '#0D1B2A',
            margin: '0 0 24px',
            letterSpacing: '-0.5px',
            textAlign: 'center',
          }}
        >
          Live from Congress
        </h1>

        {/* ── CTA card ───────────────────────────────────────────────────── */}
        {/* White surface, navy outline, centered text, prominent green button. */}
        {/* Tap → onStartOnboarding triggers App-level transition to 'welcome'. */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #0D1B2A',
            borderRadius: 16,
            padding: '20px 18px',
            textAlign: 'center',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: '#0D1B2A',
              marginBottom: 4,
              lineHeight: 1.4,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            See what politicians are buying and selling
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#6B7280',
              marginBottom: 14,
              lineHeight: 1.5,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Get notified when they file new trades
          </div>
          <button
            onClick={onStartOnboarding}
            style={{
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              width: '100%',
              cursor: 'pointer',
            }}
          >
            Select politicians →
          </button>
        </div>

        {/* ── Section header ─────────────────────────────────────────────── */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#6B7280',
            letterSpacing: '0.8px',
            marginBottom: 12,
            padding: '0 2px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          RECENT STOCK ACT FILINGS
        </div>

        {/* ── Trade list / loading / error ──────────────────────────────── */}
        {loading && (
          <div
            style={{
              padding: '40px 0',
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: 14,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Loading filings…
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 16,
              color: '#B91C1C',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
              Couldn't load filings
            </div>
            <div style={{ fontSize: 12, color: '#991B1B', marginBottom: 16 }}>
              {error}
            </div>
            <button
              onClick={refetch}
              style={{
                padding: '8px 20px',
                background: '#0D1B2A',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && trades && trades.length > 0 && (
          <>
            {previewTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                // Intentionally NOT passing:
                //   - onPoliticianClick: anonymous users have no detail-page access
                //   - following: no follow state in Discovery context
                //   - onSetAlert / onViewProfile / onViewTicker: actions need follow state
                // Owner badge renders automatically from trade.owner.
              />
            ))}

            {/* Trailing hint — observational only, no CTA repeat (CTA is at top).
                Only shown when there are more filings than the preview window. */}
            {remainingCount > 0 && (
              <div style={{ textAlign: 'center', marginTop: 16, padding: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: '#9CA3AF',
                    fontStyle: 'italic',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  + {remainingCount} more filings
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !error && trades && trades.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: 16,
              color: '#6B7280',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
            }}
          >
            No recent filings to show right now. Check back shortly.
          </div>
        )}
      </div>
    </div>
  );
}

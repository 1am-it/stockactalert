// 1AM-124 / 1AM-184: SettingsScreen
// Full-page overlay reached from the user-menu avatar in HeaderBar /
// WatchHeader (replaces the 1AM-124 gear-icon entry-point in 1AM-184).
//
// History:
//   2026-05-04 (1AM-124): created as placeholder "Settings — coming soon"
//   with Credits acknowledgement card. Reached via gear icon.
//   2026-05-18 (1AM-184): gear-icon flow retired. Avatar in header opens
//   this screen for authenticated users. Placeholder replaced by real
//   account content (email, member-since, sign-out, legal links, app
//   version). Credits card preserved at the bottom.
//
// Anonymous-user note: this screen is unreachable for non-signed-in users
// in v1 because the avatar/gear is replaced by a "Sign in" text-link.
// Credits visibility for anon prospects is a follow-up concern (move
// to /privacy footer or app footer) — tracked outside this ticket.
//
// Layout (top → bottom):
//   ← Back
//   Settings (h1)
//   Account section
//     - email (truncated if long)
//     - "Member since [Month Year]"
//   Sign out (red text-button, non-destructive style)
//   Legal links
//     - Privacy Policy → /privacy
//     - Terms of Service → /terms
//   App version (small, muted)
//   Credits card (1AM-146, data acknowledgements)
//
// Props:
//   onBack — callback when the user taps `← Back` or after sign-out

import { useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { supabase } from '../lib/supabaseClient';
import { APP_VERSION } from '../lib/version';

// Format Supabase user.created_at ISO timestamp as "Member since May 2026".
// Short form — full date is too noisy for a side-info line.
function formatMemberSince(createdAt) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Truncate email visually when very long. Keep prefix + final domain part.
// e.g. "verylongusername@gmail.com" stays short enough; "verylongusername@super-long-corporate-domain.example.com" gets the middle ellipsised.
function truncateEmail(email, maxChars = 32) {
  if (!email) return '';
  if (email.length <= maxChars) return email;
  const at = email.indexOf('@');
  if (at === -1) return email.slice(0, maxChars - 1) + '…';
  const prefix = email.slice(0, at);
  const domain = email.slice(at + 1);
  // Reserve 1 char for "@" and 1 for "…".
  const budget = maxChars - 2;
  const prefixBudget = Math.min(prefix.length, Math.floor(budget / 2));
  const domainBudget = budget - prefixBudget;
  return `${prefix.slice(0, prefixBudget)}…@${domain.slice(-domainBudget)}`;
}

export default function SettingsScreen({ onBack }) {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(null);

  const memberSince = formatMemberSince(user?.created_at);
  const displayEmail = truncateEmail(user?.email);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Surface error in-place — don't dismiss the screen. User can retry
        // or close manually.
        setSignOutError(error.message || 'Sign-out failed. Try again.');
        setSigningOut(false);
        return;
      }
      // onAuthStateChange fires SIGNED_OUT; AuthProvider clears session;
      // App.jsx re-renders header back to anon state. Close the screen.
      if (typeof onBack === 'function') onBack();
    } catch (err) {
      setSignOutError(err?.message || 'Sign-out failed. Try again.');
      setSigningOut(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '40px 24px 100px',
        }}
      >
        {/* ── Back link ──────────────────────────────────────────────────── */}
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#6B7280',
            fontSize: 14,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
            padding: 0,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0D1B2A';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#6B7280';
          }}
        >
          ← Back
        </button>

        {/* ── Title ──────────────────────────────────────────────────────── */}
        <h1
          style={{
            fontSize: 32,
            margin: '0 0 24px',
            color: '#0D1B2A',
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontWeight: 500,
          }}
        >
          Settings
        </h1>

        {/* ── Account section (visible when signed in) ───────────────────── */}
        {user && (
          <section
            style={{
              padding: '16px 20px',
              background: '#FFFFFF',
              borderRadius: 16,
              border: '1px solid #E5E7EB',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#6B7280',
                marginBottom: 10,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Account
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#0D1B2A',
                fontFamily: "'DM Sans', sans-serif",
                wordBreak: 'break-word',
              }}
              title={user.email}
            >
              {displayEmail}
            </div>
            {memberSince && (
              <div
                style={{
                  fontSize: 12,
                  color: '#9CA3AF',
                  marginTop: 4,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Member since {memberSince}
              </div>
            )}

            {/* Sign out — red text on transparent background, not a destructive
                button style. Subtle. Inline error message below if it fails. */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                marginTop: 16,
                background: 'none',
                border: 'none',
                color: signingOut ? '#9CA3AF' : '#DC2626',
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                cursor: signingOut ? 'default' : 'pointer',
                padding: 0,
              }}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
            {signOutError && (
              <div
                role="alert"
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: '#DC2626',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {signOutError}
              </div>
            )}
          </section>
        )}

        {/* ── Legal links ────────────────────────────────────────────────── */}
        <section
          style={{
            padding: '16px 20px',
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E5E7EB',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6B7280',
              marginBottom: 10,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Legal
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                color: '#0D1B2A',
                textDecoration: 'underline',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                color: '#0D1B2A',
                textDecoration: 'underline',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Terms of Service
            </a>
          </div>
        </section>

        {/* ── About this data (1AM-110) ───────────────────────────────────── */}
        {/* Migrated from the removed OnboardingDataExplainer (1AM-18, deleted
            in v0.13.1 once Discovery shipped real filings pre-onboarding).
            Passive reference — reachable when curious, not forced reading.
            The onboarding STOCK Act one-liner (1AM-259) covers the "why does
            this app exist" orientation moment; this card is the deeper
            reference for someone who wants the actual legal/timing context. */}
        <section
          style={{
            padding: '16px 20px',
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E5E7EB',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6B7280',
              marginBottom: 10,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            About this data
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#374151',
              lineHeight: 1.5,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            StockActAlert tracks trades disclosed under the <strong>STOCK Act</strong>{' '}
            (Stop Trading on Congressional Knowledge Act) — a federal law requiring
            members of Congress to report stock transactions within 45 days.
            Amounts are reported as ranges, not exact figures, and disclosures can
            take time to appear after the trade itself.
          </div>
        </section>

        {/* ── App version ─────────────────────────────────────────────────── */}
        <div
          style={{
            fontSize: 12,
            color: '#9CA3AF',
            textAlign: 'center',
            marginBottom: 16,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {APP_VERSION}
        </div>

        {/* ── Credits card (1AM-146) — preserved from prior version ──────── */}
        <section
          style={{
            padding: '16px 20px',
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E5E7EB',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6B7280',
              marginBottom: 10,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Credits
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#374151',
              lineHeight: 1.5,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Politician photos are sourced from the{' '}
            <a
              href="https://github.com/unitedstates/images"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0D1B2A', textDecoration: 'underline' }}
            >
              unitedstates/images
            </a>{' '}
            project, dedicated to the public domain under{' '}
            <a
              href="https://creativecommons.org/publicdomain/zero/1.0/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0D1B2A', textDecoration: 'underline' }}
            >
              CC0 1.0
            </a>
            . Trade data via Financial Modeling Prep, derived from STOCK Act
            disclosures filed with the U.S. Senate and House of Representatives.
          </div>
        </section>
      </div>
    </div>
  );
}

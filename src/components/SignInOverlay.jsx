// 1AM-181: SignIn overlay — magic-link auth surface.
//
// Custom implementation (replaces earlier @supabase/auth-ui-react approach
// which is deprecated and incompatible with React 19 — useState=null crash).
// We call supabase.auth.signInWithOtp() directly. ~40 lines of self-managed
// form state instead of a 50KB+ third-party UI library.
//
// State-overlay component per architectural decision in 1AM-181 comment
// (consistent with PoliticianDetailScreen + SettingsScreen patterns).
// NOT a dedicated route.
//
// Magic-link flow (user perspective):
//   1. User types email, clicks "Send magic link"
//   2. signInWithOtp() returns — Supabase queues an email via Resend SMTP
//   3. We render "Check your inbox" confirmation
//   4. Email arrives within ~30s with one-time link
//   5. User clicks link → opens app with #access_token=... in URL hash
//   6. supabase.auth.detectSessionInUrl picks it up automatically
//   7. AuthProvider's onAuthStateChange fires → session state updates
//   8. App re-renders without overlay
//   9. App.jsx top-level useEffect cleans the URL hash

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Form status state machine: 'idle' → 'sending' → 'sent' | 'error'.
// On error the user can fix the email and resubmit, returning to 'sending'.
const STATUS = {
  IDLE: 'idle',
  SENDING: 'sending',
  SENT: 'sent',
  ERROR: 'error',
};

export default function SignInOverlay({ onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || status === STATUS.SENDING) return;

    setStatus(STATUS.SENDING);
    setErrorMessage('');

    // signInWithOtp triggers email via Supabase Auth → Resend SMTP.
    // emailRedirectTo must be on the redirect-URL whitelist in Supabase
    // Auth → URL Configuration. We've added stockactalert.com, www.,
    // *.vercel.app, and localhost:5173 already.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setStatus(STATUS.ERROR);
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
    } else {
      setStatus(STATUS.SENT);
    }
  }

  // Inline styles — keeps the component self-contained, no CSS module needed.
  // Design tokens: Playfair Display + DM Sans, navy #0D1B2A, warm white
  // #FAFAF7, error #DC2626.
  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: '#FAFAF7',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  };

  const closeButtonStyle = {
    position: 'absolute',
    top: 20,
    right: 20,
    background: 'transparent',
    border: 'none',
    fontSize: 24,
    color: '#6B7280',
    cursor: 'pointer',
    padding: 8,
    lineHeight: 1,
  };

  const containerStyle = {
    maxWidth: 420,
    margin: '0 auto',
    padding: '80px 24px 40px',
    width: '100%',
    flex: 1,
  };

  const titleStyle = {
    fontFamily: `'Playfair Display', Georgia, serif`,
    fontSize: 32,
    fontWeight: 700,
    color: '#0D1B2A',
    margin: '0 0 12px',
    letterSpacing: '-0.01em',
  };

  const subtitleStyle = {
    fontFamily: `'DM Sans', system-ui, sans-serif`,
    fontSize: 15,
    color: '#6B7280',
    margin: '0 0 32px',
    lineHeight: 1.5,
  };

  const labelStyle = {
    fontFamily: `'DM Sans', system-ui, sans-serif`,
    fontSize: 13,
    fontWeight: 500,
    color: '#6B7280',
    display: 'block',
    marginBottom: 8,
  };

  const inputStyle = {
    fontFamily: `'DM Sans', system-ui, sans-serif`,
    fontSize: 16,
    color: '#0D1B2A',
    background: 'transparent',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    padding: '12px 14px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  const buttonStyle = {
    fontFamily: `'DM Sans', system-ui, sans-serif`,
    fontSize: 15,
    fontWeight: 500,
    color: '#FAFAF7',
    background: '#0D1B2A',
    border: 'none',
    borderRadius: 8,
    padding: '12px 20px',
    width: '100%',
    cursor: status === STATUS.SENDING ? 'wait' : 'pointer',
    marginTop: 16,
    opacity: status === STATUS.SENDING ? 0.7 : 1,
    transition: 'opacity 0.15s',
  };

  const errorStyle = {
    fontFamily: `'DM Sans', system-ui, sans-serif`,
    fontSize: 13,
    color: '#DC2626',
    marginTop: 12,
    marginBottom: 0,
  };

  const sentStyle = {
    fontFamily: `'DM Sans', system-ui, sans-serif`,
    fontSize: 15,
    color: '#0D1B2A',
    background: '#F0F0EC',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    padding: '16px 18px',
    margin: '0 0 24px',
    lineHeight: 1.5,
  };

  const footerStyle = {
    fontFamily: `'DM Sans', system-ui, sans-serif`,
    fontSize: 11,
    color: '#9CA3AF',
    margin: '40px 0 0',
    lineHeight: 1.5,
  };

  return (
    <div style={overlayStyle}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close sign in"
        style={closeButtonStyle}
      >
        ×
      </button>

      <div style={containerStyle}>
        {/* 1AM-181: Explicit back-link inside the 420px container. The × top-
            right closes the same way but sits at the screen edge on wider
            viewports — easy to miss. This in-container link is always visible
            next to the form. */}
        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: `'DM Sans', system-ui, sans-serif`,
            fontSize: 14,
            fontWeight: 500,
            color: '#6B7280',
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            margin: '0 0 32px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ← Back to app
        </button>

        <h1 style={titleStyle}>Sign in</h1>
        <p style={subtitleStyle}>
          Sync your followed politicians across devices. We'll email you a
          one-time link to sign in — no password needed.
        </p>

        {status === STATUS.SENT ? (
          <>
            <div style={sentStyle}>
              <strong>Check your inbox.</strong> We sent a magic link to{' '}
              <span style={{ color: '#0D1B2A' }}>{email}</span>. Click the link
              in the email to finish signing in.
            </div>
            <button
              type="button"
              onClick={() => {
                setStatus(STATUS.IDLE);
                setEmail('');
              }}
              style={{
                ...buttonStyle,
                background: 'transparent',
                color: '#0D1B2A',
                border: '1px solid #E5E7EB',
                marginTop: 0,
              }}
            >
              Use a different email
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="signin-email" style={labelStyle}>
              Email address
            </label>
            <input
              id="signin-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === STATUS.SENDING}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = '#0D1B2A')}
              onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
            />

            <button
              type="submit"
              disabled={status === STATUS.SENDING || !email}
              style={buttonStyle}
            >
              {status === STATUS.SENDING ? 'Sending magic link...' : 'Send magic link'}
            </button>

            {status === STATUS.ERROR && (
              <p style={errorStyle}>{errorMessage}</p>
            )}
          </form>
        )}

        <p style={footerStyle}>
          By signing in, you agree to our{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0D1B2A', textDecoration: 'underline' }}
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0D1B2A', textDecoration: 'underline' }}
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

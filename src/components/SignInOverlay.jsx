// 1AM-181: SignIn overlay — magic-link auth surface.
//
// State-overlay component per architectural decision in 1AM-181 comment
// (consistent with PoliticianDetailScreen + SettingsScreen patterns).
// NOT a dedicated route — see 1AM-181 architectural decision comment.
//
// Uses @supabase/auth-ui-react as the drop-in UI primitive. Custom theme
// matches StockActAlert design system: Playfair Display + DM Sans,
// warm white #FAFAF7, navy #0D1B2A.
//
// Magic-link flow (user perspective):
//   1. User types email, clicks "Send magic link"
//   2. Supabase sends email via Resend SMTP (configured in dashboard)
//   3. Email arrives within ~30s with one-time link
//   4. User clicks link → opens app with #access_token=... in URL hash
//   5. supabase.auth.detectSessionInUrl picks it up automatically
//   6. AuthProvider's onAuthStateChange fires → session state updates
//   7. App re-renders without overlay → user is in
//   8. App.jsx top-level useEffect cleans the URL hash so token doesn't
//      linger in browser history or get accidentally shared
//
// Success state ("Check your inbox") is rendered by auth-ui-react itself —
// we don't need a separate state machine here.

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';

// Custom theme — extends Supabase's ThemeSupa with our design tokens.
// ThemeSupa structure: a "default" object with category subkeys.
const stockactalertTheme = {
  default: {
    colors: {
      brand: '#0D1B2A',          // navy — primary button bg
      brandAccent: '#1a2942',    // navy lightened — hover state
      brandButtonText: '#FAFAF7', // warm white — text on navy button
      defaultButtonBackground: '#FAFAF7',
      defaultButtonBackgroundHover: '#F0F0EC',
      defaultButtonBorder: '#E5E7EB',
      defaultButtonText: '#0D1B2A',
      dividerBackground: '#E5E7EB',
      inputBackground: 'transparent',
      inputBorder: '#E5E7EB',
      inputBorderHover: '#9CA3AF',
      inputBorderFocus: '#0D1B2A',
      inputText: '#0D1B2A',
      inputLabelText: '#6B7280',
      inputPlaceholder: '#9CA3AF',
      messageText: '#0D1B2A',
      messageTextDanger: '#DC2626',
      anchorTextColor: '#0D1B2A',
      anchorTextHoverColor: '#1a2942',
    },
    fonts: {
      bodyFontFamily: `'DM Sans', system-ui, sans-serif`,
      buttonFontFamily: `'DM Sans', system-ui, sans-serif`,
      inputFontFamily: `'DM Sans', system-ui, sans-serif`,
      labelFontFamily: `'DM Sans', system-ui, sans-serif`,
    },
    radii: {
      borderRadiusButton: '8px',
      buttonBorderRadius: '8px',
      inputBorderRadius: '8px',
    },
  },
};

export default function SignInOverlay({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#FAFAF7',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Close button — consistent with PoliticianDetailScreen pattern.
          User can dismiss sign-in and continue with localStorage-only
          (per Lovable architectural advice: auth is optional). */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close sign in"
        style={{
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
        }}
      >
        ×
      </button>

      <div
        style={{
          maxWidth: 420,
          margin: '0 auto',
          padding: '80px 24px 40px',
          width: '100%',
          flex: 1,
        }}
      >
        <h1
          style={{
            fontFamily: `'Playfair Display', Georgia, serif`,
            fontSize: 32,
            fontWeight: 700,
            color: '#0D1B2A',
            margin: '0 0 12px',
            letterSpacing: '-0.01em',
          }}
        >
          Sign in
        </h1>
        <p
          style={{
            fontFamily: `'DM Sans', system-ui, sans-serif`,
            fontSize: 15,
            color: '#6B7280',
            margin: '0 0 32px',
            lineHeight: 1.5,
          }}
        >
          Sync your followed politicians across devices. We'll email you a
          one-time link to sign in — no password needed.
        </p>

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: stockactalertTheme,
          }}
          providers={[]}
          view="magic_link"
          showLinks={false}
          // 1AM-181: redirectTo lands the magic-link callback on whatever
          // origin the user signed in from (production www, preview deploy,
          // or localhost). Supabase Auth → URL Configuration must whitelist
          // each origin's `/**` pattern — already configured.
          redirectTo={window.location.origin}
          localization={{
            variables: {
              magic_link: {
                email_input_label: 'Email address',
                email_input_placeholder: 'you@example.com',
                button_label: 'Send magic link',
                loading_button_label: 'Sending magic link...',
                link_text: '',
                confirmation_text: 'Check your email for the magic link',
              },
            },
          }}
        />

        <p
          style={{
            fontFamily: `'DM Sans', system-ui, sans-serif`,
            fontSize: 11,
            color: '#9CA3AF',
            margin: '40px 0 0',
            lineHeight: 1.5,
          }}
        >
          By signing in, you agree to our Terms of Service and Privacy Policy
          (coming in 1AM-31.3).
        </p>
      </div>
    </div>
  );
}

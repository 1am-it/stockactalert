// 1AM-182: PrivacyPage
// Static /privacy page reachable via direct URL or from SignInOverlay /
// SettingsScreen. v1 pre-launch content — template-based, not lawyer-reviewed.
//
// Content decisions logged (2026-05-18 session):
//   - Data controller: 1AM (KvK 91236088, Breda NL) — full legal address
//   - Contact email: madejo@pm.me for v1 (per-folder ticket; switch to
//     privacy@stockactalert.com after Resend domain verification ships
//     in 1AM-253)
//   - Processors: Supabase + Resend, both listed as processors but
//     deliberately NOT claimed "EU-GDPR-compliant" without internal DPA
//     confirmation (per martinus 2026-05-18 advice — EDPB / Supabase /
//     Resend each publish their own DPA terms; we link, we don't assert)
//   - Supabase region: NOT asserted as US-east — placeholder phrasing
//     "exact region verified before public launch" per martinus advice.
//     Update this line once Supabase Dashboard → Settings → General is
//     confirmed.
//   - Data subject rights timeline: "within one month / no later than 30
//     days" per EDPB guidance (GDPR Art. 12(3) allows up to 1 month with
//     possible extension for complex requests).
//   - Data sources: FMP only. EODHD removed (not in code, was legacy
//     ticket text). unitedstates/images CC0 attribution preserved from
//     1AM-146 Credits.
//   - No tracking cookies, no advertising IDs, no data sales (CCPA Section)

import StaticPageLayout, { H2, P, UL, Strong } from './StaticPageLayout';

export default function PrivacyPage() {
  return (
    <StaticPageLayout title="Privacy Policy" lastUpdated="2026-05-18">
      <P>
        This Privacy Policy explains what personal data StockActAlert collects,
        why, and how we handle it. We aim to keep this short and honest. If
        anything here is unclear, email us at{' '}
        <a
          href="mailto:madejo@pm.me"
          style={{ color: '#0D1B2A', textDecoration: 'underline' }}
        >
          madejo@pm.me
        </a>
        .
      </P>

      <H2>Who we are</H2>
      <P>
        StockActAlert is operated by <Strong>1AM</Strong>, Zinkstraat 24
        Unit E6006, 4823AD Breda, Netherlands — Chamber of Commerce (KvK)
        number 91236088. We are the data controller for the personal data
        described below.
      </P>
      <P>
        Contact for privacy questions and data-subject requests:{' '}
        <a
          href="mailto:madejo@pm.me"
          style={{ color: '#0D1B2A', textDecoration: 'underline' }}
        >
          madejo@pm.me
        </a>
        .
      </P>

      <H2>What we collect</H2>
      <UL>
        <li>
          <Strong>Email address</Strong> — used to sign you in via magic-link
          authentication and (once enabled) to send notifications you have
          opted in to.
        </li>
        <li>
          <Strong>Followed politicians</Strong> — the list of US Congress
          members you have chosen to follow, so we can show you their
          trading activity across devices.
        </li>
        <li>
          <Strong>Sign-in timestamps and session metadata</Strong> — used to
          maintain your session and detect unusual sign-in activity.
        </li>
      </UL>
      <P>
        We do <Strong>not</Strong> collect browsing history, device
        fingerprints, advertising identifiers, or any data not directly
        needed to provide the product.
      </P>

      <H2>Why we collect it</H2>
      <UL>
        <li>To sign you in and remember your preferences across devices.</li>
        <li>
          To deliver email notifications about Congressional disclosures
          you have asked to follow (when this feature launches).
        </li>
        <li>
          To improve the product based on aggregate, non-identifying usage
          metrics.
        </li>
      </UL>

      <H2>Where it is stored</H2>
      <P>
        Account data is stored in <Strong>Supabase</Strong>, a hosted
        database service. The exact storage region of your data will be
        verified and disclosed here before public launch. Magic-link emails
        are delivered via <Strong>Resend</Strong>. Both are processors
        acting on our behalf; each publishes its own data-processing
        terms.
      </P>

      <H2>How long we keep it</H2>
      <P>
        We keep your account data for as long as your account is active.
        If you delete your account or request deletion, we will remove
        your personal data within 30 days, except where retention is
        required by law (e.g. financial-records obligations, which do not
        apply to most user data we hold).
      </P>

      <H2>Your rights</H2>
      <P>
        Under the GDPR (and equivalent EU/UK law), you have the right to:
      </P>
      <UL>
        <li>Access the personal data we hold about you (Art. 15).</li>
        <li>Correct inaccurate data (Art. 16).</li>
        <li>Request deletion of your data (Art. 17, "right to be forgotten").</li>
        <li>
          Request data portability — receive your data in a structured,
          common format (Art. 20).
        </li>
        <li>
          Object to processing or restrict processing (Art. 18, 21).
        </li>
        <li>
          Lodge a complaint with the Dutch Data Protection Authority
          (Autoriteit Persoonsgegevens) if you believe we are mishandling
          your data.
        </li>
      </UL>
      <P>
        Send requests to{' '}
        <a
          href="mailto:madejo@pm.me"
          style={{ color: '#0D1B2A', textDecoration: 'underline' }}
        >
          madejo@pm.me
        </a>
        . We respond within one month, no later than 30 days. Complex
        requests may take up to three months total under GDPR Art. 12(3);
        we will tell you within the first month if an extension applies.
      </P>

      <H2>Cookies and local storage</H2>
      <P>
        We do <Strong>not</Strong> use tracking cookies, analytics
        trackers, or third-party advertising cookies. Your browser stores
        a small amount of data via <code>localStorage</code> and via a
        Supabase session cookie, used only to keep you signed in and to
        remember your in-app preferences (such as your followed
        politicians list and current time window). This data stays on
        your device and is only sent back to our servers as part of
        normal app traffic.
      </P>

      <H2>No data sales</H2>
      <P>
        We do not sell, rent, or share your personal data with third
        parties for marketing purposes. We do not participate in
        advertising networks. Under the California Consumer Privacy Act
        (CCPA), this means we do not "sell" personal information.
      </P>

      <H2>Data sources we use</H2>
      <P>
        Congressional trade disclosure data is obtained from{' '}
        <Strong>Financial Modeling Prep</Strong> (FMP), which aggregates
        STOCK Act filings from the US Senate and House of Representatives.
        Politician photos are sourced from the{' '}
        <a
          href="https://github.com/unitedstates/images"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0D1B2A', textDecoration: 'underline' }}
        >
          unitedstates/images
        </a>{' '}
        project, dedicated to the public domain under CC0 1.0.
      </P>

      <H2>Changes to this policy</H2>
      <P>
        We may update this Privacy Policy as the product evolves. Material
        changes will be communicated to signed-in users by email and noted
        on this page with an updated "Last updated" date. Your continued
        use of StockActAlert after a change indicates acceptance of the
        updated policy.
      </P>

      <H2>Contact</H2>
      <P>
        Privacy questions, complaints, and data-subject requests:{' '}
        <a
          href="mailto:madejo@pm.me"
          style={{ color: '#0D1B2A', textDecoration: 'underline' }}
        >
          madejo@pm.me
        </a>
        .
      </P>
    </StaticPageLayout>
  );
}

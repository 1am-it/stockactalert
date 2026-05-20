// 1AM-182: TermsPage
// Static /terms page reachable via direct URL or from SignInOverlay /
// SettingsScreen. v1 pre-launch content — template-based, not lawyer-reviewed.
//
// Content decisions logged (2026-05-18 session):
//   - Hard financial-advice disclaimer — primary risk-mitigation clause.
//     Echoes the 1AM-43 "Won't Fix" stance on returns-ranking: this
//     product surfaces public filings, it does not advise on trading.
//   - STOCK Act 45-day lag explicitly disclosed (mirrors the in-app
//     STOCK Act lag micro-line from 1AM-169).
//   - Best-effort SLA per martinus advice (not "no warranty whatsoever").
//     Friendlier, still legally defensible for a free pre-launch product.
//   - 18+ age requirement per martinus advice — fits finance/investing
//     context. Younger users need parental/guardian consent.
//   - Governing law: Netherlands, consistent with 1AM Breda vestiging.
//   - No subscription or payment terms — product is free at v1; payment
//     terms will be added if/when monetisation ships.

import StaticPageLayout, { H2, P, UL, Strong } from './StaticPageLayout';

export default function TermsPage() {
  return (
    <StaticPageLayout title="Terms of Service" lastUpdated="2026-05-18">
      <P>
        Welcome to StockActAlert. These Terms of Service ("Terms") govern
        your use of the StockActAlert website and app. By signing in or
        using the service, you agree to these Terms. If you do not agree,
        please do not use the service.
      </P>

      <H2>About StockActAlert</H2>
      <P>
        StockActAlert is a tool for tracking public stock-trade disclosures
        filed by members of the US Congress under the STOCK Act. We
        aggregate publicly available filings and present them in a more
        readable format than the original PDF sources.
      </P>

      <H2>Not financial advice</H2>
      <P>
        <Strong>
          StockActAlert is for informational purposes only. Nothing on this
          service constitutes financial, investment, legal, tax, or other
          professional advice.
        </Strong>{' '}
        We do not recommend buying or selling any security. We do not
        suggest you copy the trades of any politician. Past trading
        activity, by Congress members or anyone else, is not an indicator
        of future performance.
      </P>
      <P>
        Always do your own research and consult a licensed professional
        before making financial decisions. You are solely responsible for
        any trading or investment decisions you make.
      </P>

      <H2>STOCK Act filing delays</H2>
      <P>
        Under the STOCK Act, members of Congress have up to 45 days to
        report a transaction after it occurs. This means filings we
        display can be up to 45 days behind the actual trade. The data we
        present is historical disclosure data, not real-time trade
        signals.
      </P>

      <H2>Age requirement</H2>
      <P>
        You must be at least <Strong>18 years old</Strong> to use
        StockActAlert. If you are under 18, you may only use the service
        with the consent and supervision of a parent or legal guardian
        who agrees to these Terms on your behalf.
      </P>

      <H2>Account responsibilities</H2>
      <UL>
        <li>
          You are responsible for keeping the email address associated
          with your account secure. Magic-link sign-in means anyone with
          access to your email inbox can sign in to your account.
        </li>
        <li>
          You agree to provide accurate information when signing up.
        </li>
        <li>
          You agree not to share your account access with others or use
          the service to impersonate someone else.
        </li>
      </UL>

      <H2>Acceptable use</H2>
      <P>You agree <Strong>not</Strong> to:</P>
      <UL>
        <li>
          Scrape, automate, or otherwise programmatically extract data
          from the StockActAlert UI or API without prior written
          permission.
        </li>
        <li>
          Reverse-engineer, decompile, or attempt to bypass authentication
          or rate-limit systems.
        </li>
        <li>
          Use the service to harass, defame, or harm any individual,
          including members of Congress.
        </li>
        <li>
          Resell or commercialise data or content from StockActAlert
          without permission.
        </li>
        <li>
          Use the service in violation of any applicable law.
        </li>
      </UL>

      <H2>Service availability</H2>
      <P>
        We do our best to keep StockActAlert available and functioning
        correctly, but we do not guarantee uninterrupted or error-free
        operation. The service is provided on a best-effort basis. There
        is no service-level agreement (SLA) at this stage.
      </P>
      <P>
        Data shown on StockActAlert depends on third-party data sources
        (such as Financial Modeling Prep). If a data source is delayed,
        incorrect, or temporarily unavailable, our service may reflect
        those limitations. We are not responsible for the accuracy or
        timeliness of upstream data sources.
      </P>

      <H2>Limitation of liability</H2>
      <P>
        To the maximum extent permitted by Dutch law, 1AM and its
        operators are not liable for:
      </P>
      <UL>
        <li>
          Any financial losses, trading losses, or missed opportunities
          arising from your use of the service.
        </li>
        <li>
          Inaccuracies, omissions, or delays in the data we display.
        </li>
        <li>
          Service downtime or temporary unavailability.
        </li>
        <li>
          Indirect, incidental, or consequential damages of any kind.
        </li>
      </UL>
      <P>
        Nothing in these Terms limits liability that cannot be limited
        under Dutch consumer protection law.
      </P>

      <H2>Account termination</H2>
      <P>
        You can request account deletion at any time by emailing{' '}
        <a
          href="mailto:madejo@pm.me"
          style={{ color: '#0D1B2A', textDecoration: 'underline' }}
        >
          madejo@pm.me
        </a>
        . We will remove your account data within 30 days.
      </P>
      <P>
        We reserve the right to suspend or terminate accounts that
        violate these Terms (for example: scraping, abuse, or fraudulent
        activity). Where possible, we will explain the reason; in serious
        cases we may terminate without prior notice.
      </P>

      <H2>Changes to the service or these Terms</H2>
      <P>
        We may modify, suspend, or discontinue any part of StockActAlert
        at any time. We may also update these Terms as the product
        evolves. Material changes will be communicated to signed-in
        users by email and noted on this page with an updated "Last
        updated" date. Your continued use of StockActAlert after a change
        indicates acceptance of the updated Terms.
      </P>

      <H2>Governing law</H2>
      <P>
        These Terms are governed by the laws of the Netherlands. Any
        disputes arising from or related to your use of StockActAlert
        will be brought before the competent Dutch courts, unless
        mandatory consumer protection law provides otherwise.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about these Terms:{' '}
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

// 1AM-182: StaticPageLayout
// Shared visual shell for /privacy and /terms.
//
// Renders a warm-white full-page surface with a max-width content column,
// Playfair Display for the title, DM Sans for body. Section helpers
// (`<H2>`, `<P>`, `<UL>`) keep PrivacyPage / TermsPage focused on content,
// not styling. Bottom shows the "Last updated" line and a back-link.
//
// Why not a router-driven layout component: these two pages share enough
// visual structure to deserve a shared shell, but not enough to justify
// a generic component-library — extracting more would over-abstract for
// just two callers.
//
// Props:
//   title         — page title (h1, Playfair)
//   lastUpdated   — ISO date string (YYYY-MM-DD); rendered at the bottom
//   children      — page content (use the section helpers below)

export default function StaticPageLayout({ title, lastUpdated, children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '40px 24px 80px',
          fontFamily: "'DM Sans', sans-serif",
          color: '#1F2937',
        }}
      >
        {/* Back-link — leads to app root. Plain anchor (not button)
            because /privacy and /terms are direct-URL-reachable; the user
            might be arriving without a back-stack. */}
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginBottom: 24,
            color: '#6B7280',
            fontSize: 14,
            textDecoration: 'none',
            fontFamily: "'DM Sans', sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0D1B2A';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#6B7280';
          }}
        >
          ← Back to StockActAlert
        </a>

        <h1
          style={{
            fontSize: 36,
            margin: '0 0 32px',
            color: '#0D1B2A',
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontWeight: 500,
            letterSpacing: '-0.5px',
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>

        {children}

        <p
          style={{
            marginTop: 48,
            fontSize: 12,
            color: '#9CA3AF',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Last updated: {lastUpdated}
        </p>
      </div>
    </div>
  );
}

// ── Section helpers ─────────────────────────────────────────────────────────
// Tagged exports for use in PrivacyPage / TermsPage. Keeps consistent
// typography without inline-styling the same h2/p/ul repeatedly.

export function H2({ children }) {
  return (
    <h2
      style={{
        fontFamily: "'Playfair Display', 'Lora', serif",
        fontSize: 22,
        fontWeight: 500,
        color: '#0D1B2A',
        margin: '32px 0 12px',
        letterSpacing: '-0.3px',
      }}
    >
      {children}
    </h2>
  );
}

export function P({ children }) {
  return (
    <p
      style={{
        fontSize: 15,
        lineHeight: 1.7,
        color: '#374151',
        margin: '0 0 12px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {children}
    </p>
  );
}

export function UL({ children }) {
  return (
    <ul
      style={{
        fontSize: 15,
        lineHeight: 1.7,
        color: '#374151',
        margin: '0 0 12px',
        paddingLeft: 24,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {children}
    </ul>
  );
}

export function Strong({ children }) {
  return (
    <strong style={{ color: '#0D1B2A', fontWeight: 600 }}>{children}</strong>
  );
}

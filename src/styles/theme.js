// ─── StockActAlert Design System ─────────────────────────────────────────────
// SAA-1: All design tokens extracted from screen flows
// Optie A — Light / Editorial
// Fonts: Playfair Display (display) + DM Sans (body)

const theme = {

  // ── Colors ────────────────────────────────────────────────────────────────
  colors: {
    // Backgrounds
    bg: {
      primary:   '#FAFAF7',   // warm white — main app background
      card:      '#FFFFFF',   // pure white — cards and surfaces
      subtle:    '#F9FAFB',   // very light — secondary surfaces
      light:     '#F3F4F6',   // light grey — borders and dividers
    },

    // Brand
    navy:       '#0D1B2A',    // primary — headers, buttons, bold text
    navyLight:  '#1E3A5F',    // hover state for navy elements

    // Trade actions
    buy: {
      text:       '#059669',  // green — buy action text and icons
      bg:         '#ECFDF5',  // light green — buy background tint
      border:     '#D1FAE5',  // green border
    },
    sell: {
      text:       '#DC2626',  // red — sell action text and icons
      bg:         '#FEF2F2',  // light red — sell background tint
      border:     '#FEE2E2',  // red border
    },

    // Party colors
    democrat:   '#1D4ED8',    // blue — Democrat party
    republican: '#DC2626',    // red — Republican party

    // Committee colors
    committee: {
      armedServices:    '#DC2626',  // red
      intelligence:     '#7C3AED',  // purple
      finance:          '#1D4ED8',  // blue
      financialServices:'#1D4ED8',  // blue
      banking:          '#1D4ED8',  // blue
      homelandSecurity: '#D97706',  // amber
      agriculture:      '#059669',  // green
      budget:           '#6B7280',  // grey
      default:          '#6B7280',  // grey
    },

    // Text
    text: {
      primary:    '#0D1B2A',  // near black — main text
      secondary:  '#6B7280',  // medium grey — supporting text
      muted:      '#9CA3AF',  // light grey — hints and placeholders
      inverse:    '#FFFFFF',  // white — text on dark backgrounds
    },

    // Borders
    border: {
      light:    '#F3F4F6',    // very subtle border
      default:  '#E5E7EB',    // standard border
      medium:   '#D1D5DB',    // slightly stronger border
    },

    // Semantic
    gold:       '#D97706',    // amber — warnings and highlights
    goldBg:     '#FFFBEB',    // amber background tint
    purple:     '#7C3AED',    // purple — Intelligence committee
    purpleBg:   '#F5F3FF',    // purple background tint
    blue:       '#1D4ED8',    // blue — Democrat / Finance committee
    blueBg:     '#EFF6FF',    // blue background tint
  },

  // ── Typography ────────────────────────────────────────────────────────────
  fonts: {
    display: "'Playfair Display', Georgia, serif",   // headings, tickers, names
    body:    "'DM Sans', system-ui, sans-serif",     // UI text, labels, buttons
    mono:    "'JetBrains Mono', 'Courier New', monospace", // amounts, dates, codes
  },

  fontSizes: {
    xs:   '10px',
    sm:   '11px',
    base: '13px',
    md:   '14px',
    lg:   '15px',
    xl:   '17px',
    '2xl':'20px',
    '3xl':'24px',
    '4xl':'28px',
  },

  fontWeights: {
    regular:  400,
    semibold: 600,
    bold:     700,
    black:    800,
  },

  // ── Spacing ───────────────────────────────────────────────────────────────
  spacing: {
    xs:   '4px',
    sm:   '8px',
    md:   '12px',
    lg:   '16px',
    xl:   '20px',
    '2xl':'24px',
    '3xl':'32px',
    '4xl':'40px',
  },

  // ── Border Radius ─────────────────────────────────────────────────────────
  radius: {
    sm:   '6px',
    md:   '8px',
    lg:   '12px',
    xl:   '16px',
    '2xl':'20px',
    '3xl':'24px',
    full: '9999px',   // pills and circular badges
  },

  // ── Shadows ───────────────────────────────────────────────────────────────
  shadows: {
    sm:   '0 1px 4px rgba(13, 27, 42, 0.06)',
    md:   '0 4px 20px rgba(13, 27, 42, 0.08)',
    lg:   '0 8px 32px rgba(13, 27, 42, 0.12)',
    xl:   '0 25px 60px rgba(13, 27, 42, 0.16)',
  },

  // ── Borders ───────────────────────────────────────────────────────────────
  borders: {
    default:  '1px solid #E5E7EB',
    light:    '1px solid #F3F4F6',
    medium:   '1.5px solid #E5E7EB',
    buy:      '3px solid #059669',   // left border on buy trade cards
    sell:     '3px solid #DC2626',   // left border on sell trade cards
  },

  // ── Transitions ───────────────────────────────────────────────────────────
  transitions: {
    fast:   'all 0.15s ease',
    normal: 'all 0.2s ease',
    slow:   'all 0.3s ease',
  },

  // ── Z-index ───────────────────────────────────────────────────────────────
  zIndex: {
    base:       0,
    dropdown:   10,
    sticky:     20,
    overlay:    30,
    modal:      40,
    toast:      50,
  },

  // ── Component specific ────────────────────────────────────────────────────
  components: {
    // Avatar sizes
    avatar: {
      sm:  '32px',
      md:  '44px',
      lg:  '56px',
      xl:  '64px',
    },

    // Bottom navigation height
    tabBar: {
      height: '64px',
    },

    // Card padding
    card: {
      padding: '16px 18px',
    },

    // Bottom sheet
    bottomSheet: {
      borderRadius: '24px 24px 0 0',
      handleWidth:  '36px',
      handleHeight: '4px',
    },
  },
};

export default theme;

// ── Named exports for convenient destructuring ────────────────────────────────
export const { colors, fonts, fontSizes, fontWeights, spacing, radius, shadows, borders, transitions, zIndex, components } = theme;

// ── Helper: get committee color ───────────────────────────────────────────────
export const getCommitteeColor = (committeeName) => {
  const name = committeeName?.toLowerCase() || '';
  if (name.includes('armed')) return theme.colors.committee.armedServices;
  if (name.includes('intelligence')) return theme.colors.committee.intelligence;
  if (name.includes('financial services')) return theme.colors.committee.financialServices;
  if (name.includes('finance')) return theme.colors.committee.finance;
  if (name.includes('banking')) return theme.colors.committee.banking;
  if (name.includes('homeland')) return theme.colors.committee.homelandSecurity;
  if (name.includes('agriculture')) return theme.colors.committee.agriculture;
  if (name.includes('budget')) return theme.colors.committee.budget;
  return theme.colors.committee.default;
};

// ── Helper: get party color ───────────────────────────────────────────────────
export const getPartyColor = (party) => {
  if (party === 'D') return theme.colors.democrat;
  if (party === 'R') return theme.colors.republican;
  return theme.colors.text.secondary;
};

// ── Helper: get trade action color ────────────────────────────────────────────
export const getActionColor = (action) => {
  if (action === 'Purchase') return theme.colors.buy.text;
  if (action === 'Sale') return theme.colors.sell.text;
  return theme.colors.text.secondary;
};

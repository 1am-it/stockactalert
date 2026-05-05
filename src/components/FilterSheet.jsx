// 1AM-124 fase 8: FilterSheet
// Bottom-sheet overlay containing the secondary filters that no longer fit on
// the main Browse view (Chamber, Time period, Sort). Reached via the
// "More filters →" tekst-link below the direction-chip row.
//
// Architecture decision (2026-05-04, fase 8): own component (option A from
// architecture review) rather than refactor of existing politicus-specific
// BottomSheet.jsx. Reasons:
//   - Existing BottomSheet is tightly coupled to politicus quick-preview
//     (props: politician, onFollow, onSetAlert, onViewProfile)
//   - 1AM-124 is IA-redesign, not architecture refactor
//   - Refactor to generic Sheet primitive can come later if a 3rd sheet
//     emerges (rule-of-three)
//
// Interaction pattern (decided 2026-05-04):
//   - No Apply button. Live filtering — chip taps update parent state
//     immediately, Recent Trades re-renders below the sheet
//   - Swipe-down OR tap backdrop closes the sheet
//   - State lives in BrowseAllFilingsScreen; this component is pure
//     presentation + delegate
//
// Visual reference: Lovable v7-mockup (2026-05-04) — drag-handle, "Filters"
// title in serif, three sections with labels, chip-rows. Backdrop matches
// existing BottomSheet (rgba(13, 27, 42, 0.45)).
//
// Props:
//   isOpen               — boolean, false = render nothing
//   onClose              — callback when backdrop tapped
//   chamber              — current chamber filter value ('all' | 'senate' | 'house')
//   onChamberChange      — callback(value)
//   timePeriod           — current time period value ('all' | 'past7d' | 'past30d' | 'past90d' | 'pastyear')
//   onTimePeriodChange   — callback(value)
//   sortOrder            — current sort value ('newest' | 'largest')
//   onSortOrderChange    — callback(value)

import SingleChipGroup from './SingleChipGroup';

const CHAMBER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'senate', label: 'Senate' },
  { value: 'house', label: 'House' },
];

const TIME_PERIOD_OPTIONS = [
  { value: 'past7d', label: 'Past 7d' },
  { value: 'past30d', label: 'Past 30d' },
  { value: 'past90d', label: 'Past 90d' },
  { value: 'pastYear', label: 'Past year' },
  { value: 'all', label: 'All time' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'largest', label: 'Largest amount' },
];

export default function FilterSheet({
  isOpen,
  onClose,
  chamber,
  onChamberChange,
  timePeriod,
  onTimePeriodChange,
  sortOrder,
  onSortOrderChange,
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* ── Backdrop ───────────────────────────────────────────────────── */}
      {/* Tap closes the sheet. Same dim level as existing BottomSheet
          (rgba(13, 27, 42, 0.45)) for visual consistency. */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(13, 27, 42, 0.45)',
          zIndex: 40,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* ── Sheet ──────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-label="Filters"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          background: '#FAFAF7',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: '12px 24px 28px',
          zIndex: 50,
          maxHeight: '80vh',
          overflowY: 'auto',
          maxWidth: 420,
          margin: '0 auto',
          boxShadow: '0 -8px 24px rgba(13, 27, 42, 0.12)',
        }}
      >
        {/* Drag-handle. Decorative — actual swipe-to-close gesture is not
            wired in this version (would need touch event handling). For now
            users close via backdrop tap. Visual cue still helps signal
            "this is dismissable". */}
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 4,
            background: '#D8D5C8',
            borderRadius: 2,
            margin: '0 auto 14px',
          }}
        />

        <h2
          style={{
            fontFamily: "'Playfair Display', 'Lora', serif",
            fontSize: 22,
            fontWeight: 500,
            color: '#0D1B2A',
            textAlign: 'center',
            margin: '0 0 20px',
            letterSpacing: '-0.3px',
          }}
        >
          Filters
        </h2>

        {/* ── Chamber section ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <SingleChipGroup
            label="Chamber"
            options={CHAMBER_OPTIONS}
            value={chamber}
            onChange={onChamberChange}
          />
        </div>

        {/* ── Time period section ─────────────────────────────────────── */}
        {/* 5 chips, may wrap to two rows on narrow viewports — SingleChipGroup
            handles that natively. */}
        <div style={{ marginBottom: 18 }}>
          <SingleChipGroup
            label="Time period"
            options={TIME_PERIOD_OPTIONS}
            value={timePeriod}
            onChange={onTimePeriodChange}
          />
        </div>

        {/* ── Sort section ────────────────────────────────────────────── */}
        <div>
          <SingleChipGroup
            label="Sort"
            options={SORT_OPTIONS}
            value={sortOrder}
            onChange={onSortOrderChange}
          />
        </div>
      </div>
    </>
  );
}

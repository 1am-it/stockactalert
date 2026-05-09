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
//   amountFilter         — current amount filter value ('any' | 'gte15k' | 'gte50k' | 'gte100k' | 'gte500k' | 'gte1m')
//   onAmountChange       — callback(value)
//   sortOrder            — current sort value ('newest' | 'largest')
//   onSortOrderChange    — callback(value)
//
// 1AM-152: timePeriod props removed — time-range chips now live on
// Browse-tab directly. The sheet contains only Chamber + Sort.
// 1AM-154: Minimum amount section added between Chamber and Sort.
// AMOUNT_OPTIONS imported from BrowseAllFilingsScreen (named export)
// rather than redefined here — single source of truth for the option
// list, avoids the value/label/threshold drift across files.

import { useEffect } from 'react';
import SingleChipGroup from './SingleChipGroup';
import { AMOUNT_OPTIONS } from './BrowseAllFilingsScreen';

const CHAMBER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'senate', label: 'Senate' },
  { value: 'house', label: 'House' },
];

// 1AM-152 (2026-05-09): TIME_PERIOD_OPTIONS removed from this file.
// Time-range chips now live on Browse-tab directly as a chip-row above
// the "More filters →" link. The sheet retains only Chamber + Sort.

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'largest', label: 'Largest amount' },
];

export default function FilterSheet({
  isOpen,
  onClose,
  chamber,
  onChamberChange,
  amountFilter,
  onAmountChange,
  sortOrder,
  onSortOrderChange,
}) {
  // 1AM-124 fase 9: close on Escape key (desktop UX parity). User-feedback
  // surfaced 2026-05-05 that tap-outside backdrop alone isn't a discoverable
  // close-affordance. Esc is the standard desktop modal-dismiss, and on
  // mobile keyboards (when search input has focus) Esc isn't typically
  // reachable so this is desktop-only in practice — that's fine.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
            wired in this version (would need touch event handling). Users
            close via:
              - Tap backdrop (existing)
              - Tap X-button top-right (1AM-124 fase 9)
              - Press Escape key on desktop (1AM-124 fase 9)
            Swipe-down gesture is a mobile-native expectation and could be
            added in a future ticket if user-feedback surfaces it. */}
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

        {/* ── Header row: title + close button (1AM-124 fase 9) ──────── */}
        {/* Title was previously centered with no visible close-affordance.
            User-feedback surfaced 2026-05-05 that backdrop-tap alone isn't
            discoverable. X-button on the right gives an explicit close
            target. Title shifts to left-aligned to balance the layout. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontFamily: "'Playfair Display', 'Lora', serif",
              fontSize: 22,
              fontWeight: 500,
              color: '#0D1B2A',
              margin: 0,
              letterSpacing: '-0.3px',
            }}
          >
            Filters
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              color: '#6B7280',
              lineHeight: 0,
            }}
          >
            {/* Inline SVG X — design system bans emoji. Stroke matches the
                outline-icon language used elsewhere in the app (e.g. search
                magnifying glass). 18px is reachable but unobtrusive. */}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Chamber section ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <SingleChipGroup
            label="Chamber"
            options={CHAMBER_OPTIONS}
            value={chamber}
            onChange={onChamberChange}
          />
        </div>

        {/* ── Minimum amount section (1AM-154) ────────────────────────── */}
        {/* 6 chips: Any amount / ≥$15K / ≥$50K / ≥$100K / ≥$500K / ≥$1M.
            Wraps to two rows on narrow viewports — SingleChipGroup handles
            that natively. AMOUNT_OPTIONS sourced from BrowseAllFilingsScreen
            (named export); SingleChipGroup uses the value + label fields
            and ignores the threshold field.

            Label "Amount" (not "Minimum amount") per design Q&A 2026-05-09:
            CHAMBER + AMOUNT + SORT all fit in the SingleChipGroup label
            minWidth column (56px) for clean vertical alignment of chip-rows.
            "Minimum amount" overflowed and broke the column. The chip values
            ("Any amount", "≥$15K" etc.) already communicate the
            minimum-threshold semantics — the column-label being shorter
            doesn't lose meaning. */}
        <div style={{ marginBottom: 18 }}>
          <SingleChipGroup
            label="Amount"
            options={AMOUNT_OPTIONS}
            value={amountFilter}
            onChange={onAmountChange}
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

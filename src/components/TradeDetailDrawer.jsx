// 1AM-70: TradeDetailDrawer — bottom-sheet overlay for trade detail
//
// Phase 1 (skeleton, 2026-05-09): scaffold only. Backdrop scrim + slide-up
// sheet + grab handle + Esc/scrim-tap dismiss + body-scroll lock. Content
// area renders a placeholder; phases 2-5 fill it with header, Bought-block,
// action row, sector filter affordance, and Related filings section.
//
// Phase 6 will add the swipe-down gesture (touch events on the grab handle
// area; drag-tracking gated on `contentRef.current.scrollTop === 0` so the
// browser keeps native scroll inside the content; threshold 100px OR velocity
// flick over the last ~100ms).
//
// Animation: pure CSS keyframes for the open animation (250ms slideUp +
// fadeIn). Close happens via instant unmount when `trade` becomes null —
// no close animation in v1, drawers feel snappy that way and the gesture
// in phase 6 will give a more progressive close UX.
//
// Accessibility: role="dialog" + aria-modal="true" on the sheet. Focus
// management is deferred — phase 2 adds focusable buttons in the action row,
// at which point we'll trap focus inside the dialog. Esc + scrim-tap +
// (phase 6) gesture all dismiss.
//
// Body-scroll lock: while the drawer is open, document.body overflow is set
// to 'hidden' so the underlying Browse list doesn't scroll behind the sheet.
// Restored on unmount.

import { useEffect, useRef } from 'react';

export default function TradeDetailDrawer({ trade, onClose }) {
  // Ref to the scrollable content area. Phase 6 will read scrollTop to gate
  // the swipe-down gesture; phase 1 wires the ref so structure is in place.
  const contentRef = useRef(null);

  useEffect(() => {
    if (!trade) return undefined;

    // Esc dismisses the drawer (desktop UX; mobile users have scrim-tap +
    // upcoming swipe-down). Same pattern as FilterSheet.
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Body-scroll lock while drawer is open. Restore previous overflow on
    // close instead of hard-resetting to '' so we don't trample any other
    // overflow-management code further up the tree.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [trade, onClose]);

  if (!trade) return null;

  return (
    <>
      {/* ── Backdrop scrim ─────────────────────────────────────────────── */}
      {/* Same dim level as FilterSheet (rgba(13, 27, 42, 0.45)) for visual
          consistency across overlays. Tap dismisses. */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(13, 27, 42, 0.45)',
          zIndex: 40,
          animation: 'tdd-fadeIn 200ms ease-out',
        }}
      />

      {/* ── Sheet ──────────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trade detail"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FFFFFF',
          borderRadius: '24px 24px 0 0',
          zIndex: 50,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 32px rgba(13, 27, 42, 0.15)',
          animation: 'tdd-slideUp 250ms ease-out',
        }}
      >
        {/* Grab handle — 36×3 neutral gray, centered. Phase 6 will attach
            touch handlers here for the swipe-down gesture. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '8px 0 4px',
            // touch-action: none would block scrolling — leave default.
            // Phase 6 will set touch-action: none on this element only,
            // letting the content area below keep native scroll.
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 3,
              borderRadius: 2,
              background: '#D1D5DB',
            }}
          />
        </div>

        {/* Scrollable content area. Phase 1 placeholder; phases 2-5 fill in. */}
        <div
          ref={contentRef}
          style={{
            overflowY: 'auto',
            padding: '8px 24px 32px',
            flexGrow: 1,
          }}
        >
          {/* Phase 1 placeholder — verifies the drawer mounts, displays the
              tapped trade's identity, and dismisses cleanly. Phases 2 and on
              replace this block with header + Bought-block + action row +
              Related filings. */}
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              color: '#6B7280',
              fontSize: 14,
              padding: '40px 0',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <strong>{trade.ticker}</strong> — {trade.politician}
            </div>
            <div style={{ fontSize: 12 }}>
              Drawer skeleton (1AM-70 phase 1).
              <br />
              Header + Bought-block land in phase 2.
            </div>
          </div>
        </div>
      </div>

      {/* Animation keyframes scoped via component-prefixed names so a future
          consumer with its own slideUp/fadeIn keyframes elsewhere doesn't
          collide. Style tag is inlined to avoid coupling the component to a
          global stylesheet — the component is self-contained. */}
      <style>{`
        @keyframes tdd-slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes tdd-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

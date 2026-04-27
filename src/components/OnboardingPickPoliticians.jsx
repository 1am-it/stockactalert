// SAA-15 / 1AM-24 / 1AM-79: Onboarding step 3 — pick politicians to follow
//
// Rewritten in 1AM-79 to support the full ~540-member Congress directory:
//   - Search bar (debounced 150ms, case-insensitive, matches name + nickname)
//   - Filter chips: Chamber (House/Senate) + Party (D/R/I), multi-select
//   - Suggested-to-follow section (8 hand-picked, only when no filters active)
//   - Member list (filtered + searched, native CSS content-visibility for perf)
//   - Empty state when filters yield no matches
//
// Selection contract is preserved from the curated-22 era: parent `App.jsx`
// owns `followedPoliticians` as an array of `name` strings, and `onToggle(name)`
// adds/removes. Migration to bioguideId-keyed storage is Phase C of 1AM-67.
//
// Design language: matches existing onboarding aesthetic (Playfair h1 + DM Sans
// body, off-white #FAFAF7 background, navy primary, party-colored accents).

import { useState, useEffect, useMemo } from 'react';
import { applyFilters, getSuggested } from '../lib/congress';
import MemberListRow from './MemberListRow';

const SEARCH_DEBOUNCE_MS = 150;

const PARTY_OPTIONS = [
  { value: 'D', label: 'Democrat' },
  { value: 'R', label: 'Republican' },
  { value: 'I', label: 'Independent' },
];

const CHAMBER_OPTIONS = [
  { value: 'Senate', label: 'Senate' },
  { value: 'House', label: 'House' },
];

export default function OnboardingPickPoliticians({
  selected,
  onToggle,
  onNext,
  onBack,
}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [chamber, setChamber] = useState([]);
  const [party, setParty] = useState([]);

  // Debounce search input → search (used for filtering)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isFiltered =
    search.trim().length > 0 || chamber.length > 0 || party.length > 0;

  const filtered = useMemo(
    () => applyFilters({ search, chamber, party }),
    [search, chamber, party]
  );

  const suggested = useMemo(() => getSuggested(), []);

  const canContinue = selected.length > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Scrollable content area (with bottom padding for sticky CTA bar) */}
      <div
        style={{
          flex: 1,
          maxWidth: 720,
          width: '100%',
          margin: '0 auto',
          padding: '60px 24px 120px',
        }}
      >
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36,
            fontWeight: 700,
            color: '#0D1B2A',
            marginBottom: 8,
          }}
        >
          Who do you want to follow?
        </h1>
        <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 4 }}>
          Pick at least one to get started. You can always change this later.
        </p>
        <p
          style={{
            fontSize: 13,
            fontStyle: 'italic',
            color: '#9CA3AF',
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          We don't rank them by returns — congressional performance data is
          noisy and misleading. Just pick who you're curious about.
        </p>

        {/* Search bar */}
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          onClear={() => setSearchInput('')}
        />

        {/* Filter chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <ChipGroup
            label="Chamber"
            options={CHAMBER_OPTIONS}
            value={chamber}
            onChange={setChamber}
          />
          <ChipGroup
            label="Party"
            options={PARTY_OPTIONS}
            value={party}
            onChange={setParty}
          />
        </div>

        {/* Suggested-to-follow section (only when no filters/search active) */}
        {!isFiltered && (
          <SuggestedSection
            members={suggested}
            selected={selected}
            onToggle={onToggle}
          />
        )}

        {/* Result list header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginTop: 28,
            marginBottom: 12,
          }}
        >
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#0D1B2A',
              margin: 0,
            }}
          >
            {isFiltered ? 'Results' : 'All members'}
          </h2>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              color: '#6B7280',
              letterSpacing: '0.04em',
            }}
          >
            {filtered.length}
          </span>
        </div>

        {/* List or empty state */}
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((member) => (
              <div
                key={member.bioguideId}
                style={{
                  // Native browser virtualization: skip rendering offscreen rows.
                  // Falls back gracefully on browsers that don't support it.
                  contentVisibility: 'auto',
                  containIntrinsicSize: '0 60px',
                }}
              >
                <MemberListRow
                  member={member}
                  isSelected={selected.includes(member.name)}
                  onToggle={() => onToggle(member.name)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom CTA bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'rgba(250, 250, 247, 0.95)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid #E5E7EB',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: '12px 20px',
            background: '#FFFFFF',
            color: '#0D1B2A',
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!canContinue}
          style={{
            padding: '12px 28px',
            background: canContinue ? '#0D1B2A' : '#E5E7EB',
            color: canContinue ? '#FAFAF7' : '#9CA3AF',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          {canContinue
            ? `Continue (${selected.length} selected)`
            : 'Pick at least one'}
        </button>
      </div>
    </div>
  );
}

// ── Search bar ──────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, onClear }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 14,
          fontSize: 14,
          color: '#9CA3AF',
          pointerEvents: 'none',
        }}
      >
        {/* Inline magnifier glyph — no icon library needed */}
        ⌕
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name…"
        aria-label="Search Congress members by name"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        style={{
          width: '100%',
          padding: '12px 14px 12px 38px',
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          fontSize: 15,
          fontFamily: "'DM Sans', sans-serif",
          color: '#0D1B2A',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#0D1B2A')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: 8,
            background: 'transparent',
            border: 'none',
            color: '#9CA3AF',
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Chip group (for Chamber + Party filters) ────────────────────────────────
function ChipGroup({ label, options, value, onChange }) {
  const toggle = (optionValue) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
          minWidth: 56,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const active = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              aria-pressed={active}
              style={{
                padding: '6px 12px',
                background: active ? '#0D1B2A' : '#FFFFFF',
                color: active ? '#FAFAF7' : '#374151',
                border: active ? '1px solid #0D1B2A' : '1px solid #E5E7EB',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Suggested-to-follow section ─────────────────────────────────────────────
function SuggestedSection({ members, selected, onToggle }) {
  if (members.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 18,
          fontWeight: 700,
          color: '#0D1B2A',
          margin: '0 0 12px 0',
        }}
      >
        Suggested for you
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {members.map((member) => (
          <MemberListRow
            key={member.bioguideId}
            member={member}
            isSelected={selected.includes(member.name)}
            onToggle={() => onToggle(member.name)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Empty state (no search/filter matches) ──────────────────────────────────
function EmptyState() {
  return (
    <div
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        background: '#FFFFFF',
        border: '1px dashed #E5E7EB',
        borderRadius: 14,
      }}
    >
      <div
        style={{
          fontSize: 24,
          marginBottom: 8,
          color: '#9CA3AF',
        }}
      >
        ⌕
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#0D1B2A',
          marginBottom: 4,
        }}
      >
        No politicians match
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#6B7280',
        }}
      >
        Try fewer filters or a different search.
      </div>
    </div>
  );
}

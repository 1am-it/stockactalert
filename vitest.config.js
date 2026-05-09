// vitest.config.js — 1AM-37 phase 1
//
// Pure-Node environment for now. formatChamberLine + sector helpers + amount
// parsers are all string-manipulation. Switch to jsdom when React component
// tests come in (post 1AM-150 drawer / Browse v3 — separate decision).
//
// Test files: src/lib/__tests__/*.test.js (pattern matches Vitest defaults).

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true, // expose describe/it/expect without import
    include: ['src/**/__tests__/**/*.test.{js,jsx}'],
  },
});
